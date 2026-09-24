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
/// Where material is (warehouse vs. project sites) and moving it between them.
/// Anyone logged in can look; managers and the Procurement Officer can move stock.
/// </summary>
[ApiController]
[Authorize]
[Route("api/stock")] // → /api/stock/...
public class StockController(AppDbContext db, StockService stock) : ControllerBase
{
    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // GET /api/stock/on-site?projectId=5  → what's on each site right now
    // (optionally one site). Warehouse stock is on the items themselves.
    [HttpGet("on-site")]
    public async Task<ActionResult<IEnumerable<SiteStockDto>>> OnSite([FromQuery] int? projectId)
    {
        var balances = (await stock.SiteBalances(projectId)).Where(b => b.Quantity != 0).ToList();

        var itemIds = balances.Select(b => b.ItemId).Distinct().ToList();
        var projectIds = balances.Select(b => b.ProjectId).Distinct().ToList();
        var items = await db.Items.AsNoTracking()
            .Where(i => itemIds.Contains(i.Id))
            .Select(i => new { i.Id, i.Name, i.Code, i.Unit })
            .ToDictionaryAsync(i => i.Id);
        var projects = await db.Projects.AsNoTracking()
            .Where(p => projectIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Name, p.Code })
            .ToDictionaryAsync(p => p.Id);

