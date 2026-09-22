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
[Route("api/[controller]")] // → /api/projects
public class ProjectsController(AppDbContext db) : ControllerBase
{
    // GET /api/projects  → list all projects (newest first)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Project>>> GetAll()
    {
        var projects = await db.Projects.OrderByDescending(p => p.Id).ToListAsync();
        return Ok(projects);
    }

    // GET /api/projects/5
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Project>> GetById(int id)
    {
        var project = await db.Projects.FindAsync(id);
        if (project is null) return NotFound();
        return Ok(project);
    }

    // POST /api/projects  → create (managers only)
    [Authorize(Roles = Roles.Managers)]
    [HttpPost]
    public async Task<ActionResult<Project>> Create(ProjectInputDto input)
    {
        var error = await Validate(input, null);
        if (error is not null) return error;

        var project = new Project
        {
            Name = input.Name.Trim(),
            Code = input.Code.Trim(),
            Status = input.Status,
            Description = string.IsNullOrWhiteSpace(input.Description) ? null : input.Description.Trim(),
        };
        db.Projects.Add(project);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = project.Id }, project);
    }

    // PUT /api/projects/5  → update (managers only)
    [Authorize(Roles = Roles.Managers)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, ProjectInputDto input)
    {
        var project = await db.Projects.FindAsync(id);
        if (project is null) return NotFound();

        var error = await Validate(input, id);
        if (error is not null) return error;

        project.Name = input.Name.Trim();
        project.Code = input.Code.Trim();
        project.Status = input.Status;
        project.Description = string.IsNullOrWhiteSpace(input.Description) ? null : input.Description.Trim();

        await db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/projects/5  → delete (managers only)
    [Authorize(Roles = Roles.Managers)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var project = await db.Projects.FindAsync(id);
        if (project is null) return NotFound();

        db.Projects.Remove(project);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // Shared validation. Returns an error result, or null when valid.
    private async Task<ActionResult?> Validate(ProjectInputDto input, int? excludeId)
    {
        if (string.IsNullOrWhiteSpace(input.Name))
            return BadRequest(new { message = "Name is required." });
        if (string.IsNullOrWhiteSpace(input.Code))
            return BadRequest(new { message = "Code is required." });
        if (!ProjectStatuses.IsValid(input.Status))
            return BadRequest(new { message = $"Status '{input.Status}' is not valid." });

        var code = input.Code.Trim();
        var exclude = excludeId ?? 0; // 0 matches no real project (ids start at 1)
        var codeTaken = await db.Projects.AnyAsync(p => p.Code == code && p.Id != exclude);
        if (codeTaken)
            return Conflict(new { message = $"Code '{code}' is already used by another project." });

        return null;
    }
}
