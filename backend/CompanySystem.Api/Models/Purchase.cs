namespace CompanySystem.Api.Models;

/// <summary>
/// A purchase = one supplier invoice. It has a header (who we bought from, an
/// optional project the cost is charged to, the date, an invoice reference) and
/// one or more <see cref="PurchaseItem"/> lines. Recording a purchase restocks
/// the warehouse (each line adds its quantity to the item's stock).
/// </summary>
public class Purchase
{
    public int Id { get; set; }

    // Who we bought from.
    public int SupplierId { get; set; }
    public Supplier? Supplier { get; set; }

    // Optional: the project this purchase is charged to (for cost-per-project).
    // Null means a general purchase (e.g. plain warehouse restocking).
    public int? ProjectId { get; set; }
    public Project? Project { get; set; }

    // The supplier's own invoice / reference number, if any.
    public string? InvoiceNumber { get; set; }

    // When the purchase actually happened (entered by the user, may differ from CreatedAt).
    public DateTime Date { get; set; } = DateTime.UtcNow;

    // Optional free-text notes about the purchase.
    public string? Notes { get; set; }

    // Who recorded this purchase in the system.
    public int CreatedById { get; set; }
    public User? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

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
