using System.ComponentModel.DataAnnotations;
using CompanySystem.Api.Models;
using CompanySystem.Api.Services;

namespace CompanySystem.Api.Dtos;

// What the frontend sends to log in. (Passwords are capped too: hashing a
// megabyte of text would keep the server busy for nothing.)
public record LoginRequest(
    [MaxLength(TextLimits.Name)] string Username,
    [MaxLength(TextLimits.Name)] string Password);

// A safe view of a user (NO password hash) returned to the frontend.
public record UserDto(int Id, string Username, string FullName, string Role, bool IsActive, DateTime CreatedAt, int? EmployeeId)
{
    public static UserDto From(User u) => new(u.Id, u.Username, u.FullName, u.Role, u.IsActive, u.CreatedAt, u.EmployeeId);
}

// What login returns: the token + who you are + when it expires.
public record AuthResponse(string Token, DateTime ExpiresAt, UserDto User);

// Changing your own password: the current one proves it's really you.
public record ChangePasswordRequest(
    [MaxLength(TextLimits.Name)] string CurrentPassword,
    [MaxLength(TextLimits.Name)] string NewPassword);