        var rows = balances
            .Select(b => new SiteStockDto(
                b.ProjectId, projects[b.ProjectId].Name, projects[b.ProjectId].Code,
                b.ItemId, items[b.ItemId].Name, items[b.ItemId].Code, items[b.ItemId].Unit,
                b.Quantity, b.Value))
            .OrderBy(r => r.ProjectName).ThenBy(r => r.ItemName)
            .ToList();
        return Ok(rows);
    }

    // GET /api/stock/movements?projectId=5  → movements, newest first
    [HttpGet("movements")]
    public async Task<ActionResult<IEnumerable<StockMovementListDto>>> GetMovements([FromQuery] int? projectId)
    {
        // Read-only, and the rows are built by SQL (see StockMovementListDto.Projection).
        var q = db.StockMovements.AsNoTracking();
        if (projectId is int pid) q = q.Where(m => m.ProjectId == pid);

        var movements = await q
            .OrderByDescending(m => m.Date).ThenByDescending(m => m.Id)
            .Select(StockMovementListDto.Projection)
            .ToListAsync();
        return Ok(movements.Select(m => m.WithUniqueItemNames()));
    }

    // GET /api/stock/movements/5  → one movement with its lines
    [HttpGet("movements/{id:int}")]
    public async Task<ActionResult<StockMovementDetailDto>> GetMovement(int id)
    {
        var detail = await LoadDetail(id);
        if (detail is null) return NotFound();
        return Ok(detail);
    }

    // POST /api/stock/movements  → send material to a site, or return it (managers + procurement)
    [Authorize(Roles = Roles.Procurement)]
    [HttpPost("movements")]
    public async Task<ActionResult<StockMovementDetailDto>> Create(StockMovementInputDto input)
    {
        if (!StockMovementTypes.IsValid(input.Type))
            return BadRequest(new { message = $"Type '{input.Type}' is not valid." });
        if (!await db.Projects.AnyAsync(p => p.Id == input.ProjectId))
            return BadRequest(new { message = "Project not found." });
        if (input.Items is null || input.Items.Count == 0)
            return BadRequest(new { message = "At least one item is required." });
        if (input.Items.Any(l => l.Quantity <= 0))
            return BadRequest(new { message = "Every line must have a quantity greater than zero." });

        var itemIds = input.Items.Select(l => l.ItemId).Distinct().ToList();
        var items = await db.Items.Where(i => itemIds.Contains(i.Id)).ToDictionaryAsync(i => i.Id);
        if (items.Count != itemIds.Count)
            return BadRequest(new { message = "One or more items were not found." });

        var isIssue = input.Type == StockMovementTypes.Issue;

        // What each unit costs the project:
        //   Issue  → the item's price today.
        //   Return → the average cost of that item on the site, so returning
        //            everything takes exactly its cost back off the project.
        var unitCost = items.Values.ToDictionary(i => i.Id, i => i.Price);
        if (!isIssue)
        {
            var onSite = await stock.SiteBalances(input.ProjectId, itemIds);
            foreach (var b in onSite.Where(b => b.Quantity > 0))
                unitCost[b.ItemId] = Math.Round(b.Value / b.Quantity, 4);
        }

        // Issue: warehouse → site. Return: site → warehouse.
        var delta = new Dictionary<StockKey, int>();
        foreach (var l in input.Items)
        {
            var sign = isIssue ? 1 : -1;
            StockService.Add(delta, input.ProjectId, l.ItemId, sign * l.Quantity);
            StockService.Add(delta, null, l.ItemId, -sign * l.Quantity);
        }
        var shortfall = await stock.Apply(delta);
        if (shortfall is not null)
            return Conflict(new { message = $"{(isIssue ? "Can't send" : "Can't return")} — not enough stock. {shortfall}" });

        var movement = new StockMovement
        {
            Type = input.Type,
            ProjectId = input.ProjectId,
            Date = input.Date,
            Notes = string.IsNullOrWhiteSpace(input.Notes) ? null : input.Notes.Trim(),
            CreatedById = CurrentUserId,
            Lines = input.Items.Select(l => new StockMovementLine
            {
                ItemId = l.ItemId,
                Quantity = l.Quantity,
                UnitCost = unitCost[l.ItemId],
            }).ToList(),
        };
        db.StockMovements.Add(movement);
        await db.SaveChangesAsync();

        var detail = await LoadDetail(movement.Id);
        return CreatedAtAction(nameof(GetMovement), new { id = movement.Id }, detail);
    }

    // DELETE /api/stock/movements/5  → undo a movement (managers + procurement).
    // Blocked if the material has moved on since (e.g. already returned or re-sent).
    [Authorize(Roles = Roles.Procurement)]
    [HttpDelete("movements/{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var movement = await db.StockMovements
            .Include(m => m.Lines)
            .FirstOrDefaultAsync(m => m.Id == id);
        if (movement is null) return NotFound();

        // The exact opposite of what the movement did.
        var sign = movement.Type == StockMovementTypes.Issue ? -1 : 1;
        var delta = new Dictionary<StockKey, int>();
        foreach (var l in movement.Lines)
        {
            StockService.Add(delta, movement.ProjectId, l.ItemId, sign * l.Quantity);
            StockService.Add(delta, null, l.ItemId, -sign * l.Quantity);
        }
        var shortfall = await stock.Apply(delta);
        if (shortfall is not null)
            return Conflict(new { message = $"Can't delete — this material has moved since. {shortfall}" });

        db.StockMovements.Remove(movement); // cascade removes its lines
        await db.SaveChangesAsync();
        return NoContent();
    }

    // --- helpers ---

    private async Task<StockMovementDetailDto?> LoadDetail(int id)
    {
        var m = await db.StockMovements.AsNoTracking()
            .Include(x => x.Project)
            .Include(x => x.CreatedBy)
            .Include(x => x.Lines).ThenInclude(l => l.Item)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return null;

        var lines = m.Lines.OrderBy(l => l.Id).Select(l => new StockMovementLineDto(
            l.Id,
            l.ItemId,
            l.Item?.Name ?? "",
            l.Item?.Code ?? "",
            l.Item?.Unit ?? "",
            l.Quantity,
            l.UnitCost,
            l.Quantity * l.UnitCost)).ToList();

        return new StockMovementDetailDto(
            m.Id,
            m.Type,
            m.ProjectId,
            m.Project?.Name ?? "",
            m.Project?.Code ?? "",
            m.Date,
            m.Notes,
            m.CreatedBy?.FullName ?? "",
            m.CreatedAt,
            lines.Sum(l => l.LineTotal),
            lines);
    }
}
