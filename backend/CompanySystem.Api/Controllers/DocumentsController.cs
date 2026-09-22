using System.Security.Claims;
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
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "A file is required." });
        if (file.Length > MaxFileSize)
            return BadRequest(new { message = "File is too large (max 10 MB)." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (Array.IndexOf(AllowedExtensions, ext) < 0)
            return BadRequest(new { message = "Only Excel files (.xlsx, .xls) are allowed." });

        var project = await db.Projects.FindAsync(projectId);
        if (project is null)
            return BadRequest(new { message = "The selected project was not found." });

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var storedName = await storage.SaveAsync(file);

        var doc = new Document
        {
            Title = title.Trim(),
            ProjectId = projectId,
            FileName = Path.GetFileName(file.FileName),
            StoredName = storedName,
            ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
            FileSize = file.Length,
            Status = DocumentStatuses.PendingManager,
            UploadedById = userId,
        };
        db.Documents.Add(doc);
        await db.SaveChangesAsync();

        // Load the related names so the returned DTO is complete.
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
