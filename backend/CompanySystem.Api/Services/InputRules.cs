namespace CompanySystem.Api.Services;

/// <summary>
/// Limits on quantities, prices and dates typed into purchases, movements, items
/// and plans — so a typo (an extra zero, the year 9999) can't overflow a total or
/// break a report. Each check returns a readable problem, or null when fine.
/// </summary>
public static class InputRules
{
    public const int MaxQuantity = 1_000_000;       // on one line, one item, one plan line
    public const decimal MaxPrice = 1_000_000_000m; // per unit
    public const int PriceDecimals = 4;             // e.g. 0.0750 per screw (the database keeps 4)

    // Records are dated from 2000 up to tomorrow (tomorrow, so a time zone ahead
    // of UTC is never refused); reports can look up to 2099.
    private static readonly DateTime Earliest = new(2000, 1, 1);
    private static readonly DateTime LatestReport = new(2099, 12, 31);

    public static string? QuantityProblem(int quantity) =>
        quantity > MaxQuantity ? $"A quantity can't be more than {MaxQuantity:N0}." : null;

    public static string? PriceProblem(decimal price) =>
        price < 0 ? "Price can't be negative." :
        price > MaxPrice ? $"Price can't be more than {MaxPrice:N0}." :
        decimal.Round(price, PriceDecimals) != price ? $"Price can have at most {PriceDecimals} decimal places." :
        null;

    public static string? DateProblem(DateTime date) =>
        date < Earliest ? $"The date must be in {Earliest.Year} or later." :
        date.Date > DateTime.UtcNow.Date.AddDays(1) ? "The date can't be in the future." :
        null;

    public static string? ReportDateProblem(DateTime? date) =>
        date < Earliest || date > LatestReport ? $"Dates must be between {Earliest.Year} and {LatestReport.Year}." : null;
}
