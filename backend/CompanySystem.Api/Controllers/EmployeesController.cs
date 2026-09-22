using CompanySystem.Api.Auth;
using CompanySystem.Api.Data;
using CompanySystem.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CompanySystem.Api.Controllers;

[ApiController]
[Authorize] // must be logged in to reach ANY endpoint here
[Route("api/[controller]")] // → the base URL is  /api/employees
public class EmployeesController : ControllerBase
{
    private readonly AppDbContext _db;

    // The AppDbContext is injected here automatically (we registered it in Program.cs).
    public EmployeesController(AppDbContext db)
    {
        _db = db;
    }

    // GET /api/employees  → list all employees
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Employee>>> GetAll()
    {
        var employees = await _db.Employees.ToListAsync();
        return Ok(employees);
    }

    // GET /api/employees/5  → get one employee by id
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Employee>> GetById(int id)
    {
        var employee = await _db.Employees.FindAsync(id);
        if (employee is null)
            return NotFound();

        return Ok(employee);
    }

    // POST /api/employees  → create a new employee (managers only)
    [Authorize(Roles = Roles.Managers)]
    [HttpPost]
    public async Task<ActionResult<Employee>> Create(Employee employee)
    {
        _db.Employees.Add(employee);
        await _db.SaveChangesAsync();

        // Returns 201 Created + a link to the new employee.
        return CreatedAtAction(nameof(GetById), new { id = employee.Id }, employee);
    }

    // PUT /api/employees/5  → update an existing employee (managers only)
    [Authorize(Roles = Roles.Managers)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, Employee updated)
    {
        var employee = await _db.Employees.FindAsync(id);
        if (employee is null)
            return NotFound();

        employee.FullName = updated.FullName;
        employee.Email = updated.Email;
        employee.Position = updated.Position;
        employee.HireDate = updated.HireDate;
        employee.IsActive = updated.IsActive;

        await _db.SaveChangesAsync();
        return NoContent(); // 204 — success, nothing to return
    }

    // DELETE /api/employees/5  → delete an employee (managers only)
    [Authorize(Roles = Roles.Managers)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var employee = await _db.Employees.FindAsync(id);
        if (employee is null)
            return NotFound();

        _db.Employees.Remove(employee);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
