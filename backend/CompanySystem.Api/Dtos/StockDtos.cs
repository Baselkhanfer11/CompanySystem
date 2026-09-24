using System.Linq.Expressions;
using CompanySystem.Api.Models;

namespace CompanySystem.Api.Dtos;

// ---- What the frontend sends ----

public record StockMovementLineInputDto(int ItemId, int Quantity);

// Type is "Issue" (warehouse → site) or "Return" (site → warehouse).
public record StockMovementInputDto(
    string Type,
    int ProjectId,
    DateTime Date,
    string? Notes,
    List<StockMovementLineInputDto> Items);

// ---- What the API returns ----

// One line of a movement, briefly: what and how many (e.g. "Safety Helmet · 175 pcs").
public record MovementLineBriefDto(string ItemName, string Unit, int Quantity);

// A row in the movements list (summary only).
public record StockMovementListDto(
    int Id,
    string Type,
    int ProjectId,
    string ProjectName,
    string ProjectCode,
    DateTime Date,
    string? Notes,
    int LineCount,
    IReadOnlyList<MovementLineBriefDto> Lines, // in line order
    decimal Total,
    string CreatedByName,
    DateTime CreatedAt)
{
    // The item names in line order, each once (worked out here, not in SQL,
    // because SQL's DISTINCT would lose the order).
    public IReadOnlyList<string> ItemNames => Lines.Select(l => l.ItemName).Distinct().ToList();

    // Builds a list row inside the database query (use with .Select(...)):
    // only the columns shown are read — no full line or item rows.
    public static readonly Expression<Func<StockMovement, StockMovementListDto>> Projection = m => new StockMovementListDto(
        m.Id,
        m.Type,
        m.ProjectId,
        m.Project!.Name,
        m.Project.Code,
        m.Date,
        m.Notes,
        m.Lines.Count,
        m.Lines.OrderBy(l => l.Id).Select(l => new MovementLineBriefDto(l.Item!.Name, l.Item.Unit, l.Quantity)).ToList(),
        m.Lines.Sum(l => l.Quantity * l.UnitCost),
        m.CreatedBy!.FullName,
        m.CreatedAt);
}

public record StockMovementLineDto(
    int Id,
    int ItemId,
    string ItemName,
    string ItemCode,
    string Unit,
    int Quantity,
    decimal UnitCost,
    decimal LineTotal);

public record StockMovementDetailDto(
    int Id,
    string Type,
    int ProjectId,
    string ProjectName,
    string ProjectCode,
    DateTime Date,
    string? Notes,
    string CreatedByName,
    DateTime CreatedAt,
    decimal Total,
    IReadOnlyList<StockMovementLineDto> Lines);

// How much of one item is on one site right now, and what it cost that project.
public record SiteStockDto(
    int ProjectId,
    string ProjectName,
    string ProjectCode,
    int ItemId,
    string ItemName,
    string ItemCode,
    string Unit,
    int Quantity,
    decimal Value);
