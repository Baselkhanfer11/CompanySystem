namespace CompanySystem.Api.Models;

/// <summary>
/// One entry in a document's history — who did what, when, and why. Together
/// these form the audit trail the CEO can trace for any document.
/// </summary>
public class DocumentEvent
{
    public int Id { get; set; }

    public int DocumentId { get; set; }
    public Document? Document { get; set; }

    // What happened. One of DocumentActions.
    public string Action { get; set; } = string.Empty;

    // Who did it.
    public int ActorId { get; set; }
    public User? Actor { get; set; }

    // Optional note (required when returning a document for edits).
    public string? Note { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>The kinds of actions recorded in a document's history.</summary>
public static class DocumentActions
{
    public const string Submitted = "Submitted";     // engineer uploaded it
    public const string Approved = "Approved";        // manager or CEO approved
    public const string Returned = "Returned";        // sent back to the engineer
    public const string Resubmitted = "Resubmitted";  // engineer re-uploaded after a return
}
