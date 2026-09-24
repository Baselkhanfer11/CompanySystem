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
    IReadOnlyList<string> ItemNames,
    decimal Total,
    string CreatedByName,
    DateTime CreatedAt)
{
    // Builds a list row inside the database query (use with .Select(...)):
    // only the columns shown are read — no full line or item rows.
    // Item names come back in line order, repeats included; call
    // WithUniqueItemNames() on the results to drop repeats (SQL's DISTINCT
    // would lose the order).
    public static readonly Expression<Func<StockMovement, StockMovementListDto>> Projection = m => new StockMovementListDto(
        m.Id,
        m.Type,
        m.ProjectId,
        m.Project!.Name,
        m.Project.Code,
        m.Date,
        m.Notes,
        m.Lines.Count,
        m.Lines.OrderBy(l => l.Id).Select(l => l.Item!.Name).ToList(),
        m.Lines.Sum(l => l.Quantity * l.UnitCost),
        m.CreatedBy!.FullName,
        m.CreatedAt);

    public StockMovementListDto WithUniqueItemNames() => this with { ItemNames = ItemNames.Distinct().ToList() };
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
