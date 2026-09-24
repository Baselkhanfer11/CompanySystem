using System.Linq.Expressions;
using CompanySystem.Api.Models;

namespace CompanySystem.Api.Dtos;

// ---- What the frontend sends ----

// One line on a purchase invoice. When editing, Id identifies an existing
// line; leave it null for a new line (and always null when creating).
public record PurchaseItemInputDto(int ItemId, int Quantity, decimal UnitPrice, int? Id = null);

// A whole purchase (invoice header + its lines).
public record PurchaseInputDto(
    int SupplierId,
    int? ProjectId,
    string? InvoiceNumber,
    DateTime Date,
    string? Notes,
    List<PurchaseItemInputDto> Items);

// ---- What the API returns ----

// A row in the purchases list (summary only).
public record PurchaseListDto(
    int Id,
    int SupplierId,
    string SupplierName,
    int? ProjectId,
    string? ProjectName,
    string? InvoiceNumber,
    DateTime Date,
    int LineCount,
    decimal Total,
    string CreatedByName,
    DateTime CreatedAt)
{
    // Builds a list row inside the database query (use with .Select(...)):
    // SQL counts the lines and adds up the total, so no line rows are loaded.
    public static readonly Expression<Func<Purchase, PurchaseListDto>> Projection = p => new PurchaseListDto(
        p.Id,
        p.SupplierId,
        p.Supplier!.Name,
        p.ProjectId,
        p.Project != null ? p.Project.Name : null,
        p.InvoiceNumber,
        p.Date,
        p.Items.Count,
        p.Items.Sum(li => li.Quantity * li.UnitPrice),
        p.CreatedBy!.FullName,
        p.CreatedAt);
}

// A single line, expanded with item details, for the detail view.
public record PurchaseItemDto(
    int Id,
    int ItemId,
    string ItemName,
    string ItemCode,
    string Unit,
    int Quantity,
    decimal UnitPrice,
    decimal LineTotal);

// One entry in a purchase's edit history.
public record PurchaseEventDto(
    int Id,
    string Action,
    string ActorName,
    DateTime CreatedAt,
    IReadOnlyList<PurchaseChange> Changes);

// The full purchase with all its lines and its edit history (oldest first).
public record PurchaseDetailDto(
    int Id,
    int SupplierId,
    string SupplierName,
    int? ProjectId,
    string? ProjectName,
    string? InvoiceNumber,
    DateTime Date,
    string? Notes,
    string CreatedByName,
    DateTime CreatedAt,
    decimal Total,
    IReadOnlyList<PurchaseItemDto> Items,
    string? LastEditedByName,
    DateTime? LastEditedAt,
    IReadOnlyList<PurchaseEventDto> History);
