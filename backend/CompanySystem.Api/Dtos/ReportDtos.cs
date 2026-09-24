namespace CompanySystem.Api.Dtos;

// ---- Cost-per-project report ----

// Spend for one bucket: a project, or the "General" bucket (ProjectId = null)
// for purchases that aren't charged to any project.
public record ProjectCostRowDto(
    int? ProjectId,
    string Name,
    string? Code,
    string? Status,
    decimal Total,
    int PurchaseCount,
    DateTime? LastPurchaseDate);

// Total spend in one calendar month.
public record MonthlySpendDto(int Year, int Month, decimal Total);

// The overview: headline totals, every project's spend, the General bucket,
// and a month-by-month trend for the selected period.
public record ProjectCostsReportDto(
    decimal TotalSpend,
    decimal ProjectSpend,
    decimal GeneralSpend,
    int PurchaseCount,
    IReadOnlyList<ProjectCostRowDto> Projects,
    ProjectCostRowDto General,
    IReadOnlyList<MonthlySpendDto> Monthly);

// ---- Drill-down for one project (or General) ----

public record SupplierSpendDto(int SupplierId, string Name, decimal Total, int PurchaseCount);

public record ItemSpendDto(int ItemId, string Name, string Code, string Unit, int Quantity, decimal Total);

public record ProjectCostDetailDto(
    int? ProjectId,
    string Name,
    string? Code,
    string? Status,
    decimal Total,
    int PurchaseCount,
    IReadOnlyList<SupplierSpendDto> BySupplier,
    IReadOnlyList<ItemSpendDto> ByItem,
    IReadOnlyList<MonthlySpendDto> Monthly,
    IReadOnlyList<PurchaseListDto> Recent);
