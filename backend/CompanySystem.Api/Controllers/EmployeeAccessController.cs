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

/// <summary>
/// Manages the login account (User) linked to an employee. Admin-only.
/// URL: /api/employees/{employeeId}/access
/// </summary>
[ApiController]
[Authorize(Roles = Roles.Administrator)]
[Route("api/employees/{employeeId:int}/access")]
public class EmployeeAccessController(AppDbContext db, IPasswordHasher<User> hasher) : ControllerBase
{
    // POST → grant a login to this employee
    [HttpPost]
    public async Task<ActionResult<EmployeeAccessDto>> Grant(int employeeId, GrantAccessRequest req)
    {
        var employee = await db.Employees.Include(e => e.User).FirstOrDefaultAsync(e => e.Id == employeeId);
        if (employee is null) return NotFound(new { message = "Employee not found." });
        if (employee.User is not null)
            return Conflict(new { message = "This employee already has a login." });

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
            FullName = employee.FullName, // name mirrors the employee
            Role = req.Role,
            IsActive = req.IsActive,
            EmployeeId = employee.Id,
        };
        user.PasswordHash = hasher.HashPassword(user, req.Password);

        db.Users.Add(user);
        await db.SaveChangesAsync();
        return Ok(EmployeeAccessDto.From(user));
    }

    // PUT → update this employee's login (role / status / optional new password)
    [HttpPut]
    public async Task<IActionResult> Update(int employeeId, UpdateAccessRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.EmployeeId == employeeId);
        if (user is null) return NotFound(new { message = "This employee has no login." });
        if (!Roles.IsValid(req.Role))
            return BadRequest(new { message = "Invalid role." });

        var demotingAdmin = user.Role == Roles.Administrator && (req.Role != Roles.Administrator || !req.IsActive);
        if (demotingAdmin && !await HasOtherActiveAdmin(user.Id))
            return BadRequest(new { message = "There must be at least one active administrator." });

        user.Role = req.Role;
        user.IsActive = req.IsActive;
        if (!string.IsNullOrWhiteSpace(req.NewPassword))
            user.PasswordHash = hasher.HashPassword(user, req.NewPassword);

        await db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE → revoke this employee's login (removes the account, keeps the employee)
    [HttpDelete]
    public async Task<IActionResult> Revoke(int employeeId)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.EmployeeId == employeeId);
        if (user is null) return NotFound(new { message = "This employee has no login." });

        var currentId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (user.Id == currentId)
            return BadRequest(new { message = "You cannot revoke your own access." });

        if (user is { Role: Roles.Administrator, IsActive: true } && !await HasOtherActiveAdmin(user.Id))
            return BadRequest(new { message = "There must be at least one active administrator." });

        db.Users.Remove(user);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private Task<bool> HasOtherActiveAdmin(int excludeUserId) =>
        db.Users.AnyAsync(u => u.Role == Roles.Administrator && u.IsActive && u.Id != excludeUserId);
}
