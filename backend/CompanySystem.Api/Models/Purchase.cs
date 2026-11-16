using System.ComponentModel.DataAnnotations;
using CompanySystem.Api.Services;

namespace CompanySystem.Api.Models;

/// <summary>
/// A purchase = one supplier invoice. It has a header (who we bought from,
/// where it was delivered, the date, an invoice reference) and one or more
/// <see cref="PurchaseItem"/> lines. The material lands where it was delivered:
/// the warehouse (adds to the item's stock) or a project's site (charged to
/// that project straight away).
/// </summary>
public class Purchase
{
    public int Id { get; set; }

    // Who we bought from.
    public int SupplierId { get; set; }
    public Supplier? Supplier { get; set; }

    // Where the material was delivered: a project's site, or null = the warehouse.
    // Delivered to a site = that project's cost; to the warehouse = stock that
    // is charged to a project later, when it's issued (see StockMovement).
    public int? ProjectId { get; set; }
    public Project? Project { get; set; }

    // The supplier's own invoice / reference number, if any.
    [MaxLength(TextLimits.Short)]
    public string? InvoiceNumber { get; set; }

    // When the purchase actually happened (entered by the user, may differ from CreatedAt).
    public DateTime Date { get; set; } = DateTime.UtcNow;

    // Optional free-text notes about the purchase.
    [MaxLength(TextLimits.Notes)]
    public string? Notes { get; set; }

    // Who recorded this purchase in the system.
    public int CreatedById { get; set; }
    public User? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Set when the purchase was deleted. The row stays, with its lines and history,
    // so what was bought (and that it was taken back) is never lost — but a deleted
    // purchase is left out of every query (see AppDbContext) and counts for nothing.
    public DateTime? DeletedAt { get; set; }
    public int? DeletedById { get; set; }
    public User? DeletedBy { get; set; }

    // The invoice lines.
    public List<PurchaseItem> Items { get; set; } = new();
}

/// <summary>
/// A single line on a purchase invoice: one warehouse item, how many were
/// bought, and the unit price actually paid (which may differ from the item's
/// list price). The line total is Quantity * UnitPrice.
/// </summary>
public class PurchaseItem
{
    public int Id { get; set; }

    public int PurchaseId { get; set; }
    public Purchase? Purchase { get; set; }

    // The warehouse item that was bought.
    public int ItemId { get; set; }
    public Item? Item { get; set; }

    public int Quantity { get; set; }

    // The price paid per unit on this purchase.
    public decimal UnitPrice { get; set; }
}
