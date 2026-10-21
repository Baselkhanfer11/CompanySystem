using CompanySystem.Api.Auth;
using CompanySystem.Api.Data;
using CompanySystem.Api.Dtos;
using CompanySystem.Api.Models;
using CompanySystem.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CompanySystem.Api.Controllers;

[ApiController]
[Authorize] // must be logged in to reach any endpoint here
[Route("api/[controller]")] // → /api/items
public class ItemsController(AppDbContext db, StockService stock) : ControllerBase
{
    // GET /api/items  → list all items
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Item>>> GetAll()
    {
        var items = await db.Items.AsNoTracking().OrderBy(i => i.Name).ToListAsync();
        return Ok(items);
    }

    // GET /api/items/5
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Item>> GetById(int id)
    {
        var item = await db.Items.FindAsync(id);
        if (item is null) return NotFound();
        return Ok(item);
    }

    // POST /api/items  → create (managers + procurement)
    [Authorize(Roles = Roles.Procurement)]
    [HttpPost]
    public async Task<ActionResult<Item>> Create(ItemInputDto input)
    {
        var error = await Validate(input, null);
        if (error is not null) return error;

        var item = new Item
        {
            Name = input.Name.Trim(),
            Code = input.Code.Trim(),
            Quantity = input.Quantity,
            Unit = string.IsNullOrWhiteSpace(input.Unit) ? "pcs" : input.Unit.Trim(),
            Price = input.Price,
        };
        db.Items.Add(item);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = item.Id }, item);
    }

    // PUT /api/items/5  → update (managers + procurement)
    [Authorize(Roles = Roles.Procurement)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, ItemInputDto input)
    {
        await using var change = await stock.BeginChange(); // the count may change
        var item = await db.Items.FindAsync(id);
        if (item is null) return NotFound();

        var error = await Validate(input, id);
        if (error is not null) return error;

        item.Name = input.Name.Trim();
        item.Code = input.Code.Trim();
        item.Unit = string.IsNullOrWhiteSpace(input.Unit) ? "pcs" : input.Unit.Trim();
        item.Price = input.Price;

        // Warehouse stock moves with purchases and movements. Here it only changes
        // when the person corrected the count — never back to what an old form showed.
        if (input.QuantityWas is int was && input.Quantity != was)
        {
            if (item.Quantity != was)
                return Conflict(new { message = $"The stock of {item.Name} changed while you were editing (now {item.Quantity} {item.Unit}). Close the form, open it again and check the count." });
            item.Quantity = input.Quantity;
        }

        await db.SaveChangesAsync();
        await change.CommitAsync();
        return NoContent();
    }

    // DELETE /api/items/5  → delete (managers + procurement)
    [Authorize(Roles = Roles.Procurement)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await db.Items.FindAsync(id);
        if (item is null) return NotFound();

        // Keep history intact: an item that appears on purchases, movements or plans stays.
        if (await db.PurchaseItems.AnyAsync(li => li.ItemId == id) || await db.StockMovementLines.AnyAsync(l => l.ItemId == id))
            return Conflict(new { message = "Can't delete — this item is used on purchases or stock movements." });
        if (await db.ProjectMaterials.AnyAsync(m => m.ItemId == id))
            return Conflict(new { message = "Can't delete — this item is in a project's material plan. Remove it from the plan first." });

        db.Items.Remove(item);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // Shared validation. Returns an error result, or null when valid.
    private async Task<ActionResult?> Validate(ItemInputDto input, int? excludeId)
    {
        if (string.IsNullOrWhiteSpace(input.Name))
            return BadRequest(new { message = "Name is required." });
        if (string.IsNullOrWhiteSpace(input.Code))
            return BadRequest(new { message = "Code is required." });
        if (input.Quantity < 0)
            return BadRequest(new { message = "Quantity cannot be negative." });
        var problem = InputRules.QuantityProblem(input.Quantity) ?? InputRules.PriceProblem(input.Price);
        if (problem is not null)
            return BadRequest(new { message = problem });

        var code = input.Code.Trim();
        var exclude = excludeId ?? 0; // 0 matches no real item (ids start at 1)
        var codeTaken = await db.Items.AnyAsync(i => i.Code == code && i.Id != exclude);
        if (codeTaken)
            return Conflict(new { message = $"Code '{code}' is already used by another item." });

        return null;
    }
}
