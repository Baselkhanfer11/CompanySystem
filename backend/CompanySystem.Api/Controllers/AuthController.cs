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
    // POST /api/auth/login  (the only endpoint open to everyone)
    [AllowAnonymous]
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
        if (!await AccountRules.UsableLogins(db).AnyAsync(u => u.Id == user.Id))
            return Unauthorized(new { message = "This account is currently disabled. Contact an administrator." });

        var (token, expiresAt) = tokens.Create(user);
        return Ok(new AuthResponse(token, expiresAt, UserDto.From(user)));
    }

    // GET /api/auth/me  → who am I? (A switched-off or changed account never gets
    // this far: every request re-checks the account, see Program.cs.)
    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> Me()
    {
        var id = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FindAsync(id);
        return user is null ? Unauthorized() : Ok(UserDto.From(user));
    }

    // PUT /api/auth/password  → change your own password
    [Authorize]
    [HttpPut("password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest req)
    {
        var id = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FindAsync(id);
        if (user is null)
            return Unauthorized();

        // 400, not 401: a wrong current password must not sign the user out.
        if (hasher.VerifyHashedPassword(user, user.PasswordHash, req.CurrentPassword ?? "") == PasswordVerificationResult.Failed)
            return BadRequest(new { message = "Your current password is wrong." });
        if (AccountRules.PasswordProblem(req.NewPassword) is { } problem)
            return BadRequest(new { message = problem });

        user.PasswordHash = hasher.HashPassword(user, req.NewPassword);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
