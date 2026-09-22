using System.Security.Claims;
using CompanySystem.Api.Auth;
using CompanySystem.Api.Data;
using CompanySystem.Api.Dtos;
using CompanySystem.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CompanySystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(AppDbContext db, JwtTokenService tokens, IPasswordHasher<User> hasher)
    : ControllerBase
{
    // POST /api/auth/login
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Username == req.Username);

        // Same generic message whether the user is missing or the password is wrong
        // (so attackers can't tell which usernames exist).
        if (user is null || !user.IsActive)
            return Unauthorized(new { message = "Invalid username or password." });

        var result = hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password);
        if (result == PasswordVerificationResult.Failed)
            return Unauthorized(new { message = "Invalid username or password." });

        // A login tied to an employee is only valid while that employee is active.
        if (await IsLinkedToInactiveEmployee(user))
            return Unauthorized(new { message = "This account is currently disabled. Contact an administrator." });

        var (token, expiresAt) = tokens.Create(user);
        return Ok(new AuthResponse(token, expiresAt, UserDto.From(user)));
    }

    // GET /api/auth/me  → who am I? (requires a valid token)
    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> Me()
    {
        var id = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FindAsync(id);
        if (user is null || !user.IsActive)
            return Unauthorized();

        // Log out on refresh if the linked employee was deactivated.
        if (await IsLinkedToInactiveEmployee(user))
            return Unauthorized();

        return Ok(UserDto.From(user));
    }

    // True when the user is linked to an employee that no longer exists or is inactive.
    private async Task<bool> IsLinkedToInactiveEmployee(User user) =>
        user.EmployeeId is int empId &&
        !await db.Employees.AnyAsync(e => e.Id == empId && e.IsActive);
}
