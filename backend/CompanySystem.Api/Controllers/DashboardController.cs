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
/// The home dashboard in ONE request. Everything here is read-only, so every
/// query uses AsNoTracking() and selects only the columns it shows.
/// Money (project costs) is only included for managers.
/// </summary>
[ApiController]
[Authorize]
[Route("api/dashboard")]
public class DashboardController(AppDbContext db, StockService stock) : ControllerBase
{
    private const int RecentEmployees = 5;
    private const int ActivityCount = 8;

    // GET /api/dashboard
    [HttpGet]
    public async Task<ActionResult<DashboardDto>> Get()
    {
        // ---- team ----
        var employees = await db.Employees.CountAsync();
        var activeEmployees = await db.Employees.CountAsync(e => e.IsActive);
        var recentEmployees = await db.Employees.AsNoTracking()
            .OrderByDescending(e => e.Id)
            .Take(RecentEmployees)
            .Select(e => new RecentEmployeeDto(e.Id, e.FullName, e.Position, e.Email))
            .ToListAsync();

        // ---- project costs: this month vs last month (managers only) ----
        decimal? costThisMonth = null, costLastMonth = null;
        if (Roles.Managers.Split(',').Any(User.IsInRole))
        {
            var now = DateTime.UtcNow;
            var thisMonth = new DateTime(now.Year, now.Month, 1);
            costThisMonth = await ProjectCost(thisMonth, thisMonth.AddMonths(1));
            costLastMonth = await ProjectCost(thisMonth.AddMonths(-1), thisMonth);
        }

        return Ok(new DashboardDto(
            employees,
            activeEmployees,
            recentEmployees,
            await db.Projects.CountAsync(p => p.Status == ProjectStatuses.Active),
            costThisMonth,
            costLastMonth,
            await ProjectProgress(),
            await Activity()));
    }

    // What projects cost in [start, end): delivered straight to a site +
    // sent from the warehouse − returned. Summed by the database.
    private async Task<decimal> ProjectCost(DateTime start, DateTime end)
    {
        var delivered = await db.PurchaseItems
            .Where(li => li.Purchase!.ProjectId != null && li.Purchase.Date >= start && li.Purchase.Date < end)
            .SumAsync(li => li.Quantity * li.UnitPrice);
        var moved = await db.StockMovementLines
            .Where(l => l.StockMovement!.Date >= start && l.StockMovement.Date < end)
            .SumAsync(l => l.StockMovement!.Type == StockMovementTypes.Return ? -(l.Quantity * l.UnitCost) : l.Quantity * l.UnitCost);
        return delivered + moved;
    }

    // Every open (not completed) project with its material-plan progress.
    private async Task<List<ProjectProgressDto>> ProjectProgress()
    {
        var projects = await db.Projects.AsNoTracking()
            .Where(p => p.Status != ProjectStatuses.Completed)
            .Select(p => new { p.Id, p.Name, p.Code, p.Status })
            .ToListAsync();
        var plans = await db.ProjectMaterials.AsNoTracking()
            .Select(m => new { m.ProjectId, m.ItemId, m.PlannedQuantity, m.Item!.Price })
            .ToListAsync();
        var onSite = await stock.SiteBalances(); // all sites, one pass

        var onSiteQty = onSite.ToDictionary(b => (b.ProjectId, b.ItemId), b => b.Quantity);
        var plansByProject = plans.ToLookup(m => m.ProjectId);
        var itemsOnSite = onSite.Where(b => b.Quantity > 0).GroupBy(b => b.ProjectId).ToDictionary(g => g.Key, g => g.Count());

        return projects
            .Select(p =>
            {
                var plan = plansByProject[p.Id].ToList();
                var (_, still, progress) = PlanMath.Summarize(plan.Select(m =>
                    new PlanPoint(m.PlannedQuantity, onSiteQty.GetValueOrDefault((p.Id, m.ItemId)), m.Price)));
                return new ProjectProgressDto(p.Id, p.Name, p.Code, p.Status, plan.Count > 0, progress, still, itemsOnSite.GetValueOrDefault(p.Id));
            })
            .OrderBy(p => p.Status == ProjectStatuses.Active ? 0 : 1) // active first, then on hold
            .ThenBy(p => p.Name)
            .ToList();
    }

    // The latest purchases and movements, merged newest first.
    private async Task<List<ActivityDto>> Activity()
    {
        var purchases = await db.Purchases.AsNoTracking()
            .OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id)
            .Take(ActivityCount)
            .Select(p => new ActivityDto(
                "Purchase",
                p.Id,
                p.CreatedBy!.FullName,
                p.Supplier!.Name,
                p.Project != null ? p.Project.Name : null,
                p.Items.Select(li => li.Item!.Name).ToList(),
                p.Items.Sum(li => li.Quantity * li.UnitPrice),
                p.CreatedAt))
            .ToListAsync();

        var movements = await db.StockMovements.AsNoTracking()
            .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id)
            .Take(ActivityCount)
            .Select(m => new ActivityDto(
                m.Type,
                m.Id,
                m.CreatedBy!.FullName,
                null,
                m.Project!.Name,
                m.Lines.Select(l => l.Item!.Name).ToList(),
                m.Lines.Sum(l => l.Quantity * l.UnitCost),
                m.CreatedAt))
            .ToListAsync();

        return purchases.Concat(movements)
            .OrderByDescending(a => a.CreatedAt)
            .Take(ActivityCount)
            .Select(a => a with { Items = a.Items.Distinct().ToList() })
            .ToList();
    }
}
