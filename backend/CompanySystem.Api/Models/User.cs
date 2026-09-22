namespace CompanySystem.Api.Models;

/// <summary>
/// A login account. Passwords are never stored directly — only a secure hash.
/// </summary>
public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;

    // The hashed password (produced by PasswordHasher). Never the plain text.
    public string PasswordHash { get; set; } = string.Empty;

    // The user's role. See the Roles class for the allowed values.
    public string Role { get; set; } = Auth.Roles.Employee;

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Optional link to an employee. A login account may belong to an employee
    // (created via "Grant access"), or be a standalone account (e.g. the seeded admin).
    public int? EmployeeId { get; set; }
    public Employee? Employee { get; set; }
}
