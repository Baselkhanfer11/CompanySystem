using CompanySystem.Api.Auth;
using CompanySystem.Api.Data;
using CompanySystem.Api.Dtos;
using CompanySystem.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CompanySystem.Api.Controllers;

[ApiController]
[Authorize] // must be logged in to reach any endpoint here
[Route("api/[controller]")] // → /api/customers
public class CustomersController(AppDbContext db) : ControllerBase
{
    // GET /api/customers  → list all customers (newest first)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Customer>>> GetAll()
    {
        var customers = await db.Customers.AsNoTracking().OrderByDescending(c => c.Id).ToListAsync();
        return Ok(customers);
    }

    // GET /api/customers/5
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Customer>> GetById(int id)
    {
        var customer = await db.Customers.FindAsync(id);
        if (customer is null) return NotFound();
        return Ok(customer);
    }

    // POST /api/customers  → create (managers + procurement)
    [Authorize(Roles = Roles.Procurement)]
    [HttpPost]
    public async Task<ActionResult<Customer>> Create(CustomerInputDto input)
    {
        var error = await Validate(input, null);
        if (error is not null) return error;

        var customer = new Customer
        {
            Name = input.Name.Trim(),
            Code = input.Code.Trim(),
            ContactPerson = Clean(input.ContactPerson),
            Phone = Clean(input.Phone),
            Email = Clean(input.Email),
            Address = Clean(input.Address),
            Notes = Clean(input.Notes),
            Status = input.Status,
        };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = customer.Id }, customer);
    }

    // PUT /api/customers/5  → update (managers + procurement)
    [Authorize(Roles = Roles.Procurement)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, CustomerInputDto input)
    {
        var customer = await db.Customers.FindAsync(id);
        if (customer is null) return NotFound();

        var error = await Validate(input, id);
        if (error is not null) return error;

        customer.Name = input.Name.Trim();
        customer.Code = input.Code.Trim();
        customer.ContactPerson = Clean(input.ContactPerson);
        customer.Phone = Clean(input.Phone);
        customer.Email = Clean(input.Email);
        customer.Address = Clean(input.Address);
        customer.Notes = Clean(input.Notes);
        customer.Status = input.Status;

        await db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/customers/5  → delete (managers + procurement)
    [Authorize(Roles = Roles.Procurement)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var customer = await db.Customers.FindAsync(id);
        if (customer is null) return NotFound();

        // A customer with sales stays (the sales history must keep its name).
        if (await db.Sales.AnyAsync(s => s.CustomerId == id))
            return Conflict(new { message = "This customer has sales and can't be deleted. Set them to Inactive instead." });

        db.Customers.Remove(customer);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // Trim, and turn blank strings into null so we don't store empty text.
    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    // Shared validation. Returns an error result, or null when valid.
    private async Task<ActionResult?> Validate(CustomerInputDto input, int? excludeId)
    {
        if (string.IsNullOrWhiteSpace(input.Name))
            return BadRequest(new { message = "Name is required." });
        if (string.IsNullOrWhiteSpace(input.Code))
            return BadRequest(new { message = "Code is required." });
        if (!CustomerStatuses.IsValid(input.Status))
            return BadRequest(new { message = $"Status '{input.Status}' is not valid." });

        var code = input.Code.Trim();
        var exclude = excludeId ?? 0; // 0 matches no real customer (ids start at 1)
        if (await db.Customers.AnyAsync(c => c.Code == code && c.Id != exclude))
            return Conflict(new { message = $"Code '{code}' is already used by another customer." });

        return null;
    }
}
