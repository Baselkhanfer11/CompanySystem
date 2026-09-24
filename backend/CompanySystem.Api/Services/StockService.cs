using CompanySystem.Api.Data;
using CompanySystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CompanySystem.Api.Services;

// A place stock can be: the warehouse (ProjectId = null) or a project's site.
public readonly record struct StockKey(int? ProjectId, int ItemId);

// How much of one item is on one site, and what it cost the project.
public record SiteBalance(int ProjectId, int ItemId, int Quantity, decimal Value);

/// <summary>
/// The one place that knows where stock is and moves it.
///   - Warehouse stock is stored on the item (<see cref="Item.Quantity"/>).
///   - Site stock is never stored: it's worked out from the records —
///     purchases delivered to the site + issues to it − returns from it.
///     So it can never drift out of step with the history.
/// </summary>
public class StockService(AppDbContext db)
{
    // Every site balance, optionally narrowed to one project and/or some items.
    public async Task<List<SiteBalance>> SiteBalances(int? projectId = null, IReadOnlyCollection<int>? itemIds = null)
    {
        var purchaseLines = db.PurchaseItems.Where(li => li.Purchase!.ProjectId != null);
        var movementLines = db.StockMovementLines.AsQueryable();
        if (projectId is int pid)
        {
            purchaseLines = purchaseLines.Where(li => li.Purchase!.ProjectId == pid);
            movementLines = movementLines.Where(l => l.StockMovement!.ProjectId == pid);
        }
        if (itemIds is not null)
        {
            var ids = itemIds.ToList();
            purchaseLines = purchaseLines.Where(li => ids.Contains(li.ItemId));
            movementLines = movementLines.Where(l => ids.Contains(l.ItemId));
        }

        // Summed in the database, then combined here.
        var delivered = await purchaseLines
            .GroupBy(li => new { ProjectId = li.Purchase!.ProjectId!.Value, li.ItemId })
            .Select(g => new { g.Key.ProjectId, g.Key.ItemId, Qty = g.Sum(li => li.Quantity), Value = g.Sum(li => li.Quantity * li.UnitPrice) })
            .ToListAsync();
        var moved = await movementLines
            .GroupBy(l => new { l.StockMovement!.ProjectId, l.ItemId, l.StockMovement.Type })
            .Select(g => new { g.Key.ProjectId, g.Key.ItemId, g.Key.Type, Qty = g.Sum(l => l.Quantity), Value = g.Sum(l => l.Quantity * l.UnitCost) })
            .ToListAsync();

        var totals = new Dictionary<(int ProjectId, int ItemId), (int Qty, decimal Value)>();
        void Add(int project, int item, int qty, decimal value)
        {
            var cur = totals.GetValueOrDefault((project, item));
            totals[(project, item)] = (cur.Qty + qty, cur.Value + value);
        }
        foreach (var d in delivered) Add(d.ProjectId, d.ItemId, d.Qty, d.Value);
        foreach (var m in moved)
        {
            var sign = m.Type == StockMovementTypes.Return ? -1 : 1; // returns leave the site
            Add(m.ProjectId, m.ItemId, sign * m.Qty, sign * m.Value);
        }

        return totals.Select(t => new SiteBalance(t.Key.ProjectId, t.Key.ItemId, t.Value.Qty, t.Value.Value)).ToList();
    }

    // Adds a quantity to a delta (the same item/place can appear on several lines).
    public static void Add(Dictionary<StockKey, int> delta, int? projectId, int itemId, int qty)
    {
        var key = new StockKey(projectId, itemId);
        delta[key] = delta.GetValueOrDefault(key) + qty;
    }

    // Moves stock by the given amounts. Everything is checked first: if ANY
    // place would drop below zero, nothing changes and a readable explanation
    // is returned instead. Returns null on success.
    // Only the warehouse is written here — site stock follows from the records
    // the caller saves (purchases / movements).
    public async Task<string?> Apply(Dictionary<StockKey, int> delta)
    {
        var changes = delta.Where(d => d.Value != 0).ToList();
        if (changes.Count == 0) return null;

        var itemIds = changes.Select(c => c.Key.ItemId).Distinct().ToList();
        var items = await db.Items.Where(i => itemIds.Contains(i.Id)).ToDictionaryAsync(i => i.Id);

        // Only places losing stock need checking.
        var siteTakes = changes.Where(c => c.Key.ProjectId is not null && c.Value < 0).ToList();
        var balances = new Dictionary<(int, int), int>();
        var siteNames = new Dictionary<int, string>();
        if (siteTakes.Count > 0)
        {
            var takeItems = siteTakes.Select(c => c.Key.ItemId).Distinct().ToList();
            balances = (await SiteBalances(itemIds: takeItems)).ToDictionary(b => (b.ProjectId, b.ItemId), b => b.Quantity);
            var projectIds = siteTakes.Select(c => c.Key.ProjectId!.Value).Distinct().ToList();
            siteNames = await db.Projects.Where(p => projectIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name);
        }

        var shortfalls = new List<string>();
        foreach (var (key, qty) in changes.Where(c => c.Value < 0))
        {
            var item = items[key.ItemId];
            var have = key.ProjectId is int pid ? balances.GetValueOrDefault((pid, key.ItemId)) : item.Quantity;
            if (have + qty >= 0) continue;
            var place = key.ProjectId is int p ? $"the {siteNames.GetValueOrDefault(p, "project")} site" : "the warehouse";
            shortfalls.Add($"{item.Name}: needs {-qty} {item.Unit} from {place}, but only {have} {item.Unit} there.");
        }
        if (shortfalls.Count > 0) return string.Join(" ", shortfalls);

        foreach (var (key, qty) in changes.Where(c => c.Key.ProjectId is null))
            items[key.ItemId].Quantity += qty;
        return null;
    }
}
