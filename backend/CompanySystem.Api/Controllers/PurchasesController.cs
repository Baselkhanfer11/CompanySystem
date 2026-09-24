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
[Authorize] // must be logged in to reach any endpoint here
[Route("api/[controller]")] // → /api/purchases
public class PurchasesController(AppDbContext db) : ControllerBase
{
    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // GET /api/purchases  → list all purchases (newest first)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PurchaseListDto>>> GetAll()
    {
        // Load with related data, then map in memory (EF can't translate ToDto).
        var purchases = await db.Purchases
            .Include(p => p.Supplier)
            .Include(p => p.Project)
            .Include(p => p.CreatedBy)
            .Include(p => p.Items)
            .OrderByDescending(p => p.Date)
            .ThenByDescending(p => p.Id)
            .ToListAsync();

        return Ok(purchases.Select(ToListDto));
    }

    // GET /api/purchases/5  → one purchase with all its lines
    [HttpGet("{id:int}")]
    public async Task<ActionResult<PurchaseDetailDto>> GetById(int id)
    {
        var detail = await LoadDetail(id);
        if (detail is null) return NotFound();
        return Ok(detail);
    }

    // POST /api/purchases  → record a purchase (managers only). Restocks the warehouse.
    [Authorize(Roles = Roles.Managers)]
    [HttpPost]
    public async Task<ActionResult<PurchaseDetailDto>> Create(PurchaseInputDto input)
    {
        // --- validate the header ---
        var supplierExists = await db.Suppliers.AnyAsync(s => s.Id == input.SupplierId);
        if (!supplierExists) return BadRequest(new { message = "Supplier not found." });

        if (input.ProjectId is int projectId)
        {
            var projectExists = await db.Projects.AnyAsync(p => p.Id == projectId);
            if (!projectExists) return BadRequest(new { message = "Project not found." });
        }

        // --- validate the lines ---
        if (input.Items is null || input.Items.Count == 0)
            return BadRequest(new { message = "At least one line item is required." });
        if (input.Items.Any(l => l.Quantity <= 0))
            return BadRequest(new { message = "Every line must have a quantity greater than zero." });
        if (input.Items.Any(l => l.UnitPrice < 0))
            return BadRequest(new { message = "Unit price can't be negative." });

        var itemIds = input.Items.Select(l => l.ItemId).Distinct().ToList();
        var items = await db.Items.Where(i => itemIds.Contains(i.Id)).ToListAsync();
        if (items.Count != itemIds.Count)
            return BadRequest(new { message = "One or more items were not found." });

        // --- create the purchase + its lines ---
        var purchase = new Purchase
        {
            SupplierId = input.SupplierId,
            ProjectId = input.ProjectId,
            InvoiceNumber = Clean(input.InvoiceNumber),
            Date = input.Date,
            Notes = Clean(input.Notes),
            CreatedById = CurrentUserId,
            Items = input.Items.Select(l => new PurchaseItem
            {
                ItemId = l.ItemId,
                Quantity = l.Quantity,
                UnitPrice = l.UnitPrice,
            }).ToList(),
        };
        db.Purchases.Add(purchase);

        // --- restock: add each line's quantity to the warehouse item ---
        var itemsById = items.ToDictionary(i => i.Id);
        foreach (var line in input.Items)
            itemsById[line.ItemId].Quantity += line.Quantity;

        await db.SaveChangesAsync();

        var detail = await LoadDetail(purchase.Id);
        return CreatedAtAction(nameof(GetById), new { id = purchase.Id }, detail);
    }

    // DELETE /api/purchases/5  → delete a purchase (managers only). Reverses the restock.
    [Authorize(Roles = Roles.Managers)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var purchase = await db.Purchases
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (purchase is null) return NotFound();

        // Undo the stock that this purchase added (never drop below zero).
        var itemIds = purchase.Items.Select(li => li.ItemId).Distinct().ToList();
        var items = await db.Items.Where(i => itemIds.Contains(i.Id)).ToListAsync();
        var itemsById = items.ToDictionary(i => i.Id);
        foreach (var line in purchase.Items)
            if (itemsById.TryGetValue(line.ItemId, out var item))
                item.Quantity = Math.Max(0, item.Quantity - line.Quantity);

        db.Purchases.Remove(purchase); // cascade removes its line items
        await db.SaveChangesAsync();
        return NoContent();
    }

    // --- helpers ---

    // Loads one purchase and shapes it into the detail DTO (null if not found).
    private async Task<PurchaseDetailDto?> LoadDetail(int id)
    {
        var p = await db.Purchases
            .Include(x => x.Supplier)
            .Include(x => x.Project)
            .Include(x => x.CreatedBy)
            .Include(x => x.Items).ThenInclude(li => li.Item)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (p is null) return null;

        var lines = p.Items.Select(li => new PurchaseItemDto(
            li.Id,
            li.ItemId,
            li.Item?.Name ?? "",
            li.Item?.Code ?? "",
            li.Item?.Unit ?? "",
            li.Quantity,
            li.UnitPrice,
            li.Quantity * li.UnitPrice)).ToList();

        return new PurchaseDetailDto(
            p.Id,
            p.SupplierId,
            p.Supplier?.Name ?? "",
            p.ProjectId,
            p.Project?.Name,
            p.InvoiceNumber,
            p.Date,
            p.Notes,
            p.CreatedBy?.FullName ?? "",
            p.CreatedAt,
            lines.Sum(l => l.LineTotal),
            lines);
    }

    // Maps a loaded purchase to a summary row for the list.
    private static PurchaseListDto ToListDto(Purchase p) => new(
        p.Id,
        p.SupplierId,
        p.Supplier?.Name ?? "",
        p.ProjectId,
        p.Project?.Name,
        p.InvoiceNumber,
        p.Date,
        p.Items.Count,
        p.Items.Sum(li => li.Quantity * li.UnitPrice),
        p.CreatedBy?.FullName ?? "",
        p.CreatedAt);

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
