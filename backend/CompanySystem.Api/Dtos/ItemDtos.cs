using System.ComponentModel.DataAnnotations;
using CompanySystem.Api.Services;

namespace CompanySystem.Api.Dtos;

// What the frontend sends to create/update an item.
// On an update, QuantityWas is the stock the form showed when it was opened: the
// count only changes when the person changed it (a stock count correction), and
// only if nobody moved stock in the meantime. Without it, Quantity is ignored.
public record ItemInputDto(
    [MaxLength(TextLimits.Name)] string Name,
    [MaxLength(TextLimits.Code)] string Code,
    int Quantity,
    [MaxLength(TextLimits.Short)] string Unit,
    decimal Price,
    int? QuantityWas = null);
