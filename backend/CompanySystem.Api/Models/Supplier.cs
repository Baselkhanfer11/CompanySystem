using System.ComponentModel.DataAnnotations;
using CompanySystem.Api.Services;

namespace CompanySystem.Api.Models;

/// <summary>
/// A vendor the company buys materials from. Purchases (supplier invoices) are
/// linked back to a supplier, so this is the "who we buy from" side of costs.
/// </summary>
public class Supplier
{
    public int Id { get; set; }

    [MaxLength(TextLimits.Name)]
    public string Name { get; set; } = string.Empty;

    // A short unique code for the supplier, e.g. "SUP-001".
    [MaxLength(TextLimits.Code)]
    public string Code { get; set; } = string.Empty;

    // Optional contact details.
    [MaxLength(TextLimits.Name)]
    public string? ContactPerson { get; set; }
    [MaxLength(TextLimits.Short)]
    public string? Phone { get; set; }
    [MaxLength(TextLimits.Email)]
    public string? Email { get; set; }
    [MaxLength(TextLimits.Address)]
    public string? Address { get; set; }

    // Optional free-text notes.
    [MaxLength(TextLimits.Notes)]
    public string? Notes { get; set; }

    // Active / Inactive. One of SupplierStatuses.
    [MaxLength(TextLimits.Short)]
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
