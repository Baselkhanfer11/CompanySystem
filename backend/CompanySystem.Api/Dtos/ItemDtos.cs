namespace CompanySystem.Api.Dtos;

// What the frontend sends to create/update an item.
public record ItemInputDto(string Name, string Code, int Quantity, string Unit, decimal Price);
