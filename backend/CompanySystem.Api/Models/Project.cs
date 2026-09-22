namespace CompanySystem.Api.Models;

/// <summary>
/// A project / site the company works on. Material issued from the warehouse
/// is charged to a project, so this is the "bucket" that project costs go into.
/// </summary>
public class Project
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    // A short unique code for the project, e.g. "PRJ-001".
    public string Code { get; set; } = string.Empty;

    // Where the project is in its life cycle. One of Project.Statuses.
    public string Status { get; set; } = ProjectStatuses.Active;

    // Optional free-text notes about the project.
    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// The allowed values for <see cref="Project.Status"/>. Kept as simple strings
/// (like roles) so the frontend can show/translate them easily. Add more here
/// later without a schema change.
/// </summary>
public static class ProjectStatuses
{
    public const string Active = "Active";
    public const string OnHold = "OnHold";
    public const string Completed = "Completed";

    public static readonly string[] All = { Active, OnHold, Completed };

    public static bool IsValid(string status) => Array.IndexOf(All, status) >= 0;
}
