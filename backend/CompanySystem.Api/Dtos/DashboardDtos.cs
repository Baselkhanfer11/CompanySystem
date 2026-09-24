namespace CompanySystem.Api.Dtos;

// Everything the home dashboard needs, in one response.
// (Stock alerts and shortages aren't here: the frontend already has them cached.)
public record DashboardDto(
    int Employees,
    int ActiveEmployees,
    IReadOnlyList<RecentEmployeeDto> RecentEmployees,
    int ActiveProjects,
    decimal? CostThisMonth, // project costs — null for people who can't see costs
    decimal? CostLastMonth,
    IReadOnlyList<ProjectProgressDto> Projects,
    IReadOnlyList<ActivityDto> Activity);

public record RecentEmployeeDto(int Id, string FullName, string? Position, string? Email);

// One open project and how far its material plan is.
public record ProjectProgressDto(
    int Id,
    string Name,
    string Code,
    string Status,
    bool HasPlan,
    int Progress,        // 0-100
    decimal StillToSpend,
    int ItemsOnSite);

// One recent purchase or stock movement, newest first.
// Kind: "Purchase", "Issue" (sent to a site) or "Return".
public record ActivityDto(
    string Kind,
    int Id,
    string ActorName,
    string? SupplierName, // purchases
    string? ProjectName,  // the site (null = a purchase delivered to the warehouse)
    IReadOnlyList<string> Items,
    decimal Total,
    DateTime CreatedAt);
