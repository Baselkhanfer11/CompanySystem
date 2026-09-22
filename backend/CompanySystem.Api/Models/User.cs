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
}
