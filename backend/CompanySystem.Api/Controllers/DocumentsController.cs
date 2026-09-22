using System.Security.Claims;
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
[Route("api/[controller]")] // → /api/documents
public class DocumentsController(AppDbContext db, FileStorage storage) : ControllerBase
{
    // Only Excel files, up to 10 MB.
    private static readonly string[] AllowedExtensions = { ".xlsx", ".xls" };
    private const long MaxFileSize = 10 * 1024 * 1024;

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // GET /api/documents  → list all documents (newest first)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<DocumentDto>>> GetAll()
    {
        var docs = await db.Documents
            .Include(d => d.Project)
            .Include(d => d.UploadedBy)
            .OrderByDescending(d => d.Id)
            .ToListAsync();
        return Ok(docs.Select(ToDto));
    }

    // POST /api/documents  → upload a new document (any signed-in user = engineer)
    [HttpPost]
    public async Task<ActionResult<DocumentDto>> Upload([FromForm] string title, [FromForm] int projectId, IFormFile? file)
    {
        if (string.IsNullOrWhiteSpace(title))
            return BadRequest(new { message = "Title is required." });

        var fileError = ValidateFile(file);
        if (fileError is not null) return BadRequest(new { message = fileError });

        var project = await db.Projects.FindAsync(projectId);
        if (project is null)
            return BadRequest(new { message = "The selected project was not found." });

        var storedName = await storage.SaveAsync(file!);
        var doc = new Document
        {
            Title = title.Trim(),
            ProjectId = projectId,
            FileName = Path.GetFileName(file!.FileName),
            StoredName = storedName,
            ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
            FileSize = file.Length,
            Status = DocumentStatuses.PendingManager,
            UploadedById = CurrentUserId,
        };
        db.Documents.Add(doc);
        await db.SaveChangesAsync();

        LogEvent(doc.Id, DocumentActions.Submitted, null);
        await db.SaveChangesAsync();

        await db.Entry(doc).Reference(d => d.Project).LoadAsync();
        await db.Entry(doc).Reference(d => d.UploadedBy).LoadAsync();
        return CreatedAtAction(nameof(GetAll), new { id = doc.Id }, ToDto(doc));
    }

    // GET /api/documents/5/file  → download the stored file
    [HttpGet("{id:int}/file")]
    public async Task<IActionResult> Download(int id)
    {
        var doc = await db.Documents.FindAsync(id);
        if (doc is null) return NotFound();

        var stream = storage.OpenRead(doc.StoredName);
        if (stream is null) return NotFound(new { message = "The file is missing from storage." });

        return File(stream, doc.ContentType, doc.FileName);
    }

    // POST /api/documents/5/approve  → approve at the current stage (moves it up)
    [HttpPost("{id:int}/approve")]
    public async Task<IActionResult> Approve(int id)
    {
        var doc = await db.Documents.FindAsync(id);
        if (doc is null) return NotFound();
        if (!CanReview(doc)) return Forbidden("You can't review this document right now.");

        // Manager stage → CEO stage; CEO stage → final Approved.
        doc.Status = doc.Status == DocumentStatuses.PendingManager
            ? DocumentStatuses.PendingCEO
            : DocumentStatuses.Approved;
        doc.UpdatedAt = DateTime.UtcNow;

        LogEvent(doc.Id, DocumentActions.Approved, null);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/documents/5/return  → send back to the engineer (note required)
    [HttpPost("{id:int}/return")]
    public async Task<IActionResult> ReturnToEngineer(int id, ReviewNoteDto body)
    {
        var doc = await db.Documents.FindAsync(id);
        if (doc is null) return NotFound();
        if (!CanReview(doc)) return Forbidden("You can't review this document right now.");
        if (string.IsNullOrWhiteSpace(body.Note))
            return BadRequest(new { message = "A note is required when returning a document." });

        doc.Status = DocumentStatuses.Returned;
        doc.UpdatedAt = DateTime.UtcNow;

        LogEvent(doc.Id, DocumentActions.Returned, body.Note.Trim());
        await db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/documents/5/reject  → reject and remove the document ("kill it")
    [HttpPost("{id:int}/reject")]
    public async Task<IActionResult> Reject(int id)
    {
        var doc = await db.Documents.FindAsync(id);
        if (doc is null) return NotFound();
        if (!CanReview(doc)) return Forbidden("You can't review this document right now.");

        storage.Delete(doc.StoredName);
        db.Documents.Remove(doc); // history events cascade-delete with it
        await db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/documents/5/resubmit  → engineer re-uploads a returned document
    [HttpPost("{id:int}/resubmit")]
    public async Task<IActionResult> Resubmit(int id, IFormFile? file)
    {
        var doc = await db.Documents.FindAsync(id);
        if (doc is null) return NotFound();
        if (doc.UploadedById != CurrentUserId)
            return Forbidden("Only the person who uploaded a document can resubmit it.");
        if (doc.Status != DocumentStatuses.Returned)
            return BadRequest(new { message = "Only a returned document can be resubmitted." });

        var fileError = ValidateFile(file);
        if (fileError is not null) return BadRequest(new { message = fileError });

        storage.Delete(doc.StoredName); // drop the old file
        doc.StoredName = await storage.SaveAsync(file!);
        doc.FileName = Path.GetFileName(file!.FileName);
        doc.ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType;
        doc.FileSize = file.Length;
        doc.Status = DocumentStatuses.PendingManager; // starts the pipeline again
        doc.UpdatedAt = DateTime.UtcNow;

        LogEvent(doc.Id, DocumentActions.Resubmitted, null);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // --- helpers ---

    // Can the current user review this document at its current stage?
    // Manager stage → WarehouseManager; CEO stage → Administrator.
    private bool CanReview(Document doc) =>
        (doc.Status == DocumentStatuses.PendingManager && User.IsInRole(Roles.WarehouseManager)) ||
        (doc.Status == DocumentStatuses.PendingCEO && User.IsInRole(Roles.Administrator));

    // Validates an uploaded file. Returns an error message, or null when valid.
    private static string? ValidateFile(IFormFile? file)
    {
        if (file is null || file.Length == 0) return "A file is required.";
        if (file.Length > MaxFileSize) return "File is too large (max 10 MB).";
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (Array.IndexOf(AllowedExtensions, ext) < 0) return "Only Excel files (.xlsx, .xls) are allowed.";
        return null;
    }

    // Adds a history entry (call SaveChangesAsync afterwards).
    private void LogEvent(int documentId, string action, string? note) =>
        db.DocumentEvents.Add(new DocumentEvent
        {
            DocumentId = documentId,
            Action = action,
            ActorId = CurrentUserId,
            Note = note,
        });

    private ObjectResult Forbidden(string message) => StatusCode(StatusCodes.Status403Forbidden, new { message });

    // Projects the metadata row into the DTO (with related names).
    private static DocumentDto ToDto(Document d) => new(
        d.Id,
        d.Title,
        d.ProjectId,
        d.Project!.Name,
        d.FileName,
        d.FileSize,
        d.Status,
        d.UploadedById,
        d.UploadedBy!.FullName,
        d.CreatedAt,
        d.UpdatedAt);
}
