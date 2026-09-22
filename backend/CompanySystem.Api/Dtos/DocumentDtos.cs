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

// One entry in a document's history (who did what, when).
public record DocumentEventDto(
    int Id,
    string Action,
    string ActorName,
    string? Note,
    DateTime CreatedAt);

// A document plus its full history — powers the trace/timeline view.
public record DocumentDetailDto(
    DocumentDto Document,
    IReadOnlyList<DocumentEventDto> Events);
