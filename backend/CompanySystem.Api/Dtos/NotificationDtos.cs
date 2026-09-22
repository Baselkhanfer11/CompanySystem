namespace CompanySystem.Api.Dtos;

// A notification as the frontend bell sees it.
public record NotificationDto(
    int Id,
    string Type,
    string Title,
    int? DocumentId,
    string? Note,
    bool IsRead,
    DateTime CreatedAt);
