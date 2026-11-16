using System.Security.Claims;
using CompanySystem.Api.Auth;
using CompanySystem.Api.Data;
using CompanySystem.Api.Dtos;
using CompanySystem.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CompanySystem.Api.Controllers;

[ApiController]
[Authorize] // must be logged in to reach ANY endpoint here
[Route("api/[controller]")] // → the base URL is  /api/employees
public class EmployeesController(AppDbContext db) : ControllerBase
{
    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // Login names and roles are for administrators only.
    private bool ShowLogins => User.IsInRole(Roles.Administrator);

    // GET /api/employees  → list all employees (with their access status)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<EmployeeDto>>> GetAll()
    {
        var employees = await db.Employees.AsNoTracking()
            .Include(e => e.User)
            .OrderBy(e => e.Id)
            .ToListAsync();
        return Ok(employees.Select(e => EmployeeDto.From(e, ShowLogins)));
    }

    // GET /api/employees/5  → get one employee by id
    [HttpGet("{id:int}")]
    public async Task<ActionResult<EmployeeDto>> GetById(int id)
    {
        var employee = await db.Employees.AsNoTracking().Include(e => e.User).FirstOrDefaultAsync(e => e.Id == id);
        if (employee is null) return NotFound();
        return Ok(EmployeeDto.From(employee, ShowLogins));
    }

    // POST /api/employees  → create a new employee (managers only)
    [Authorize(Roles = Roles.Managers)]
    [HttpPost]
    public async Task<ActionResult<EmployeeDto>> Create(EmployeeInputDto input)
    {
        if (string.IsNullOrWhiteSpace(input.FullName))
            return BadRequest(new { message = "Full name is required." });

        var employee = new Employee
        {
            FullName = input.FullName.Trim(),
            Email = input.Email,
            Position = input.Position,
            IsActive = input.IsActive,
        };
        db.Employees.Add(employee);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = employee.Id }, EmployeeDto.From(employee, ShowLogins));
    }

    // PUT /api/employees/5  → update an existing employee (managers only)
    [Authorize(Roles = Roles.Managers)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, EmployeeInputDto input)
    {
        if (string.IsNullOrWhiteSpace(input.FullName))
            return BadRequest(new { message = "Full name is required." });

        await using var change = await AccountRules.BeginChange(db); // switching off can affect who is an administrator
        var employee = await db.Employees.Include(e => e.User).FirstOrDefaultAsync(e => e.Id == id);
        if (employee is null) return NotFound();

        // The employee record controls their login (its name, and whether it works),
        // so changing it follows the login rules.
        if (await CannotChangeLogin(employee.User, switchingOff: employee.IsActive && !input.IsActive) is { } refusal)
            return refusal;

        employee.FullName = input.FullName.Trim();
        employee.Email = input.Email;
        employee.Position = input.Position;
        employee.IsActive = input.IsActive;

        // Keep the linked login's display name in sync with the employee.
        if (employee.User is not null)
            employee.User.FullName = employee.FullName;

        await db.SaveChangesAsync();
        await change.CommitAsync();
        return NoContent();
    }

    // DELETE /api/employees/5  → delete an employee (managers only). Also removes their login (cascade).
    [Authorize(Roles = Roles.Managers)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        await using var change = await AccountRules.BeginChange(db);
        var employee = await db.Employees.Include(e => e.User).FirstOrDefaultAsync(e => e.Id == id);
        if (employee is null) return NotFound();

        // Deleting an employee also deletes their login, so it follows the login rules.
        if (await CannotChangeLogin(employee.User, switchingOff: true) is { } refusal)
            return refusal;

        db.Employees.Remove(employee);
        try
        {
            await db.SaveChangesAsync();
            await change.CommitAsync();
        }
        catch (DbUpdateException)
        {
            // Their login is named on purchases, movements, documents or notifications,
            // which are kept as history (Restrict). The record stays; switch it off instead.
            return Conflict(new { message = "Can't delete — this employee's login has history (records they created or were notified about). Switch the employee off instead." });
        }
        return NoContent();
    }

    // Why this login can't be changed through its employee record — or null when
    // it can. Switching off (or deleting) yourself: never. An administrator's record,
    // in any way: only by another administrator, and never switching off the last one.
    // (Without this, a manager could rename an administrator, or switch a dismissed
    // administrator back on.)
    private async Task<ActionResult?> CannotChangeLogin(User? login, bool switchingOff)
    {
        if (login is null) return null;
        if (switchingOff && login.Id == CurrentUserId)
            return BadRequest(new { message = "You cannot switch off or delete your own employee record." });
        if (login.Role != Roles.Administrator) return null;
        if (!User.IsInRole(Roles.Administrator))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only an administrator can change an administrator's record." });
        if (switchingOff && !await AccountRules.HasOtherUsableAdmin(db, login.Id))
            return BadRequest(new { message = "There must be at least one active administrator." });
        return null;
    }
}
