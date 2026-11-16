using System.ComponentModel.DataAnnotations;
using CompanySystem.Api.Services;

namespace CompanySystem.Api.Dtos;

// What the frontend sends to create/update a project.
public record ProjectInputDto(
    [MaxLength(TextLimits.Name)] string Name,
    [MaxLength(TextLimits.Code)] string Code,
    [MaxLength(TextLimits.Short)] string Status,
    [MaxLength(TextLimits.Notes)] string? Description);
