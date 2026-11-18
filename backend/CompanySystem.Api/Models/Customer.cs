using System.ComponentModel.DataAnnotations;
using CompanySystem.Api.Services;

namespace CompanySystem.Api.Models;

/// <summary>
/// Someone the company sells warehouse material to. Sales are linked back to a
/// customer, so this is the "who we sell to" side — the mirror of Supplier.
/// </summary>
public class Customer
{
    public int Id { get; set; }

    [MaxLength(TextLimits.Name)]
    public string Name { get; set; } = string.Empty;

    // A short unique code for the customer, e.g. "CUS-001".
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

    // Active / Inactive. One of CustomerStatuses.
    [MaxLength(TextLimits.Short)]
    public string Status { get; set; } = CustomerStatuses.Active;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Allowed values for <see cref="Customer.Status"/>. An inactive customer keeps
/// their sales history but isn't offered for new sales.
/// </summary>
public static class CustomerStatuses
{
    public const string Active = "Active";
    public const string Inactive = "Inactive";

    public static readonly string[] All = { Active, Inactive };

    public static bool IsValid(string status) => Array.IndexOf(All, status) >= 0;
}
