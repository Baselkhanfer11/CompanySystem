using System.Security.Claims;
using CompanySystem.Api.Auth;
using CompanySystem.Api.Data;
using CompanySystem.Api.Dtos;
using CompanySystem.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace CompanySystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(AppDbContext db, JwtTokenService tokens, IPasswordHasher<User> hasher)
    : ControllerBase
{
    private const string WrongLogin = "Invalid username or password.";

    // A real hash of a throw-away password. Checking a password against it takes
    // as long as checking against a real one, so a sign-in for a username that
    // doesn't exist is as slow as a wrong password — and can't be told apart.
    private static string? _dummyHash;

    // POST /api/auth/login  (the only endpoint open to everyone)
    [AllowAnonymous]
    [EnableRateLimiting("login")] // a few attempts a minute per address, see Program.cs
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Username == req.Username);

        var hash = user?.PasswordHash ?? (_dummyHash ??= hasher.HashPassword(new User(), Guid.NewGuid().ToString()));
        var result = hasher.VerifyHashedPassword(user ?? new User(), hash, req.Password ?? "");

        // One message for every refusal — missing username, wrong password, or a
        // switched-off login — so nobody learns which usernames exist, or whether
        // a disabled account's password was right.
        if (user is null || result == PasswordVerificationResult.Failed
            || !await AccountRules.UsableLogins(db).AnyAsync(u => u.Id == user.Id))
            return Unauthorized(new { message = WrongLogin });

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

    // PUT /api/auth/password  → change your own password. Every sign-in made with
    // the old password stops working (the token carries the password's version),
    // so this is also the way to throw out a stolen sign-in. The reply holds a
    // fresh token for this session, so the user stays signed in here.
    [Authorize]
    [HttpPut("password")]
    public async Task<ActionResult<AuthResponse>> ChangePassword(ChangePasswordRequest req)
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

        var (token, expiresAt) = tokens.Create(user);
        return Ok(new AuthResponse(token, expiresAt, UserDto.From(user)));
    }
}
