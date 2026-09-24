using CompanySystem.Api.Auth;
using CompanySystem.Api.Data;
using CompanySystem.Api.Dtos;
using CompanySystem.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CompanySystem.Api.Controllers;

/// <summary>
/// Read-only cost reports built from purchases and stock movements. This is
/// financial data, so only managers (CEO + head manager) can see it.
/// See ReportDtos.cs for how a project's cost is worked out.
/// </summary>
[ApiController]
[Authorize(Roles = Roles.Managers)]
[Route("api/reports")] // → /api/reports/...
public class ReportsController(AppDbContext db) : ControllerBase
{
    // The id used in the URL for the Warehouse bucket (purchases delivered to
    // the warehouse). Real project ids start at 1, so 0 never clashes.
    private const int WarehouseId = 0;

    private const int TopItems = 10;
    private const int RecentCount = 5;

    // One pre-summed slice of cost: which bucket (project id, or WarehouseId),
    // where it came from (a supplier, or null = sent from the warehouse), which
    // item and month. Returns are negative.
    private record Entry(int Bucket, int? SupplierId, int ItemId, int Year, int Month, int Qty, decimal Value);

    // GET /api/reports/project-costs?from=2026-01-01&to=2026-09-24
    // Both dates are optional and inclusive (whole days). No dates = all time.
    [HttpGet("project-costs")]
    public async Task<ActionResult<ProjectCostsReportDto>> ProjectCosts([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        if (from > to) return BadRequest(new { message = "'from' must be on or before 'to'." });

        var entries = await Entries(from, to);

        var purchaseCounts = await Purchases(from, to)
            .GroupBy(p => p.ProjectId)
            .Select(g => new { ProjectId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ProjectId ?? WarehouseId, x => x.Count);
        var movementCounts = await Movements(from, to)
            .GroupBy(m => m.ProjectId)
            .Select(g => new { ProjectId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ProjectId, x => x.Count);

        // Group once (instead of scanning every entry for every project).
        var byBucket = entries.ToLookup(e => e.Bucket);
        ProjectCostRowDto Row(int? id, string name, string? code, string? status)
        {
            var bucket = id ?? WarehouseId;
            var mine = byBucket[bucket].ToList();
            var delivered = mine.Where(e => e.SupplierId is not null).Sum(e => e.Value);
            var fromWarehouse = mine.Where(e => e.SupplierId is null).Sum(e => e.Value);
            return new(id, name, code, status, delivered + fromWarehouse, delivered, fromWarehouse,
                purchaseCounts.GetValueOrDefault(bucket), movementCounts.GetValueOrDefault(bucket));
        }

        // Every project is listed (even at zero), most expensive first.
        var projects = await db.Projects.AsNoTracking().ToListAsync();
        var rows = projects
            .Select(p => Row(p.Id, p.Name, p.Code, p.Status))
            .OrderByDescending(r => r.Total)
            .ThenBy(r => r.Name)
            .ToList();
        var warehouse = Row(null, "Warehouse", null, null);

        var projectEntries = entries.Where(e => e.Bucket != WarehouseId).ToList();
        return Ok(new ProjectCostsReportDto(
            rows.Sum(r => r.Total),
            entries.Where(e => e.SupplierId is not null).Sum(e => e.Value),
            warehouse.Total,
            entries.Where(e => e.SupplierId is null).Sum(e => e.Value),
            purchaseCounts.Values.Sum(),
            movementCounts.Values.Sum(),
            rows,
            warehouse,
            Monthly(projectEntries, from, to)));
    }

    // GET /api/reports/project-costs/5?from=...&to=...   (use 0 for the Warehouse)
    // Drill-down: where one project's money went.
    [HttpGet("project-costs/{projectId:int}")]
    public async Task<ActionResult<ProjectCostDetailDto>> ProjectCostDetail(int projectId, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        if (from > to) return BadRequest(new { message = "'from' must be on or before 'to'." });

        Project? project = null;
        if (projectId != WarehouseId)
        {
            project = await db.Projects.FindAsync(projectId);
            if (project is null) return NotFound();
        }

        var entries = (await Entries(from, to)).Where(e => e.Bucket == projectId).ToList();

        // This bucket's purchases (to the site, or to the warehouse) and movements.
        int? pid = project?.Id;
        var purchases = Purchases(from, to).Where(p => p.ProjectId == pid);
        var movements = Movements(from, to).Where(m => m.ProjectId == projectId);

        // Where the money came from: each supplier, plus the warehouse.
        var supplierCounts = await purchases
            .GroupBy(p => p.SupplierId)
            .Select(g => new { SupplierId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SupplierId, x => x.Count);
        var movementCount = await movements.CountAsync();
        var supplierIds = entries.Where(e => e.SupplierId is not null).Select(e => e.SupplierId!.Value).Distinct().ToList();
        var supplierNames = await db.Suppliers.Where(s => supplierIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, s => s.Name);
        var bySource = entries
            .GroupBy(e => e.SupplierId)
            .Select(g => new CostSourceDto(
                g.Key,
                g.Key is int sid ? supplierNames.GetValueOrDefault(sid, "") : "Warehouse",
                g.Sum(e => e.Value),
                g.Key is int s ? supplierCounts.GetValueOrDefault(s) : movementCount))
            .OrderByDescending(s => s.Total)
            .ToList();

        // The items that cost the most (net of returns).
        var itemIds = entries.Select(e => e.ItemId).Distinct().ToList();
        var items = await db.Items.Where(i => itemIds.Contains(i.Id)).ToDictionaryAsync(i => i.Id);
        var byItem = entries
            .GroupBy(e => e.ItemId)
            .Select(g => new ItemSpendDto(g.Key, items[g.Key].Name, items[g.Key].Code, items[g.Key].Unit, g.Sum(e => e.Qty), g.Sum(e => e.Value)))
            .Where(i => i.Quantity != 0 || i.Total != 0)
            .OrderByDescending(i => i.Total)
            .Take(TopItems)
            .ToList();

        // The latest few purchases and movements.
        var recentPurchases = await purchases.AsNoTracking()
            .OrderByDescending(p => p.Date)
            .ThenByDescending(p => p.Id)
            .Take(RecentCount)
            .Select(PurchaseListDto.Projection)
            .ToListAsync();
        var recentMovements = await movements.AsNoTracking()
            .OrderByDescending(m => m.Date)
            .ThenByDescending(m => m.Id)
            .Take(RecentCount)
            .Select(StockMovementListDto.Projection)
            .ToListAsync();

        return Ok(new ProjectCostDetailDto(
            project?.Id,
            project?.Name ?? "Warehouse",
            project?.Code,
            project?.Status,
            entries.Sum(e => e.Value),
            supplierCounts.Values.Sum(),
            movementCount,
            bySource,
            byItem,
            Monthly(entries, from, to),
            recentPurchases,
            recentMovements.Select(m => m.WithUniqueItemNames()).ToList()));
    }

    // --- helpers ---

    // Every cost in the period, summed by the database per bucket, source, item
    // and month (so only a small number of rows come back).
    private async Task<List<Entry>> Entries(DateTime? from, DateTime? to)
    {
        var bought = await Lines(from, to)
            .GroupBy(li => new { li.Purchase!.ProjectId, li.Purchase.SupplierId, li.ItemId, li.Purchase.Date.Year, li.Purchase.Date.Month })
            .Select(g => new
            {
                g.Key.ProjectId, g.Key.SupplierId, g.Key.ItemId, g.Key.Year, g.Key.Month,
                Qty = g.Sum(li => li.Quantity),
                Value = g.Sum(li => li.Quantity * li.UnitPrice),
            })
            .ToListAsync();

        var moved = await MovementLines(from, to)
            .GroupBy(l => new { l.StockMovement!.ProjectId, l.StockMovement.Type, l.ItemId, l.StockMovement.Date.Year, l.StockMovement.Date.Month })
            .Select(g => new
            {
                g.Key.ProjectId, g.Key.Type, g.Key.ItemId, g.Key.Year, g.Key.Month,
                Qty = g.Sum(l => l.Quantity),
                Value = g.Sum(l => l.Quantity * l.UnitCost),
            })
            .ToListAsync();

        var entries = bought
            .Select(b => new Entry(b.ProjectId ?? WarehouseId, b.SupplierId, b.ItemId, b.Year, b.Month, b.Qty, b.Value))
            .ToList();
        foreach (var m in moved)
        {
            var sign = m.Type == StockMovementTypes.Return ? -1 : 1; // returns credit the project
            entries.Add(new Entry(m.ProjectId, null, m.ItemId, m.Year, m.Month, sign * m.Qty, sign * m.Value));
        }
        return entries;
    }

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

    // Stock movements whose date falls inside [from, to].
    private IQueryable<StockMovement> Movements(DateTime? from, DateTime? to)
    {
        var q = db.StockMovements.AsQueryable();
        if (from is DateTime f) { var start = f.Date; q = q.Where(m => m.Date >= start); }
        if (to is DateTime t) { var end = t.Date.AddDays(1); q = q.Where(m => m.Date < end); }
        return q;
    }

    // Movement lines whose movement falls inside [from, to].
    private IQueryable<StockMovementLine> MovementLines(DateTime? from, DateTime? to)
    {
        var q = db.StockMovementLines.AsQueryable();
        if (from is DateTime f) { var start = f.Date; q = q.Where(l => l.StockMovement!.Date >= start); }
        if (to is DateTime t) { var end = t.Date.AddDays(1); q = q.Where(l => l.StockMovement!.Date < end); }
        return q;
    }

    // Sums cost per calendar month, then fills in empty months with 0 so the
    // trend chart never silently skips a month.
    private static List<MonthlySpendDto> Monthly(IEnumerable<Entry> entries, DateTime? from, DateTime? to)
    {
        var byMonth = entries
            .GroupBy(e => (e.Year, e.Month))
            .ToDictionary(g => g.Key, g => g.Sum(e => e.Value));

        // "All time" with nothing recorded: nothing to chart.
        if (byMonth.Count == 0 && from is null) return [];

        var months = byMonth.Keys.Select(k => new DateTime(k.Year, k.Month, 1)).ToList();
        var start = MonthStart(from ?? months.Min());
        var end = MonthStart(to ?? DateTime.UtcNow);
        if (months.Count > 0 && months.Max() > end) end = months.Max(); // records dated in the future

        var result = new List<MonthlySpendDto>();
        for (var m = start; m <= end; m = m.AddMonths(1))
            result.Add(new MonthlySpendDto(m.Year, m.Month, byMonth.GetValueOrDefault((m.Year, m.Month))));
        return result;
    }

    private static DateTime MonthStart(DateTime d) => new(d.Year, d.Month, 1);
}
