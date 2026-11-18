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

/// <summary>
/// Sales: an order is recorded (nothing moves), delivered in one go (its lines
/// leave the warehouse, through the same stock lock as every other stock change),
/// and paid for in one or more payments. Every step is written to the sale's history.
/// </summary>
[ApiController]
[Authorize]
[Route("api/[controller]")] // → /api/sales
public class SalesController(AppDbContext db, StockService stock) : ControllerBase
{
    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // How history entries are stored: camelCase, nulls left out.
    private static readonly JsonSerializerOptions HistoryJson = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    // GET /api/sales  → all sales (newest first)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<SaleListDto>>> GetAll()
    {
        var sales = await db.Sales.AsNoTracking()
            .OrderByDescending(s => s.Date)
            .ThenByDescending(s => s.Id)
            .Select(SaleListDto.Projection)
            .ToListAsync();
        return Ok(sales);
    }

    // GET /api/sales/5  → one sale with its lines, payments and history
    [HttpGet("{id:int}")]
    public async Task<ActionResult<SaleDetailDto>> GetById(int id)
    {
        var detail = await LoadDetail(id);
        if (detail is null) return NotFound();
        return Ok(detail);
    }

    // POST /api/sales  → record an order (managers + procurement). Nothing moves yet.
    [Authorize(Roles = Roles.Procurement)]
    [HttpPost]
    public async Task<ActionResult<SaleDetailDto>> Create(SaleInputDto input)
    {
        var error = await ValidateInput(input, currentCustomerId: null);
        if (error is not null) return error;

        var sale = new Sale
        {
            CustomerId = input.CustomerId,
            Reference = Clean(input.Reference),
            Date = input.Date,
            Notes = Clean(input.Notes),
            Status = SaleStatuses.Ordered,
            CreatedById = CurrentUserId,
            Items = input.Items.Select(l => new SaleItem { ItemId = l.ItemId, Quantity = l.Quantity, UnitPrice = l.UnitPrice }).ToList(),
        };
        db.Sales.Add(sale);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = sale.Id }, await LoadDetail(sale.Id));
    }

    // PUT /api/sales/5  → change an order (managers + procurement). Only while it's
    // still an order: once delivered, undo the delivery first; cancelled ones are closed.
    [Authorize(Roles = Roles.Procurement)]
    [HttpPut("{id:int}")]
    public async Task<ActionResult<SaleDetailDto>> Update(int id, SaleInputDto input)
    {
        var sale = await db.Sales.Include(s => s.Items).FirstOrDefaultAsync(s => s.Id == id);
        if (sale is null) return NotFound();
        if (NotAnOrder(sale, "changed") is { } closed) return closed;

        var error = await ValidateInput(input, sale.CustomerId);
        if (error is not null) return error;

        // Every line id sent must be one of this sale's lines, used once.
        var existing = sale.Items.ToDictionary(li => li.Id);
        var sentIds = input.Items.Where(l => l.Id is not null).Select(l => l.Id!.Value).ToList();
        if (sentIds.Any(lid => !existing.ContainsKey(lid)) || sentIds.Distinct().Count() != sentIds.Count)
            return BadRequest(new { message = "One or more lines don't belong to this sale." });

        // --- work out what changed (names are snapshots for the history) ---
        var itemIds = input.Items.Select(l => l.ItemId).Concat(sale.Items.Select(li => li.ItemId)).Distinct().ToList();
        var items = await db.Items.Where(i => itemIds.Contains(i.Id)).ToDictionaryAsync(i => i.Id);
        var changes = new List<SaleChange>();

        if (sale.CustomerId != input.CustomerId)
            changes.Add(FieldChange("customer", await CustomerName(sale.CustomerId), await CustomerName(input.CustomerId)));
        if (sale.Date.Date != input.Date.Date)
            changes.Add(FieldChange("date", sale.Date.ToString("yyyy-MM-dd"), input.Date.ToString("yyyy-MM-dd")));
        if (sale.Reference != Clean(input.Reference))
            changes.Add(FieldChange("reference", sale.Reference, Clean(input.Reference)));
        if (sale.Notes != Clean(input.Notes))
            changes.Add(FieldChange("notes", sale.Notes, Clean(input.Notes)));

        // --- apply the header ---
        sale.CustomerId = input.CustomerId;
        sale.Reference = Clean(input.Reference);
        sale.Date = input.Date;
        sale.Notes = Clean(input.Notes);

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
                    changes.Add(new SaleChange(SaleChangeKinds.LineChanged, Item: item.Name, Unit: item.Unit,
                        FromQty: old.Quantity, ToQty: l.Quantity, FromPrice: old.UnitPrice, ToPrice: l.UnitPrice));
                }
                old.ItemId = l.ItemId;
                old.Quantity = l.Quantity;
                old.UnitPrice = l.UnitPrice;
            }
            else
            {
                changes.Add(LineAdded(item, l.Quantity, l.UnitPrice));
                sale.Items.Add(new SaleItem { ItemId = l.ItemId, Quantity = l.Quantity, UnitPrice = l.UnitPrice });
            }
        }
        foreach (var old in existing.Values.Where(li => !kept.Contains(li.Id)))
        {
            changes.Add(LineRemoved(items[old.ItemId], old.Quantity, old.UnitPrice));
            db.SaleItems.Remove(old);
        }

        if (changes.Count > 0) Log(sale.Id, SaleActions.Edited, changes);
        await db.SaveChangesAsync();
        return Ok(await LoadDetail(sale.Id));
    }

    // POST /api/sales/5/deliver  → the material leaves the warehouse now (managers + procurement).
    // Refused, with nothing changed, if the warehouse doesn't have it all.
    [Authorize(Roles = Roles.Procurement)]
    [HttpPost("{id:int}/deliver")]
    public async Task<ActionResult<SaleDetailDto>> Deliver(int id)
    {
        await using var change = await stock.BeginChange();
        var sale = await db.Sales.Include(s => s.Items).FirstOrDefaultAsync(s => s.Id == id);
        if (sale is null) return NotFound();
        if (NotAnOrder(sale, "delivered") is { } closed) return closed;

        var delta = new Dictionary<StockKey, int>();
        foreach (var li in sale.Items) StockService.Add(delta, null, li.ItemId, -li.Quantity);
        var shortfall = await stock.Apply(delta);
        if (shortfall is not null)
            return Conflict(new { message = $"Can't deliver — not enough stock. {shortfall}" });

        // What the material cost us, as of now (for profit in the sales report).
        var itemIds = sale.Items.Select(li => li.ItemId).Distinct().ToList();
        var costs = await db.Items.Where(i => itemIds.Contains(i.Id)).ToDictionaryAsync(i => i.Id, i => i.Price);
        foreach (var li in sale.Items) li.UnitCost = costs[li.ItemId];

        sale.Status = SaleStatuses.Delivered;
        sale.DeliveredAt = DateTime.UtcNow;
        sale.DeliveredById = CurrentUserId;
        Log(sale.Id, SaleActions.Delivered);

        await db.SaveChangesAsync();
        await change.CommitAsync();
        return Ok(await LoadDetail(sale.Id));
    }

    // POST /api/sales/5/undo-delivery  → the material comes back to the warehouse and the
    // sale is an order again (managers + procurement). Only while nothing has been paid.
    [Authorize(Roles = Roles.Procurement)]
    [HttpPost("{id:int}/undo-delivery")]
    public async Task<ActionResult<SaleDetailDto>> UndoDelivery(int id)
    {
        await using var change = await stock.BeginChange();
        var sale = await db.Sales.Include(s => s.Items).Include(s => s.Payments).FirstOrDefaultAsync(s => s.Id == id);
        if (sale is null) return NotFound();
        if (sale.Status != SaleStatuses.Delivered)
            return Conflict(new { message = "This sale hasn't been delivered." });
        if (sale.Payments.Count > 0)
            return Conflict(new { message = "This sale has payments. Remove them first, then undo the delivery." });

        var delta = new Dictionary<StockKey, int>();
        foreach (var li in sale.Items) StockService.Add(delta, null, li.ItemId, li.Quantity);
        await stock.Apply(delta); // adding to the warehouse can't fall short

        sale.Status = SaleStatuses.Ordered;
        sale.DeliveredAt = null;
        sale.DeliveredById = null;
        Log(sale.Id, SaleActions.DeliveryUndone);

        await db.SaveChangesAsync();
        await change.CommitAsync();
        return Ok(await LoadDetail(sale.Id));
    }

    // POST /api/sales/5/cancel  → call off an order (managers + procurement). Nothing has
    // moved, so nothing comes back; the record stays, marked cancelled.
    [Authorize(Roles = Roles.Procurement)]
    [HttpPost("{id:int}/cancel")]
    public async Task<ActionResult<SaleDetailDto>> Cancel(int id)
    {
        var sale = await db.Sales.Include(s => s.Payments).FirstOrDefaultAsync(s => s.Id == id);
        if (sale is null) return NotFound();
        if (NotAnOrder(sale, "cancelled") is { } closed) return closed;
        if (sale.Payments.Count > 0)
            return Conflict(new { message = "This sale has payments. Remove them first, then cancel it." });

        sale.Status = SaleStatuses.Cancelled;
        sale.CancelledAt = DateTime.UtcNow;
        sale.CancelledById = CurrentUserId;
        Log(sale.Id, SaleActions.Cancelled);

        await db.SaveChangesAsync();
        return Ok(await LoadDetail(sale.Id));
    }

    // POST /api/sales/5/payments  → record money received (managers + procurement).
    [Authorize(Roles = Roles.Procurement)]
    [HttpPost("{id:int}/payments")]
    public async Task<ActionResult<SaleDetailDto>> AddPayment(int id, PaymentInputDto input)
    {
        var sale = await db.Sales.Include(s => s.Items).Include(s => s.Payments).FirstOrDefaultAsync(s => s.Id == id);
        if (sale is null) return NotFound();
        if (sale.Status == SaleStatuses.Cancelled)
            return Conflict(new { message = "A cancelled sale can't take payments." });

        if (input.Amount <= 0)
            return BadRequest(new { message = "The amount must be more than zero." });
        var problem = InputRules.PriceProblem(input.Amount) ?? InputRules.DateProblem(input.Date);
        if (problem is not null)
            return BadRequest(new { message = problem });

        var total = sale.Items.Sum(li => li.Quantity * li.UnitPrice);
        var paid = sale.Payments.Sum(p => p.Amount);
        if (paid + input.Amount > total)
            return BadRequest(new { message = $"That's more than what remains to be paid ({total - paid:N2})." });

        var payment = new SalePayment
        {
            Date = input.Date,
            Amount = input.Amount,
            Note = Clean(input.Note),
            RecordedById = CurrentUserId,
        };
        sale.Payments.Add(payment);
        Log(sale.Id, SaleActions.PaymentAdded, [new SaleChange(SaleChangeKinds.Payment, Amount: input.Amount, Note: payment.Note)]);

        await db.SaveChangesAsync();
        return Ok(await LoadDetail(sale.Id));
    }

    // DELETE /api/sales/5/payments/7  → remove a payment recorded by mistake (managers + procurement).
    [Authorize(Roles = Roles.Procurement)]
    [HttpDelete("{id:int}/payments/{paymentId:int}")]
    public async Task<IActionResult> RemovePayment(int id, int paymentId)
    {
        var payment = await db.SalePayments.FirstOrDefaultAsync(p => p.Id == paymentId && p.SaleId == id);
        if (payment is null) return NotFound();

        Log(id, SaleActions.PaymentRemoved, [new SaleChange(SaleChangeKinds.Payment, Amount: payment.Amount, Note: payment.Note)]);
        db.SalePayments.Remove(payment);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // --- helpers ---

    // Why this sale can't take the action (it isn't an order any more), or null when it can.
    private ActionResult? NotAnOrder(Sale sale, string action) => sale.Status switch
    {
        SaleStatuses.Ordered => null,
        SaleStatuses.Delivered => Conflict(new { message = $"This sale has been delivered and can't be {action}. Undo the delivery first." }),
        _ => Conflict(new { message = $"This sale was cancelled and can't be {action}." }),
    };

    // Checks the header and lines shared by create and edit. Returns an error, or null when valid.
    // An inactive customer is refused for a new sale, and when an order is moved to them.
    private async Task<ActionResult?> ValidateInput(SaleInputDto input, int? currentCustomerId)
    {
        var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == input.CustomerId);
        if (customer is null)
            return BadRequest(new { message = "Customer not found." });
        if (customer.Status != CustomerStatuses.Active && input.CustomerId != currentCustomerId)
            return BadRequest(new { message = $"{customer.Name} is inactive. Set the customer to Active first." });

        if (input.Items is null || input.Items.Count == 0)
            return BadRequest(new { message = "At least one line is required." });
        if (input.Items.Any(l => l.Quantity <= 0))
            return BadRequest(new { message = "Every line must have a quantity greater than zero." });
        var problem = InputRules.DateProblem(input.Date)
            ?? input.Items.Select(l => InputRules.QuantityProblem(l.Quantity) ?? InputRules.PriceProblem(l.UnitPrice)).FirstOrDefault(p => p is not null);
        if (problem is not null)
            return BadRequest(new { message = problem });

        var itemIds = input.Items.Select(l => l.ItemId).Distinct().ToList();
        if (await db.Items.CountAsync(i => itemIds.Contains(i.Id)) != itemIds.Count)
            return BadRequest(new { message = "One or more items were not found." });

        return null;
    }

    // Adds a history entry (the caller saves).
    private void Log(int saleId, string action, List<SaleChange>? changes = null) =>
        db.SaleEvents.Add(new SaleEvent
        {
            SaleId = saleId,
            Action = action,
            ActorId = CurrentUserId,
            Changes = JsonSerializer.Serialize(changes ?? [], HistoryJson),
        });

    private async Task<string?> CustomerName(int id) =>
        await db.Customers.Where(c => c.Id == id).Select(c => c.Name).FirstOrDefaultAsync();

    private static SaleChange FieldChange(string field, string? from, string? to) =>
        new(SaleChangeKinds.Field, Field: field, From: from, To: to);

    private static SaleChange LineAdded(Item item, int qty, decimal price) =>
        new(SaleChangeKinds.LineAdded, Item: item.Name, Unit: item.Unit, ToQty: qty, ToPrice: price);

    private static SaleChange LineRemoved(Item item, int qty, decimal price) =>
        new(SaleChangeKinds.LineRemoved, Item: item.Name, Unit: item.Unit, FromQty: qty, FromPrice: price);

    private async Task<SaleDetailDto?> LoadDetail(int id)
    {
        var s = await db.Sales.AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.CreatedBy)
            .Include(x => x.DeliveredBy)
            .Include(x => x.CancelledBy)
            .Include(x => x.Items).ThenInclude(li => li.Item)
            .Include(x => x.Payments).ThenInclude(p => p.RecordedBy)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (s is null) return null;

        var lines = s.Items.OrderBy(li => li.Id).Select(li => new SaleLineDto(
            li.Id,
            li.ItemId,
            li.Item?.Name ?? "",
            li.Item?.Code ?? "",
            li.Item?.Unit ?? "",
            li.Quantity,
            li.UnitPrice,
            li.Quantity * li.UnitPrice)).ToList();

        var payments = s.Payments.OrderBy(p => p.Date).ThenBy(p => p.Id).Select(p => new SalePaymentDto(
            p.Id, p.Date, p.Amount, p.Note, p.RecordedBy?.FullName ?? "", p.CreatedAt)).ToList();

        var events = await db.SaleEvents.AsNoTracking()
            .Where(e => e.SaleId == id)
            .Include(e => e.Actor)
            .OrderBy(e => e.Id)
            .ToListAsync();
        var history = events.Select(e => new SaleEventDto(
            e.Id,
            e.Action,
            e.Actor?.FullName ?? "",
            e.CreatedAt,
            JsonSerializer.Deserialize<List<SaleChange>>(e.Changes, HistoryJson) ?? [])).ToList();

        var total = lines.Sum(l => l.LineTotal);
        var paid = payments.Sum(p => p.Amount);

        return new SaleDetailDto(
            s.Id,
            s.CustomerId,
            s.Customer?.Name ?? "",
            s.Reference,
            s.Date,
            s.Notes,
            s.Status,
            PaymentStatuses.For(total, paid),
            s.CreatedBy?.FullName ?? "",
            s.CreatedAt,
            s.DeliveredBy?.FullName,
            s.DeliveredAt,
            s.CancelledBy?.FullName,
            s.CancelledAt,
            total,
            paid,
            total - paid,
            lines,
            payments,
            history);
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
