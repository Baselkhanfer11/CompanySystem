namespace CompanySystem.Api.Models;

/// <summary>
/// A vendor the company buys materials from. Purchases (supplier invoices) are
/// linked back to a supplier, so this is the "who we buy from" side of costs.
/// </summary>
public class Supplier
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    // A short unique code for the supplier, e.g. "SUP-001".
    public string Code { get; set; } = string.Empty;

    // Optional contact details.
    public string? ContactPerson { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }

    // Optional free-text notes.
    public string? Notes { get; set; }

    // Active / Inactive. One of SupplierStatuses.
    public string Status { get; set; } = SupplierStatuses.Active;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Allowed values for <see cref="Supplier.Status"/>. Simple strings (like the
/// other status sets) so the frontend can show/translate them without a schema change.
/// </summary>
public static class SupplierStatuses
{
    public const string Active = "Active";
    public const string Inactive = "Inactive";

    public static readonly string[] All = { Active, Inactive };

    public static bool IsValid(string status) => Array.IndexOf(All, status) >= 0;
}
