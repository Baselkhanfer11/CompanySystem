namespace CompanySystem.Api.Models;

/// <summary>
/// One line of a project's material plan: how much of an item the project is
/// expected to need in total. Compared with what's already on the site, it
/// tells us what's still needed — and, against the warehouse, what to buy.
/// </summary>
public class ProjectMaterial
{
    public int Id { get; set; }

    public int ProjectId { get; set; }
    public Project? Project { get; set; }

    public int ItemId { get; set; }
    public Item? Item { get; set; }

    // The total quantity the project needs (not "still needed" — that's worked out).
    public int PlannedQuantity { get; set; }

    // Who last changed this line, and when.
    public int UpdatedById { get; set; }
    public User? UpdatedBy { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
