using System.ComponentModel.DataAnnotations;
using CompanySystem.Api.Services;

namespace CompanySystem.Api.Models;

/// <summary>
/// Material moving between the warehouse and a project site. An Issue sends
/// stock from the warehouse to the site (the project is charged); a Return
/// brings leftovers back (the project is credited). Each movement has one or
/// more <see cref="StockMovementLine"/>s.
///
/// Where stock is:
///   - Warehouse = <see cref="Item.Quantity"/>.
///   - A site    = purchases delivered to that project + issues − returns
///                 (worked out from these records, see StockService).
/// </summary>
public class StockMovement
{
    public int Id { get; set; }

    // One of StockMovementTypes.
    [MaxLength(TextLimits.Short)]
    public string Type { get; set; } = StockMovementTypes.Issue;

    // The site the material went to (Issue) or came back from (Return).
    public int ProjectId { get; set; }
    public Project? Project { get; set; }

    // When the material actually moved (entered by the user).
    public DateTime Date { get; set; } = DateTime.UtcNow;

    [MaxLength(TextLimits.Notes)]
    public string? Notes { get; set; }

    // Who recorded the movement.
    public int CreatedById { get; set; }
    public User? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<StockMovementLine> Lines { get; set; } = new();
}

/// <summary>
/// One item on a movement. Value and UnitCost are snapshots taken when the
/// movement was recorded, so later price changes never rewrite the past.
///   Issue  → the item's price today; Value = Quantity × UnitCost.
///   Return → Value is the exact share of what that item on the site is worth
///            (returning everything takes off exactly that worth, to the cent),
///            and UnitCost is just Value ÷ Quantity, for display.
/// Every cost figure is summed from Value, never from Quantity × UnitCost:
/// a unit cost is rounded to 4 decimals, and rounding × quantity leaves cents
/// behind — or takes too many, leaving a site worth less than nothing.
/// </summary>
public class StockMovementLine
{
    public int Id { get; set; }

    public int StockMovementId { get; set; }
    public StockMovement? StockMovement { get; set; }

    public int ItemId { get; set; }
    public Item? Item { get; set; }

    public int Quantity { get; set; }

    public decimal UnitCost { get; set; }

    // What this line cost (Issue) or credited (Return) the project, in total.
    public decimal Value { get; set; }
}

public static class StockMovementTypes
{
    public const string Issue = "Issue";   // warehouse → site
    public const string Return = "Return"; // site → warehouse

    public static readonly string[] All = { Issue, Return };

    public static bool IsValid(string type) => Array.IndexOf(All, type) >= 0;
}
