namespace CompanySystem.Api.Models;

/// <summary>
/// An employee of the company. Each Employee becomes a row in the "Employees" table.
/// </summary>
public class Employee
{
    // Primary key — EF Core auto-detects "Id" and makes it auto-incrementing.
    public int Id { get; set; }

    // Required text. "= string.Empty" avoids null-warnings (Nullable is enabled).
    public string FullName { get; set; } = string.Empty;

    // Optional fields — the "?" means they are allowed to be null (empty).
    public string? Email { get; set; }
    public string? Position { get; set; }

    // When the employee was hired. Defaults to "now" if not provided.
    public DateTime HireDate { get; set; } = DateTime.UtcNow;

    // Simple flag so we can deactivate an employee instead of deleting them.
    public bool IsActive { get; set; } = true;
}
