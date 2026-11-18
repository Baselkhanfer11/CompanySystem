using System.ComponentModel.DataAnnotations;
using System.Linq.Expressions;
using CompanySystem.Api.Json;
using CompanySystem.Api.Models;
using CompanySystem.Api.Services;

namespace CompanySystem.Api.Dtos;

// ---- What the frontend sends ----

// One line on a sale. When editing, Id identifies an existing line; leave it
// null for a new line (and always null when creating).
public record SaleLineInputDto(int ItemId, int Quantity, decimal UnitPrice, int? Id = null);

// A whole sale (header + lines). Creating one records an order; nothing moves yet.
public record SaleInputDto(
    int CustomerId,
    [MaxLength(TextLimits.Short)] string? Reference,
    DateTime Date,
    [MaxLength(TextLimits.Notes)] string? Notes,
    List<SaleLineInputDto> Items);

// Money received against a sale.
public record PaymentInputDto(
    DateTime Date,
    decimal Amount,
    [MaxLength(TextLimits.Notes)] string? Note);

// ---- What the API returns ----

// A row in the sales list.
public record SaleListDto(
    int Id,
    int CustomerId,
    string CustomerName,
    string? Reference,
    DateTime Date,
    string Status,
    string PaymentStatus,
    int LineCount,
    [property: SellingPrice] decimal Total,
    [property: SellingPrice] decimal Paid,
    string CreatedByName,
    DateTime CreatedAt)
{
    // Built inside the database query: SQL counts the lines and adds up the
    // total and the payments, so no line or payment rows are loaded.
    public static readonly Expression<Func<Sale, SaleListDto>> Projection = s => new SaleListDto(
        s.Id,
        s.CustomerId,
        s.Customer!.Name,
        s.Reference,
        s.Date,
        s.Status,
        s.Payments.Sum(p => p.Amount) <= 0 ? PaymentStatuses.Unpaid :
            s.Payments.Sum(p => p.Amount) >= s.Items.Sum(li => li.Quantity * li.UnitPrice) ? PaymentStatuses.Paid :
            PaymentStatuses.PartlyPaid,
        s.Items.Count,
        s.Items.Sum(li => li.Quantity * li.UnitPrice),
        s.Payments.Sum(p => p.Amount),
        s.CreatedBy!.FullName,
        s.CreatedAt);
}

// A single line, expanded with item details, for the detail view.
public record SaleLineDto(
    int Id,
    int ItemId,
    string ItemName,
    string ItemCode,
    string Unit,
    int Quantity,
    [property: SellingPrice] decimal UnitPrice,
    [property: SellingPrice] decimal LineTotal);

// One payment received.
public record SalePaymentDto(
    int Id,
    DateTime Date,
    [property: SellingPrice] decimal Amount,
    string? Note,
    string RecordedByName,
    DateTime CreatedAt);

// One entry in a sale's history.
public record SaleEventDto(
    int Id,
    string Action,
    string ActorName,
    DateTime CreatedAt,
    IReadOnlyList<SaleChange> Changes);

// The full sale: header, where it is, its lines, its payments and its history (oldest first).
public record SaleDetailDto(
    int Id,
    int CustomerId,
    string CustomerName,
    string? Reference,
    DateTime Date,
    string? Notes,
    string Status,
    string PaymentStatus,
    string CreatedByName,
    DateTime CreatedAt,
    string? DeliveredByName,
    DateTime? DeliveredAt,
    string? CancelledByName,
    DateTime? CancelledAt,
    [property: SellingPrice] decimal Total,
    [property: SellingPrice] decimal Paid,
    [property: SellingPrice] decimal Remaining,
    IReadOnlyList<SaleLineDto> Items,
    IReadOnlyList<SalePaymentDto> Payments,
    IReadOnlyList<SaleEventDto> History);
