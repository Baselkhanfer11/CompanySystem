namespace CompanySystem.Api.Dtos;

// What the frontend sends to create/update a project.
public record ProjectInputDto(string Name, string Code, string Status, string? Description);
