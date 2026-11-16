using System.ComponentModel.DataAnnotations;
using CompanySystem.Api.Services;

namespace CompanySystem.Api.Dtos;

// What the frontend sends to create/update a customer.
public record CustomerInputDto(
    [MaxLength(TextLimits.Name)] string Name,
    [MaxLength(TextLimits.Code)] string Code,
    [MaxLength(TextLimits.Name)] string? ContactPerson,
    [MaxLength(TextLimits.Short)] string? Phone,
    [MaxLength(TextLimits.Email)] string? Email,
    [MaxLength(TextLimits.Address)] string? Address,
    [MaxLength(TextLimits.Notes)] string? Notes,
    [MaxLength(TextLimits.Short)] string Status);
