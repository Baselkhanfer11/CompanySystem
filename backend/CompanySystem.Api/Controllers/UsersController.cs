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
[Authorize(Roles = Roles.Administrator)] // ONLY administrators can manage users
[Route("api/[controller]")]
public class UsersController(AppDbContext db, IPasswordHasher<User> hasher) : ControllerBase
{
    // GET /api/users  → all accounts (never exposes password hashes)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetAll()
    {
        var users = await db.Users.OrderBy(u => u.Id).ToListAsync();
        return Ok(users.Select(UserDto.From));
    }

    // GET /api/users/roles  → the list of assignable roles
    [HttpGet("roles")]
    public ActionResult<IEnumerable<string>> GetRoles() => Ok(Roles.All);

    // POST /api/users  → create an account
    [HttpPost]
    public async Task<ActionResult<UserDto>> Create(CreateUserRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Username))
            return BadRequest(new { message = "Username is required." });
        if (string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { message = "Password is required." });
        if (!Roles.IsValid(req.Role))
            return BadRequest(new { message = "Invalid role." });
        if (await db.Users.AnyAsync(u => u.Username == req.Username))
            return Conflict(new { message = "That username is already taken." });

        var user = new User
        {
            Username = req.Username.Trim(),
            FullName = req.FullName.Trim(),
            Role = req.Role,
            IsActive = req.IsActive,
        };
        user.PasswordHash = hasher.HashPassword(user, req.Password);

        db.Users.Add(user);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { id = user.Id }, UserDto.From(user));
    }

    // PUT /api/users/5  → update an account (password optional)
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateUserRequest req)
    {
        var user = await db.Users.FindAsync(id);
        if (user is null) return NotFound();
        if (!Roles.IsValid(req.Role))
            return BadRequest(new { message = "Invalid role." });

        // Don't allow removing the last active administrator.
        var demotingAdmin = user.Role == Roles.Administrator && (req.Role != Roles.Administrator || !req.IsActive);
        if (demotingAdmin && !await HasOtherActiveAdmin(id))
            return BadRequest(new { message = "There must be at least one active administrator." });

        user.FullName = req.FullName.Trim();
        user.Role = req.Role;
        user.IsActive = req.IsActive;
        if (!string.IsNullOrWhiteSpace(req.NewPassword))
            user.PasswordHash = hasher.HashPassword(user, req.NewPassword);

        await db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/users/5
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var currentId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (id == currentId)
            return BadRequest(new { message = "You cannot delete your own account." });

        var user = await db.Users.FindAsync(id);
        if (user is null) return NotFound();

        if (user.Role == Roles.Administrator && !await HasOtherActiveAdmin(id))
            return BadRequest(new { message = "There must be at least one active administrator." });

        db.Users.Remove(user);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private Task<bool> HasOtherActiveAdmin(int excludeId) =>
        db.Users.AnyAsync(u => u.Role == Roles.Administrator && u.IsActive && u.Id != excludeId);
}
