namespace CompanySystem.Api.Dtos;

// What the frontend sees for a document in the list. The physical file is
// fetched separately via GET /api/documents/{id}/file.
public record DocumentDto(
    int Id,
    string Title,
    int ProjectId,
    string ProjectName,
    string FileName,
    long FileSize,
    string Status,
    int UploadedById,
    string UploadedByName,
    DateTime CreatedAt,
    DateTime UpdatedAt);

// Body for returning a document to the engineer (the note is required there).
public record ReviewNoteDto(string? Note);
