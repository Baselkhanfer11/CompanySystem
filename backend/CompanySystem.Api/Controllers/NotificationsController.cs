using System.Security.Claims;
using CompanySystem.Api.Data;
using CompanySystem.Api.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CompanySystem.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")] // → /api/notifications
public class NotificationsController(AppDbContext db) : ControllerBase
{
    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // GET /api/notifications  → the current user's notifications (newest first)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<NotificationDto>>> GetMine()
    {
        var mine = await db.Notifications
            .Where(n => n.RecipientId == CurrentUserId)
            .OrderByDescending(n => n.Id)
            .Take(50)
            .Select(n => new NotificationDto(n.Id, n.Type, n.Title, n.DocumentId, n.Note, n.IsRead, n.CreatedAt))
            .ToListAsync();
        return Ok(mine);
    }

    // POST /api/notifications/read  → mark all of the current user's notifications read
    [HttpPost("read")]
    public async Task<IActionResult> MarkAllRead()
    {
        await db.Notifications
            .Where(n => n.RecipientId == CurrentUserId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));
        return NoContent();
    }
}
