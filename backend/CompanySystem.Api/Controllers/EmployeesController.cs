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
    // GET /api/employees  → list all employees (with their access status)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<EmployeeDto>>> GetAll()
    {
        var employees = await db.Employees
            .Include(e => e.User)
            .OrderBy(e => e.Id)
            .ToListAsync();
        return Ok(employees.Select(EmployeeDto.From));
    }

    // GET /api/employees/5  → get one employee by id
    [HttpGet("{id:int}")]
    public async Task<ActionResult<EmployeeDto>> GetById(int id)
    {
        var employee = await db.Employees.Include(e => e.User).FirstOrDefaultAsync(e => e.Id == id);
        if (employee is null) return NotFound();
        return Ok(EmployeeDto.From(employee));
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

        return CreatedAtAction(nameof(GetById), new { id = employee.Id }, EmployeeDto.From(employee));
    }

    // PUT /api/employees/5  → update an existing employee (managers only)
    [Authorize(Roles = Roles.Managers)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, EmployeeInputDto input)
    {
        var employee = await db.Employees.Include(e => e.User).FirstOrDefaultAsync(e => e.Id == id);
        if (employee is null) return NotFound();

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

        // Don't let deleting an employee remove the last active administrator.
        if (employee.User is { Role: Roles.Administrator, IsActive: true })
        {
            var otherAdmins = await db.Users.CountAsync(u =>
                u.Role == Roles.Administrator && u.IsActive && u.Id != employee.User.Id);
            if (otherAdmins == 0)
                return BadRequest(new { message = "This employee is the last active administrator and cannot be deleted." });
        }

        db.Employees.Remove(employee);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
