using System.Security.Claims;
using CompanySystem.Api.Auth;
using CompanySystem.Api.Data;
using CompanySystem.Api.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CompanySystem.Api.Controllers;

/// <summary>
/// Read-only overview of all logins + the ability to remove one.
/// Creating/editing a login is done per-employee via EmployeeAccessController.
/// </summary>
[ApiController]
[Authorize(Roles = Roles.Administrator)]
[Route("api/[controller]")]
public class UsersController(AppDbContext db) : ControllerBase
{
    // GET /api/users  → all accounts (never exposes password hashes)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetAll()
    {
        var users = await db.Users.OrderBy(u => u.Id).ToListAsync();
        return Ok(users.Select(UserDto.From));
    }

    // DELETE /api/users/5  → remove a login account
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var currentId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (id == currentId)
            return BadRequest(new { message = "You cannot remove your own login." });

        var user = await db.Users.FindAsync(id);
        if (user is null) return NotFound();

        if (user is { Role: Roles.Administrator, IsActive: true })
        {
            var otherAdmins = await db.Users.CountAsync(u =>
                u.Role == Roles.Administrator && u.IsActive && u.Id != id);
            if (otherAdmins == 0)
                return BadRequest(new { message = "There must be at least one active administrator." });
        }

        db.Users.Remove(user);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
