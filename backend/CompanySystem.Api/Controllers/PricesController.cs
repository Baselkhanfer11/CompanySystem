using CompanySystem.Api.Data;
using CompanySystem.Api.Dtos;
using CompanySystem.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CompanySystem.Api.Controllers;

/// <summary>
/// Supplier price history: what we've paid each supplier for each item, read
/// straight from the purchase lines. Used to show who's cheapest and to suggest
/// a supplier when buying. Anyone logged in can look (like purchases).
/// </summary>
[ApiController]
[Authorize]
[Route("api/prices")]
public class PricesController(AppDbContext db) : ControllerBase
{
    // GET /api/prices  → one row per (item, supplier) ever bought
    [HttpGet]
    public async Task<ActionResult<IEnumerable<SupplierPriceDto>>> GetAll()
    {
        // The totals are grouped in SQL...
        var groups = await db.PurchaseItems.AsNoTracking()
            .GroupBy(l => new { l.ItemId, l.Purchase!.SupplierId })
            .Select(g => new
            {
                g.Key.ItemId,
                g.Key.SupplierId,
                MinPrice = g.Min(l => l.UnitPrice),
                Spent = g.Sum(l => l.Quantity * l.UnitPrice),
                Quantity = g.Sum(l => l.Quantity),
                Times = g.Select(l => l.PurchaseId).Distinct().Count(),
                LastDate = g.Max(l => l.Purchase!.Date),
            })
            .ToListAsync();

        // ...and so is each pair's latest price (newest purchase; the later line wins a tie).
        var latest = await db.PurchaseItems.AsNoTracking()
            .Select(l => new { l.ItemId, l.Purchase!.SupplierId, l.Purchase.Date, l.PurchaseId, l.Id, l.UnitPrice })
            .Where(l => !db.PurchaseItems.Any(o =>
                o.ItemId == l.ItemId && o.Purchase!.SupplierId == l.SupplierId &&
                (o.Purchase.Date > l.Date || (o.Purchase.Date == l.Date && o.Id > l.Id))))
            .ToDictionaryAsync(l => (l.ItemId, l.SupplierId), l => l.UnitPrice);

        var suppliers = await db.Suppliers.AsNoTracking()
            .ToDictionaryAsync(s => s.Id, s => new { s.Name, s.Code, Active = s.Status == SupplierStatuses.Active });

        var rows = groups.Select(g =>
        {
            var s = suppliers[g.SupplierId];
            return new SupplierPriceDto(
                g.ItemId, g.SupplierId, s.Name, s.Code, s.Active,
                latest[(g.ItemId, g.SupplierId)], g.LastDate, g.MinPrice,
                g.Quantity > 0 ? Math.Round(g.Spent / g.Quantity, 2) : g.MinPrice,
                g.Times, g.Quantity);
        })
        .OrderBy(r => r.ItemId).ThenBy(r => r.LastPrice);

        return Ok(rows);
    }

    // GET /api/prices/items/5  → every purchase of item 5, newest first
    [HttpGet("items/{itemId:int}")]
    public async Task<ActionResult<IEnumerable<PriceHistoryLineDto>>> GetItemHistory(int itemId)
    {
        if (!await db.Items.AnyAsync(i => i.Id == itemId)) return NotFound();

        var lines = await db.PurchaseItems.AsNoTracking()
            .Where(l => l.ItemId == itemId)
            .OrderByDescending(l => l.Purchase!.Date).ThenByDescending(l => l.Id)
            .Select(l => new PriceHistoryLineDto(
                l.PurchaseId,
                l.Purchase!.Date,
                l.Purchase.SupplierId,
                l.Purchase.Supplier!.Name,
                l.Purchase.InvoiceNumber,
                l.Purchase.Project != null ? l.Purchase.Project.Name : null,
                l.Quantity,
                l.UnitPrice))
            .ToListAsync();

        return Ok(lines);
    }
}
