namespace CompanySystem.Api.Models;

/// <summary>
/// An uploaded document (an Excel file) that belongs to a project and travels
/// up an approval pipeline: Engineer submits → Manager → CEO. The physical file
/// is stored on disk (see FileStorage); this row holds its metadata + status.
/// </summary>
public class Document
{
    public int Id { get; set; }

    public string Title { get; set; } = string.Empty;

    // The project this document is for.
    public int ProjectId { get; set; }
    public Project? Project { get; set; }

    // The original file name the user uploaded, e.g. "budget-q1.xlsx".
    public string FileName { get; set; } = string.Empty;

    // The (unique, safe) name the file is actually saved under on disk. Internal.
    public string StoredName { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    // File size in bytes.
    public long FileSize { get; set; }

    // Where it is in the pipeline. One of DocumentStatuses.
    public string Status { get; set; } = DocumentStatuses.PendingManager;

    // Who uploaded it (the engineer).
    public int UploadedById { get; set; }
    public User? UploadedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Last time the document moved (approved / returned / resubmitted).
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// The approval-pipeline states. Kept as plain strings (like roles/project
/// statuses) so new states never need a schema change and the frontend can
/// translate them via t(`doc.status.{Status}`).
/// </summary>
public static class DocumentStatuses
{
    public const string PendingManager = "PendingManager"; // submitted, waiting on the manager
    public const string PendingCEO = "PendingCEO";         // manager approved, waiting on the CEO
    public const string Approved = "Approved";             // CEO approved — final
    public const string Returned = "Returned";             // sent back to the engineer to fix

    public static readonly string[] All = { PendingManager, PendingCEO, Approved, Returned };

    public static bool IsValid(string status) => Array.IndexOf(All, status) >= 0;
}
