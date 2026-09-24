namespace CompanySystem.Api.Dtos;

// What the frontend sends to create/update a supplier.
public record SupplierInputDto(
    string Name,
    string Code,
    string? ContactPerson,
    string? Phone,
    string? Email,
    string? Address,
    string? Notes,
    string Status);
