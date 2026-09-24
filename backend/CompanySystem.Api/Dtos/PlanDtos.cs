namespace CompanySystem.Api.Dtos;

// ---- What the frontend sends ----

// One line of the plan. The whole plan is sent at once; a line left out (or
// with 0) is removed.
public record PlanLineInputDto(int ItemId, int Planned);

// ---- What the API returns ----

// One item on a project: planned vs. what's already on the site.
// Money is estimated at the item's current price.
public record PlanLineDto(
    int ItemId,
    string Name,
    string Code,
    string Unit,
    decimal Price,
    int Planned,
    int OnSite,
    int StillNeeded,     // planned − on site (never below 0)
    decimal StillToSpend, // still needed × price
    bool InPlan);        // false = on the site but not planned

// A project's material plan with its money summary.
public record ProjectPlanDto(
    int ProjectId,
    string Name,
    string Code,
    string Status,
    IReadOnlyList<PlanLineDto> Lines,
    decimal EstimatedBudget, // planned × price
    decimal SpentSoFar,      // what the material on the site actually cost
    decimal StillToSpend,    // still needed × price
    int Progress,            // % of the planned material (by value) that's on site
    string? UpdatedByName,
    DateTime? UpdatedAt);

// How much one project still needs of an item.
public record ShortageNeedDto(int ProjectId, string ProjectName, int StillNeeded);

// One item across every open project: what's still needed, what the warehouse
// can cover, and what has to be bought.
public record ShortageDto(
    int ItemId,
    string Name,
    string Code,
    string Unit,
    decimal Price,
    int Needed,
    int InWarehouse,
    int ToBuy,
    decimal EstimatedCost, // to buy × price
    IReadOnlyList<ShortageNeedDto> Projects);
