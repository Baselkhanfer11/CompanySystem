using CompanySystem.Api.Models;

namespace CompanySystem.Api.Dtos;

// What the frontend sends to log in.
public record LoginRequest(string Username, string Password);

// A safe view of a user (NO password hash) returned to the frontend.
public record UserDto(int Id, string Username, string FullName, string Role, bool IsActive, DateTime CreatedAt, int? EmployeeId)
{
    public static UserDto From(User u) => new(u.Id, u.Username, u.FullName, u.Role, u.IsActive, u.CreatedAt, u.EmployeeId);
}

// What login returns: the token + who you are + when it expires.
public record AuthResponse(string Token, DateTime ExpiresAt, UserDto User);
