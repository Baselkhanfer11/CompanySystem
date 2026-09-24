namespace CompanySystem.Api.Models;

/// <summary>
/// One entry in a purchase's edit history — who changed it, when, and exactly
/// what changed. The newest entry is also where "last edited by" comes from.
/// (Who first recorded the purchase lives on Purchase.CreatedBy / CreatedAt.)
/// </summary>
public class PurchaseEvent
{
    public int Id { get; set; }

    public int PurchaseId { get; set; }
    public Purchase? Purchase { get; set; }

    // What happened. One of PurchaseActions.
    public string Action { get; set; } = PurchaseActions.Edited;

    // Who did it.
    public int ActorId { get; set; }
    public User? Actor { get; set; }

    // The list of changes, stored as JSON (a list of PurchaseChange).
    // Names are snapshots from the time of the edit, so the history still reads
    // correctly even if a supplier or item is renamed later.
    public string Changes { get; set; } = "[]";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>The kinds of actions recorded in a purchase's history.</summary>
public static class PurchaseActions
{
    public const string Edited = "Edited";
}

/// <summary>
/// One change inside an edit. Kind says which fields are used:
///   Field       → Field + From/To  (supplier, project, date, invoiceNumber, notes)
///   LineAdded   → Item/Unit + ToQty/ToPrice
///   LineRemoved → Item/Unit + FromQty/FromPrice
///   LineChanged → Item/Unit + FromQty/ToQty + FromPrice/ToPrice
/// </summary>
public record PurchaseChange(
    string Kind,
    string? Field = null,
    string? From = null,
    string? To = null,
    string? Item = null,
    string? Unit = null,
    int? FromQty = null,
    int? ToQty = null,
    decimal? FromPrice = null,
    decimal? ToPrice = null);

public static class PurchaseChangeKinds
{
    public const string Field = "Field";
    public const string LineAdded = "LineAdded";
    public const string LineRemoved = "LineRemoved";
    public const string LineChanged = "LineChanged";
}
