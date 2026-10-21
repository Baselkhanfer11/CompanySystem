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
        var employee = await db.Employees.Include(e => e.User).FirstOrDefaultAsync(e => e.Id == id);
        if (employee is null) return NotFound();

        // Switching an employee off also switches off their login, so it follows the login rules.
        if (employee.IsActive && !input.IsActive && await CannotSwitchOffLogin(employee.User) is { } refusal)
            return refusal;

        employee.FullName = input.FullName.Trim();
        employee.Email = input.Email;
        employee.Position = input.Position;
        employee.IsActive = input.IsActive;

        // Keep the linked login's display name in sync with the employee.
        if (employee.User is not null)
            employee.User.FullName = employee.FullName;

        await db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/employees/5  → delete an employee (managers only). Also removes their login (cascade).
    [Authorize(Roles = Roles.Managers)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var employee = await db.Employees.Include(e => e.User).FirstOrDefaultAsync(e => e.Id == id);
        if (employee is null) return NotFound();

        // Deleting an employee also deletes their login, so it follows the login rules.
        if (await CannotSwitchOffLogin(employee.User) is { } refusal)
            return refusal;

        db.Employees.Remove(employee);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // Why this login can't be switched off or deleted through its employee record —
    // or null when it can. Yourself: never. An administrator: only by another
    // administrator, and never the last one.
    private async Task<ActionResult?> CannotSwitchOffLogin(User? login)
    {
        if (login is null) return null;
        if (login.Id == CurrentUserId)
            return BadRequest(new { message = "You cannot switch off or delete your own employee record." });
        if (login.Role != Roles.Administrator) return null;
        if (!User.IsInRole(Roles.Administrator))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only an administrator can switch off or delete an administrator." });
        if (!await AccountRules.HasOtherUsableAdmin(db, login.Id))
            return BadRequest(new { message = "There must be at least one active administrator." });
        return null;
    }
}
