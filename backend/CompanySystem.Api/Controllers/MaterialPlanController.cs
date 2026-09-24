using System.Security.Claims;
using CompanySystem.Api.Auth;
using CompanySystem.Api.Data;
using CompanySystem.Api.Dtos;
using CompanySystem.Api.Models;
using CompanySystem.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CompanySystem.Api.Controllers;

/// <summary>
/// Material plans: how much each project needs, compared with what's already
/// on its site — and, across all open projects, what still has to be bought.
/// Anyone logged in can look; only managers can change a plan.
/// </summary>
[ApiController]
[Authorize]
public class MaterialPlanController(AppDbContext db, StockService stock) : ControllerBase
{
    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // GET /api/projects/5/plan  → the plan, with what's on site and what's still needed
    [HttpGet("api/projects/{projectId:int}/plan")]
    public async Task<ActionResult<ProjectPlanDto>> GetPlan(int projectId)
    {
        var plan = await LoadPlan(projectId);
        if (plan is null) return NotFound();
        return Ok(plan);
    }

    // PUT /api/projects/5/plan  → replace the whole plan (managers only)
    [Authorize(Roles = Roles.Managers)]
    [HttpPut("api/projects/{projectId:int}/plan")]
    public async Task<ActionResult<ProjectPlanDto>> SavePlan(int projectId, List<PlanLineInputDto> input)
    {
        if (!await db.Projects.AnyAsync(p => p.Id == projectId)) return NotFound();

        input ??= [];
        if (input.Any(l => l.Planned < 0))
            return BadRequest(new { message = "Planned quantity can't be negative." });
        if (input.Select(l => l.ItemId).Distinct().Count() != input.Count)
            return BadRequest(new { message = "Each item can only appear once in the plan." });

        var itemIds = input.Select(l => l.ItemId).ToList();
        if (await db.Items.CountAsync(i => itemIds.Contains(i.Id)) != itemIds.Count)
            return BadRequest(new { message = "One or more items were not found." });

        // Update the lines that changed, add new ones, remove the rest (and zeros).
        var wanted = input.Where(l => l.Planned > 0).ToDictionary(l => l.ItemId, l => l.Planned);
        var existing = await db.ProjectMaterials.Where(m => m.ProjectId == projectId).ToListAsync();
        foreach (var m in existing)
        {
            if (!wanted.TryGetValue(m.ItemId, out var qty)) { db.ProjectMaterials.Remove(m); continue; }
            if (m.PlannedQuantity != qty)
            {
                m.PlannedQuantity = qty;
                m.UpdatedById = CurrentUserId;
                m.UpdatedAt = DateTime.UtcNow;
            }
            wanted.Remove(m.ItemId);
        }
        foreach (var (itemId, qty) in wanted)
            db.ProjectMaterials.Add(new ProjectMaterial { ProjectId = projectId, ItemId = itemId, PlannedQuantity = qty, UpdatedById = CurrentUserId });

        await db.SaveChangesAsync();
        return Ok(await LoadPlan(projectId));
    }

    // GET /api/plans/shortages  → per item, what all open projects still need,
    // what the warehouse can cover, and what has to be bought.
    [HttpGet("api/plans/shortages")]
    public async Task<ActionResult<IEnumerable<ShortageDto>>> Shortages()
    {
        // Completed projects don't need anything more.
        var plans = await db.ProjectMaterials
            .Include(m => m.Project)
            .Include(m => m.Item)
            .Where(m => m.Project!.Status != ProjectStatuses.Completed)
            .ToListAsync();
        if (plans.Count == 0) return Ok(Array.Empty<ShortageDto>());

        var itemIds = plans.Select(m => m.ItemId).Distinct().ToList();
        var onSite = (await stock.SiteBalances(itemIds: itemIds))
            .ToDictionary(b => (b.ProjectId, b.ItemId), b => b.Quantity);

        var rows = plans
            .GroupBy(m => m.ItemId)
            .Select(g =>
            {
                var item = g.First().Item!;
                var needs = g
                    .Select(m => new ShortageNeedDto(m.ProjectId, m.Project!.Name,
                        Math.Max(0, m.PlannedQuantity - onSite.GetValueOrDefault((m.ProjectId, m.ItemId)))))
                    .Where(n => n.StillNeeded > 0)
                    .OrderByDescending(n => n.StillNeeded)
                    .ToList();
                var needed = needs.Sum(n => n.StillNeeded);
                var toBuy = Math.Max(0, needed - item.Quantity);
                return new ShortageDto(item.Id, item.Name, item.Code, item.Unit, item.Price,
                    needed, item.Quantity, toBuy, toBuy * item.Price, needs);
            })
            .Where(r => r.Needed > 0)
            .OrderByDescending(r => r.EstimatedCost)
            .ThenByDescending(r => r.ToBuy)
            .ThenBy(r => r.Name)
            .ToList();
        return Ok(rows);
    }

    // --- helpers ---

    private async Task<ProjectPlanDto?> LoadPlan(int projectId)
    {
        var project = await db.Projects.FindAsync(projectId);
        if (project is null) return null;

        var plan = await db.ProjectMaterials
            .Where(m => m.ProjectId == projectId)
            .Include(m => m.UpdatedBy)
            .ToListAsync();
        var onSite = (await stock.SiteBalances(projectId)).ToDictionary(b => b.ItemId);

        // Planned items, plus anything on the site that isn't in the plan.
        var itemIds = plan.Select(m => m.ItemId).Concat(onSite.Where(b => b.Value.Quantity != 0).Select(b => b.Key)).Distinct().ToList();
        var items = await db.Items.Where(i => itemIds.Contains(i.Id)).ToDictionaryAsync(i => i.Id);
        var planned = plan.ToDictionary(m => m.ItemId, m => m.PlannedQuantity);

        var lines = itemIds
            .Select(id =>
            {
                var item = items[id];
                var qty = planned.GetValueOrDefault(id);
                var have = onSite.TryGetValue(id, out var b) ? b.Quantity : 0;
                var still = Math.Max(0, qty - have);
                return new PlanLineDto(id, item.Name, item.Code, item.Unit, item.Price,
                    qty, have, still, still * item.Price, planned.ContainsKey(id));
            })
            .OrderByDescending(l => l.InPlan)
            .ThenBy(l => l.Name)
            .ToList();

        // Progress = share of the planned material (by value) that's already on site.
        var budget = lines.Sum(l => l.Planned * l.Price);
        var covered = lines.Sum(l => Math.Min(l.OnSite, l.Planned) * l.Price);
        var progress = budget > 0 ? (int)Math.Round(covered / budget * 100) : 0;

        var last = plan.OrderByDescending(m => m.UpdatedAt).FirstOrDefault();
        return new ProjectPlanDto(
            project.Id, project.Name, project.Code, project.Status,
            lines,
            budget,
            onSite.Values.Sum(b => b.Value),
            lines.Sum(l => l.StillToSpend),
            progress,
            last?.UpdatedBy?.FullName,
            last?.UpdatedAt);
    }
}
