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
    public string Type { get; set; } = StockMovementTypes.Issue;

    // The site the material went to (Issue) or came back from (Return).
    public int ProjectId { get; set; }
    public Project? Project { get; set; }

    // When the material actually moved (entered by the user).
    public DateTime Date { get; set; } = DateTime.UtcNow;

    public string? Notes { get; set; }

    // Who recorded the movement.
    public int CreatedById { get; set; }
    public User? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<StockMovementLine> Lines { get; set; } = new();
}

/// <summary>
/// One item on a movement. UnitCost is a snapshot taken when the movement was
/// recorded: the item's price for an Issue, and the average cost of that item
/// on the site for a Return — so returning everything cancels the cost out.
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
}

public static class StockMovementTypes
{
    public const string Issue = "Issue";   // warehouse → site
    public const string Return = "Return"; // site → warehouse

    public static readonly string[] All = { Issue, Return };

    public static bool IsValid(string type) => Array.IndexOf(All, type) >= 0;
}
