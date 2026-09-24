using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
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
[Route("api/[controller]")] // → /api/purchases
public class PurchasesController(AppDbContext db, StockService stock) : ControllerBase
{
    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // How edit-history changes are stored (camelCase, nulls left out).
    private static readonly JsonSerializerOptions HistoryJson = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

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

        return Ok(purchases.Select(PurchaseListDto.From));
    }

    // GET /api/purchases/5  → one purchase with all its lines and its edit history
    [HttpGet("{id:int}")]
    public async Task<ActionResult<PurchaseDetailDto>> GetById(int id)
    {
        var detail = await LoadDetail(id);
        if (detail is null) return NotFound();
        return Ok(detail);
    }

    // POST /api/purchases  → record a purchase (managers + procurement). The material
    // lands where it was delivered: the warehouse or a project's site.
    [Authorize(Roles = Roles.Procurement)]
    [HttpPost]
    public async Task<ActionResult<PurchaseDetailDto>> Create(PurchaseInputDto input)
    {
        var error = await ValidateInput(input);
        if (error is not null) return error;

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

        // Put the material where it was delivered.
        var delta = new Dictionary<StockKey, int>();
        foreach (var l in input.Items) StockService.Add(delta, input.ProjectId, l.ItemId, l.Quantity);
        await stock.Apply(delta);

        await db.SaveChangesAsync();

        var detail = await LoadDetail(purchase.Id);
        return CreatedAtAction(nameof(GetById), new { id = purchase.Id }, detail);
    }

    // PUT /api/purchases/5  → edit a purchase (managers + procurement).
    // Moves stock by the difference (take the old lines out of the old place,
    // put the new lines in the new place) and records exactly what changed.
    [Authorize(Roles = Roles.Procurement)]
    [HttpPut("{id:int}")]
    public async Task<ActionResult<PurchaseDetailDto>> Update(int id, PurchaseInputDto input)
    {
        var purchase = await db.Purchases
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (purchase is null) return NotFound();

        var error = await ValidateInput(input);
        if (error is not null) return error;

        // Every line id sent must be one of this purchase's lines, used once.
        var existing = purchase.Items.ToDictionary(li => li.Id);
        var sentIds = input.Items.Where(l => l.Id is not null).Select(l => l.Id!.Value).ToList();
        if (sentIds.Any(lid => !existing.ContainsKey(lid)) || sentIds.Distinct().Count() != sentIds.Count)
            return BadRequest(new { message = "One or more lines don't belong to this purchase." });

        // --- stock: old lines leave the old place, new lines arrive at the new one ---
        var delta = new Dictionary<StockKey, int>();
        foreach (var li in purchase.Items) StockService.Add(delta, purchase.ProjectId, li.ItemId, -li.Quantity);
        foreach (var l in input.Items) StockService.Add(delta, input.ProjectId, l.ItemId, l.Quantity);

        var shortfall = await stock.Apply(delta);
        if (shortfall is not null)
            return Conflict(new { message = $"Can't save — some of this material has already been moved or used. {shortfall}" });

        // --- work out what changed (names are snapshots for the history) ---
        var itemIds = input.Items.Select(l => l.ItemId).Concat(purchase.Items.Select(li => li.ItemId)).Distinct().ToList();
        var items = await db.Items.Where(i => itemIds.Contains(i.Id)).ToDictionaryAsync(i => i.Id);
        var changes = new List<PurchaseChange>();

        if (purchase.SupplierId != input.SupplierId)
            changes.Add(FieldChange("supplier", await SupplierName(purchase.SupplierId), await SupplierName(input.SupplierId)));
        if (purchase.ProjectId != input.ProjectId)
            changes.Add(FieldChange("project", await ProjectName(purchase.ProjectId), await ProjectName(input.ProjectId)));
        if (purchase.Date.Date != input.Date.Date)
            changes.Add(FieldChange("date", purchase.Date.ToString("yyyy-MM-dd"), input.Date.ToString("yyyy-MM-dd")));
        if (purchase.InvoiceNumber != Clean(input.InvoiceNumber))
            changes.Add(FieldChange("invoiceNumber", purchase.InvoiceNumber, Clean(input.InvoiceNumber)));
        if (purchase.Notes != Clean(input.Notes))
            changes.Add(FieldChange("notes", purchase.Notes, Clean(input.Notes)));

        // --- apply the header ---
        purchase.SupplierId = input.SupplierId;
        purchase.ProjectId = input.ProjectId;
        purchase.InvoiceNumber = Clean(input.InvoiceNumber);
        purchase.Date = input.Date;
        purchase.Notes = Clean(input.Notes);

        // --- apply the lines: update kept ones, add new ones, remove the rest ---
        var kept = new HashSet<int>();
        foreach (var l in input.Items)
        {
            var item = items[l.ItemId];
            if (l.Id is int lineId)
            {
                var old = existing[lineId];
                kept.Add(lineId);
                if (old.ItemId != l.ItemId)
                {
                    changes.Add(LineRemoved(items[old.ItemId], old.Quantity, old.UnitPrice));
                    changes.Add(LineAdded(item, l.Quantity, l.UnitPrice));
                }
                else if (old.Quantity != l.Quantity || old.UnitPrice != l.UnitPrice)
                {
                    changes.Add(new PurchaseChange(PurchaseChangeKinds.LineChanged, Item: item.Name, Unit: item.Unit,
                        FromQty: old.Quantity, ToQty: l.Quantity, FromPrice: old.UnitPrice, ToPrice: l.UnitPrice));
                }
                old.ItemId = l.ItemId;
                old.Quantity = l.Quantity;
                old.UnitPrice = l.UnitPrice;
            }
            else
            {
                changes.Add(LineAdded(item, l.Quantity, l.UnitPrice));
                purchase.Items.Add(new PurchaseItem { ItemId = l.ItemId, Quantity = l.Quantity, UnitPrice = l.UnitPrice });
            }
        }
        foreach (var old in existing.Values.Where(li => !kept.Contains(li.Id)))
        {
            changes.Add(LineRemoved(items[old.ItemId], old.Quantity, old.UnitPrice));
            db.PurchaseItems.Remove(old);
        }

        // Only write a history entry when something actually changed.
        if (changes.Count > 0)
        {
            db.PurchaseEvents.Add(new PurchaseEvent
            {
                PurchaseId = purchase.Id,
                Action = PurchaseActions.Edited,
                ActorId = CurrentUserId,
                Changes = JsonSerializer.Serialize(changes, HistoryJson),
            });
        }

        await db.SaveChangesAsync();
        return Ok(await LoadDetail(purchase.Id));
    }

    // DELETE /api/purchases/5  → delete a purchase (managers + procurement). Takes its
    // material back out of wherever it was delivered.
    [Authorize(Roles = Roles.Procurement)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var purchase = await db.Purchases
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (purchase is null) return NotFound();

        // Take back the stock this purchase added — blocked if some was already moved.
        var delta = new Dictionary<StockKey, int>();
        foreach (var li in purchase.Items) StockService.Add(delta, purchase.ProjectId, li.ItemId, -li.Quantity);
        var shortfall = await stock.Apply(delta);
        if (shortfall is not null)
            return Conflict(new { message = $"Can't delete — some of this material has already been moved or used. {shortfall}" });

        db.Purchases.Remove(purchase); // cascade removes its lines and history
        await db.SaveChangesAsync();
        return NoContent();
    }

    // --- helpers ---

    // Checks the header and lines shared by create and edit. Returns an error, or null when valid.
    private async Task<ActionResult?> ValidateInput(PurchaseInputDto input)
    {
        if (!await db.Suppliers.AnyAsync(s => s.Id == input.SupplierId))
            return BadRequest(new { message = "Supplier not found." });

        if (input.ProjectId is int projectId && !await db.Projects.AnyAsync(p => p.Id == projectId))
            return BadRequest(new { message = "Project not found." });

        if (input.Items is null || input.Items.Count == 0)
            return BadRequest(new { message = "At least one line item is required." });
        if (input.Items.Any(l => l.Quantity <= 0))
            return BadRequest(new { message = "Every line must have a quantity greater than zero." });
        if (input.Items.Any(l => l.UnitPrice < 0))
            return BadRequest(new { message = "Unit price can't be negative." });

        var itemIds = input.Items.Select(l => l.ItemId).Distinct().ToList();
        if (await db.Items.CountAsync(i => itemIds.Contains(i.Id)) != itemIds.Count)
            return BadRequest(new { message = "One or more items were not found." });

        return null;
    }

    private async Task<string?> SupplierName(int id) =>
        await db.Suppliers.Where(s => s.Id == id).Select(s => s.Name).FirstOrDefaultAsync();

    // Null project = delivered to the warehouse.
    private async Task<string?> ProjectName(int? id) =>
        id is null ? null : await db.Projects.Where(p => p.Id == id).Select(p => p.Name).FirstOrDefaultAsync();

    private static PurchaseChange FieldChange(string field, string? from, string? to) =>
        new(PurchaseChangeKinds.Field, Field: field, From: from, To: to);

    private static PurchaseChange LineAdded(Item item, int qty, decimal price) =>
        new(PurchaseChangeKinds.LineAdded, Item: item.Name, Unit: item.Unit, ToQty: qty, ToPrice: price);

    private static PurchaseChange LineRemoved(Item item, int qty, decimal price) =>
        new(PurchaseChangeKinds.LineRemoved, Item: item.Name, Unit: item.Unit, FromQty: qty, FromPrice: price);

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

        var lines = p.Items.OrderBy(li => li.Id).Select(li => new PurchaseItemDto(
            li.Id,
            li.ItemId,
            li.Item?.Name ?? "",
            li.Item?.Code ?? "",
            li.Item?.Unit ?? "",
            li.Quantity,
            li.UnitPrice,
            li.Quantity * li.UnitPrice)).ToList();

        var events = await db.PurchaseEvents
            .Where(e => e.PurchaseId == id)
            .Include(e => e.Actor)
            .OrderBy(e => e.Id)
            .ToListAsync();
        var history = events.Select(e => new PurchaseEventDto(
            e.Id,
            e.Action,
            e.Actor?.FullName ?? "",
            e.CreatedAt,
            JsonSerializer.Deserialize<List<PurchaseChange>>(e.Changes, HistoryJson) ?? [])).ToList();
        var last = history.LastOrDefault();

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
            lines,
            last?.ActorName,
            last?.CreatedAt,
            history);
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
