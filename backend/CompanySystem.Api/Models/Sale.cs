using System.ComponentModel.DataAnnotations;
using CompanySystem.Api.Services;

namespace CompanySystem.Api.Models;

/// <summary>
/// A sale of warehouse material to a customer. It starts as an <b>order</b>
/// (nothing moves yet), is <b>delivered</b> in one go (the lines leave the
/// warehouse at that moment — see SalesController.Deliver), and is paid for
/// with one or more <see cref="SalePayment"/>s. An order can be cancelled; a
/// delivery can be undone while nothing has been paid. Nothing is ever hard-deleted.
/// </summary>
public class Sale
{
    public int Id { get; set; }

    // Who we sold to.
    public int CustomerId { get; set; }
    public Customer? Customer { get; set; }

    // The customer's order number or our invoice number, if any.
    [MaxLength(TextLimits.Short)]
    public string? Reference { get; set; }

    // The order date (entered by the user, may differ from CreatedAt).
    public DateTime Date { get; set; } = DateTime.UtcNow;

    [MaxLength(TextLimits.Notes)]
    public string? Notes { get; set; }

    // Where it is. One of SaleStatuses.
    [MaxLength(TextLimits.Short)]
    public string Status { get; set; } = SaleStatuses.Ordered;

    // Set when the material left the warehouse (and cleared again if that is undone).
    public DateTime? DeliveredAt { get; set; }
    public int? DeliveredById { get; set; }
    public User? DeliveredBy { get; set; }

    // Set when the order was cancelled.
    public DateTime? CancelledAt { get; set; }
    public int? CancelledById { get; set; }
    public User? CancelledBy { get; set; }

    // Who recorded the order.
    public int CreatedById { get; set; }
    public User? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<SaleItem> Items { get; set; } = new();
    public List<SalePayment> Payments { get; set; } = new();
}

/// <summary>
/// One line on a sale: a warehouse item, how many, and the selling price per
/// unit (typed on the sale; the item's price is only the starting suggestion).
/// </summary>
public class SaleItem
{
    public int Id { get; set; }

    public int SaleId { get; set; }
    public Sale? Sale { get; set; }

    public int ItemId { get; set; }
    public Item? Item { get; set; }

    public int Quantity { get; set; }

    // The selling price per unit on this sale.
    public decimal UnitPrice { get; set; }
}

/// <summary>Money received against a sale. Several are allowed (a deposit, the rest later).</summary>
public class SalePayment
{
    public int Id { get; set; }

    public int SaleId { get; set; }
    public Sale? Sale { get; set; }

    // When the money came in (entered by the user).
    public DateTime Date { get; set; } = DateTime.UtcNow;

    public decimal Amount { get; set; }

    // Optional: cheque number, bank reference, "cash"…
    [MaxLength(TextLimits.Notes)]
    public string? Note { get; set; }

    // Who recorded it.
    public int RecordedById { get; set; }
    public User? RecordedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>The states a sale moves through. Plain strings, like every other status.</summary>
public static class SaleStatuses
{
    public const string Ordered = "Ordered";     // recorded; the material is still in the warehouse
    public const string Delivered = "Delivered"; // the material has left the warehouse
    public const string Cancelled = "Cancelled"; // called off before delivery

    public static readonly string[] All = { Ordered, Delivered, Cancelled };

    public static bool IsValid(string status) => Array.IndexOf(All, status) >= 0;
}

/// <summary>
/// How much of a sale has been paid. Never stored — worked out from the total
/// and the payments, so it can't drift.
/// </summary>
public static class PaymentStatuses
{
    public const string Unpaid = "Unpaid";
    public const string PartlyPaid = "PartlyPaid";
    public const string Paid = "Paid";

    public static string For(decimal total, decimal paid) =>
        paid <= 0 ? Unpaid :
        paid >= total ? Paid :
        PartlyPaid;
}
