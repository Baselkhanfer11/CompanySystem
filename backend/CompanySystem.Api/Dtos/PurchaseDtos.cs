namespace CompanySystem.Api.Dtos;

// ---- What the frontend sends ----

// One line on a new purchase invoice.
public record PurchaseItemInputDto(int ItemId, int Quantity, decimal UnitPrice);

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
    DateTime CreatedAt);

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

// The full purchase with all its lines.
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
    IReadOnlyList<PurchaseItemDto> Items);
