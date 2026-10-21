using CompanySystem.Api.Json;

namespace CompanySystem.Api.Models;

/// <summary>
/// A stock item in the store / warehouse.
/// </summary>
public class Item
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    // A unique product code / SKU.
    public string Code { get; set; } = string.Empty;

    public int Quantity { get; set; }

    // Unit of measure, e.g. "pcs", "box", "kg".
    public string Unit { get; set; } = "pcs";

    [BuyingPrice] // hidden from people who may not see prices (Json/MoneyVisibility.cs)
    public decimal Price { get; set; }

    // Optional logo/photo for the item (set later via image upload).
    public string? ImageUrl { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
