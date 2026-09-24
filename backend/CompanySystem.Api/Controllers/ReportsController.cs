using CompanySystem.Api.Auth;
using CompanySystem.Api.Data;
using CompanySystem.Api.Dtos;
using CompanySystem.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CompanySystem.Api.Controllers;

/// <summary>
/// Read-only spending reports built from purchases. This is financial data,
/// so only managers (CEO + head manager) can see it.
/// </summary>
[ApiController]
[Authorize(Roles = Roles.Managers)]
[Route("api/reports")] // → /api/reports/...
public class ReportsController(AppDbContext db) : ControllerBase
{
    // The id used in the URL for the "General" bucket (purchases with no project).
    // Real project ids start at 1, so 0 never clashes.
    private const int GeneralId = 0;

    private const int TopItems = 10;
    private const int RecentCount = 5;

    // GET /api/reports/project-costs?from=2026-01-01&to=2026-09-24
    // Both dates are optional and inclusive (whole days). No dates = all time.
    [HttpGet("project-costs")]
    public async Task<ActionResult<ProjectCostsReportDto>> ProjectCosts([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        if (from > to) return BadRequest(new { message = "'from' must be on or before 'to'." });

        // Spend per project (null = General), summed in the database.
        var spend = await Lines(from, to)
            .GroupBy(li => li.Purchase!.ProjectId)
            .Select(g => new { ProjectId = g.Key, Total = g.Sum(li => li.Quantity * li.UnitPrice) })
            .ToListAsync();

        // How many purchases each project has, and the most recent one.
        var counts = await Purchases(from, to)
            .GroupBy(p => p.ProjectId)
            .Select(g => new { ProjectId = g.Key, Count = g.Count(), Last = g.Max(p => p.Date) })
            .ToListAsync();

        var spendById = spend.ToDictionary(s => s.ProjectId ?? GeneralId, s => s.Total);
        var countById = counts.ToDictionary(c => c.ProjectId ?? GeneralId);

        ProjectCostRowDto Row(int? id, string name, string? code, string? status)
        {
            var key = id ?? GeneralId;
            var c = countById.GetValueOrDefault(key);
            return new(id, name, code, status, spendById.GetValueOrDefault(key), c?.Count ?? 0, c?.Last);
        }

        // Every project is listed (even with zero spend), biggest spender first.
        var projects = await db.Projects.ToListAsync();
        var rows = projects
            .Select(p => Row(p.Id, p.Name, p.Code, p.Status))
            .OrderByDescending(r => r.Total)
            .ThenBy(r => r.Name)
            .ToList();
        var general = Row(null, "General", null, null);

        var projectSpend = rows.Sum(r => r.Total);
        return Ok(new ProjectCostsReportDto(
            projectSpend + general.Total,
            projectSpend,
            general.Total,
            counts.Sum(c => c.Count),
            rows,
            general,
            await Monthly(Lines(from, to), from, to)));
    }

    // GET /api/reports/project-costs/5?from=...&to=...   (use 0 for General)
    // Drill-down: where one project's money went.
    [HttpGet("project-costs/{projectId:int}")]
    public async Task<ActionResult<ProjectCostDetailDto>> ProjectCostDetail(int projectId, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        if (from > to) return BadRequest(new { message = "'from' must be on or before 'to'." });

        Project? project = null;
        if (projectId != GeneralId)
        {
            project = await db.Projects.FindAsync(projectId);
            if (project is null) return NotFound();
        }

        // Narrow everything to this project (or to purchases with no project).
        IQueryable<PurchaseItem> lines;
        IQueryable<Purchase> purchases;
        if (project is null)
        {
            lines = Lines(from, to).Where(li => li.Purchase!.ProjectId == null);
            purchases = Purchases(from, to).Where(p => p.ProjectId == null);
        }
        else
        {
            var pid = project.Id;
            lines = Lines(from, to).Where(li => li.Purchase!.ProjectId == pid);
            purchases = Purchases(from, to).Where(p => p.ProjectId == pid);
        }

        // Spend by supplier.
        var supplierSpend = await lines
            .GroupBy(li => new { li.Purchase!.SupplierId, li.Purchase.Supplier!.Name })
            .Select(g => new { g.Key.SupplierId, g.Key.Name, Total = g.Sum(li => li.Quantity * li.UnitPrice) })
            .ToListAsync();
        var supplierCounts = await purchases
            .GroupBy(p => p.SupplierId)
            .Select(g => new { SupplierId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SupplierId, x => x.Count);
        var bySupplier = supplierSpend
            .Select(s => new SupplierSpendDto(s.SupplierId, s.Name, s.Total, supplierCounts.GetValueOrDefault(s.SupplierId)))
            .OrderByDescending(s => s.Total)
            .ToList();

        // The items that cost the most.
        var itemSpend = await lines
            .GroupBy(li => new { li.ItemId, li.Item!.Name, li.Item.Code, li.Item.Unit })
            .Select(g => new
            {
                g.Key.ItemId, g.Key.Name, g.Key.Code, g.Key.Unit,
                Quantity = g.Sum(li => li.Quantity),
                Total = g.Sum(li => li.Quantity * li.UnitPrice),
            })
            .ToListAsync();
        var byItem = itemSpend
            .OrderByDescending(i => i.Total)
            .Take(TopItems)
            .Select(i => new ItemSpendDto(i.ItemId, i.Name, i.Code, i.Unit, i.Quantity, i.Total))
            .ToList();

        // The latest few purchases.
        var recentPurchases = await purchases
            .Include(p => p.Supplier)
            .Include(p => p.Project)
            .Include(p => p.CreatedBy)
            .Include(p => p.Items)
            .OrderByDescending(p => p.Date)
            .ThenByDescending(p => p.Id)
            .Take(RecentCount)
            .ToListAsync();

        return Ok(new ProjectCostDetailDto(
            project?.Id,
            project?.Name ?? "General",
            project?.Code,
            project?.Status,
            supplierSpend.Sum(s => s.Total),
            supplierCounts.Values.Sum(),
            bySupplier,
            byItem,
            await Monthly(lines, from, to),
            recentPurchases.Select(PurchaseListDto.From).ToList()));
    }

    // --- helpers ---

    // Purchases whose date falls inside [from, to] (both optional, whole days).
    private IQueryable<Purchase> Purchases(DateTime? from, DateTime? to)
    {
        var q = db.Purchases.AsQueryable();
        if (from is DateTime f) { var start = f.Date; q = q.Where(p => p.Date >= start); }
        if (to is DateTime t) { var end = t.Date.AddDays(1); q = q.Where(p => p.Date < end); }
        return q;
    }

    // Purchase lines whose purchase falls inside [from, to].
    private IQueryable<PurchaseItem> Lines(DateTime? from, DateTime? to)
    {
        var q = db.PurchaseItems.AsQueryable();
        if (from is DateTime f) { var start = f.Date; q = q.Where(li => li.Purchase!.Date >= start); }
        if (to is DateTime t) { var end = t.Date.AddDays(1); q = q.Where(li => li.Purchase!.Date < end); }
        return q;
    }

    // Sums spend per calendar month, then fills in empty months with 0 so the
    // trend chart never silently skips a month.
    private static async Task<List<MonthlySpendDto>> Monthly(IQueryable<PurchaseItem> lines, DateTime? from, DateTime? to)
    {
        var sums = await lines
            .GroupBy(li => new { li.Purchase!.Date.Year, li.Purchase.Date.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Total = g.Sum(li => li.Quantity * li.UnitPrice) })
            .ToListAsync();
        var byMonth = sums.ToDictionary(s => (s.Year, s.Month), s => s.Total);

        // "All time" with no purchases: nothing to chart.
        if (byMonth.Count == 0 && from is null) return [];

        var months = byMonth.Keys.Select(k => new DateTime(k.Year, k.Month, 1)).ToList();
        var start = MonthStart(from ?? months.Min());
        var end = MonthStart(to ?? DateTime.UtcNow);
        if (months.Count > 0 && months.Max() > end) end = months.Max(); // purchases dated in the future

        var result = new List<MonthlySpendDto>();
        for (var m = start; m <= end; m = m.AddMonths(1))
            result.Add(new MonthlySpendDto(m.Year, m.Month, byMonth.GetValueOrDefault((m.Year, m.Month))));
        return result;
    }

    private static DateTime MonthStart(DateTime d) => new(d.Year, d.Month, 1);
}
