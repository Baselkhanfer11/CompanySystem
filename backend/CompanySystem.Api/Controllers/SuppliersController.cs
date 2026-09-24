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
[Route("api/[controller]")] // → /api/suppliers
public class SuppliersController(AppDbContext db) : ControllerBase
{
    // GET /api/suppliers  → list all suppliers (newest first)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Supplier>>> GetAll()
    {
        var suppliers = await db.Suppliers.OrderByDescending(s => s.Id).ToListAsync();
        return Ok(suppliers);
    }

    // GET /api/suppliers/5
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Supplier>> GetById(int id)
    {
        var supplier = await db.Suppliers.FindAsync(id);
        if (supplier is null) return NotFound();
        return Ok(supplier);
    }

    // POST /api/suppliers  → create (managers only)
    [Authorize(Roles = Roles.Managers)]
    [HttpPost]
    public async Task<ActionResult<Supplier>> Create(SupplierInputDto input)
    {
        var error = await Validate(input, null);
        if (error is not null) return error;

        var supplier = new Supplier
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
        db.Suppliers.Add(supplier);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = supplier.Id }, supplier);
    }

    // PUT /api/suppliers/5  → update (managers only)
    [Authorize(Roles = Roles.Managers)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, SupplierInputDto input)
    {
        var supplier = await db.Suppliers.FindAsync(id);
        if (supplier is null) return NotFound();

        var error = await Validate(input, id);
        if (error is not null) return error;

        supplier.Name = input.Name.Trim();
        supplier.Code = input.Code.Trim();
        supplier.ContactPerson = Clean(input.ContactPerson);
        supplier.Phone = Clean(input.Phone);
        supplier.Email = Clean(input.Email);
        supplier.Address = Clean(input.Address);
        supplier.Notes = Clean(input.Notes);
        supplier.Status = input.Status;

        await db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/suppliers/5  → delete (managers only)
    [Authorize(Roles = Roles.Managers)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var supplier = await db.Suppliers.FindAsync(id);
        if (supplier is null) return NotFound();

        // Block deleting a supplier that still has purchases (keeps cost history intact).
        var hasPurchases = await db.Purchases.AnyAsync(p => p.SupplierId == id);
        if (hasPurchases)
            return Conflict(new { message = "This supplier has purchases and can't be deleted." });

        db.Suppliers.Remove(supplier);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // Trim, and turn blank strings into null so we don't store empty text.
    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    // Shared validation. Returns an error result, or null when valid.
    private async Task<ActionResult?> Validate(SupplierInputDto input, int? excludeId)
    {
        if (string.IsNullOrWhiteSpace(input.Name))
            return BadRequest(new { message = "Name is required." });
        if (string.IsNullOrWhiteSpace(input.Code))
            return BadRequest(new { message = "Code is required." });
        if (!SupplierStatuses.IsValid(input.Status))
            return BadRequest(new { message = $"Status '{input.Status}' is not valid." });

        var code = input.Code.Trim();
        var exclude = excludeId ?? 0; // 0 matches no real supplier (ids start at 1)
        var codeTaken = await db.Suppliers.AnyAsync(s => s.Code == code && s.Id != exclude);
        if (codeTaken)
            return Conflict(new { message = $"Code '{code}' is already used by another supplier." });

        return null;
    }
}
