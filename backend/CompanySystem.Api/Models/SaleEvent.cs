using System.ComponentModel.DataAnnotations;
using CompanySystem.Api.Json;
using CompanySystem.Api.Services;

namespace CompanySystem.Api.Models;

/// <summary>
/// One entry in a sale's history — who did what, when, and exactly what changed.
/// Same idea as PurchaseEvent, with a few more actions because a sale has a life
/// cycle (delivered, undone, cancelled) and payments.
/// </summary>
public class SaleEvent
{
    public int Id { get; set; }

    public int SaleId { get; set; }
    public Sale? Sale { get; set; }

    // What happened. One of SaleActions.
    [MaxLength(TextLimits.Short)]
    public string Action { get; set; } = SaleActions.Edited;

    // Who did it.
    public int ActorId { get; set; }
    public User? Actor { get; set; }

    // The details, stored as JSON (a list of SaleChange). Names are snapshots
    // from the time of the change, so the history still reads correctly later.
    public string Changes { get; set; } = "[]";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>The kinds of actions recorded in a sale's history.</summary>
public static class SaleActions
{
    public const string Edited = "Edited";
    public const string Delivered = "Delivered";
    public const string DeliveryUndone = "DeliveryUndone";
    public const string Cancelled = "Cancelled";
    public const string PaymentAdded = "PaymentAdded";
    public const string PaymentRemoved = "PaymentRemoved";
}

/// <summary>
/// One change inside a history entry. Kind says which fields are used:
///   Field       → Field + From/To  (customer, date, reference, notes)
///   LineAdded   → Item/Unit + ToQty/ToPrice
///   LineRemoved → Item/Unit + FromQty/FromPrice
///   LineChanged → Item/Unit + FromQty/ToQty + FromPrice/ToPrice
///   Payment     → Amount (+ Note), on PaymentAdded / PaymentRemoved
/// </summary>
public record SaleChange(
    string Kind,
    string? Field = null,
    string? From = null,
    string? To = null,
    string? Item = null,
    string? Unit = null,
    int? FromQty = null,
    int? ToQty = null,
    [property: SellingPrice] decimal? FromPrice = null,
    [property: SellingPrice] decimal? ToPrice = null,
    [property: SellingPrice] decimal? Amount = null,
    string? Note = null);

public static class SaleChangeKinds
{
    public const string Field = "Field";
    public const string LineAdded = "LineAdded";
    public const string LineRemoved = "LineRemoved";
    public const string LineChanged = "LineChanged";
    public const string Payment = "Payment";
}
