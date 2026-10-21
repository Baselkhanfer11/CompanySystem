using CompanySystem.Api.Json;

namespace CompanySystem.Api.Dtos;

// What we've paid a supplier for an item — one row per (item, supplier) that
// has ever been bought. Built from the purchase lines, nothing stored twice.
public record SupplierPriceDto(
    int ItemId,
    int SupplierId,
    string SupplierName,
    string SupplierCode,
    bool SupplierActive,
    [property: BuyingPrice] decimal LastPrice,    // the price on the most recent purchase
    DateTime LastDate,
    [property: BuyingPrice] decimal MinPrice,     // the cheapest they've ever sold it for
    [property: BuyingPrice] decimal AvgPrice,     // average paid per unit (weighted by quantity)
    int TimesBought,      // how many purchases it was on
    int TotalQuantity);

// One past purchase of an item (the price-history list).
public record PriceHistoryLineDto(
    int PurchaseId,
    DateTime Date,
    int SupplierId,
    string SupplierName,
    string? InvoiceNumber,
    string? DeliveredTo,  // project name, or null = the warehouse
    int Quantity,
    [property: BuyingPrice] decimal UnitPrice);
