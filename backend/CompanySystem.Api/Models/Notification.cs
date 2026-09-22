namespace CompanySystem.Api.Models;

/// <summary>
/// A notification shown to one user in the bell. Stored independently of the
/// document (it keeps a copy of the title and only a loose DocumentId) so it
/// survives even when the document is rejected and removed.
/// </summary>
public class Notification
{
    public int Id { get; set; }

    // Who sees this notification.
    public int RecipientId { get; set; }
    public User? Recipient { get; set; }

    // What happened. One of NotificationTypes.
    public string Type { get; set; } = string.Empty;

    // The document's title at the time (snapshot — survives deletion).
    public string Title { get; set; } = string.Empty;

    // Loose reference to the document (may point to a now-deleted one). No FK,
    // so removing a document never removes its notifications.
    public int? DocumentId { get; set; }

    // Optional extra text (e.g. the reviewer's note when a document is returned).
    public string? Note { get; set; }

    public bool IsRead { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>The kinds of notifications a user can receive.</summary>
public static class NotificationTypes
{
    public const string NeedsReview = "NeedsReview"; // a doc reached your review stage
    public const string Approved = "Approved";       // your doc was approved (final)
    public const string Returned = "Returned";       // your doc was returned for edits
    public const string Rejected = "Rejected";       // your doc was rejected & removed
}
