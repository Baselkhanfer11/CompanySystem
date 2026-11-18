namespace CompanySystem.Api.Dtos;

// ---- Cost-per-project report ----
//
// A project's cost = material delivered straight to its site (purchases)
//                  + material sent to it from the warehouse (issues)
//                  − material returned to the warehouse (returns).
// Purchases delivered to the warehouse aren't anyone's cost yet — they become
// a project's cost when that stock is sent to a site.

// One bucket: a project, or the Warehouse (ProjectId = null) — the purchases
// delivered to the warehouse.
public record ProjectCostRowDto(
    int? ProjectId,
    string Name,
    string? Code,
    string? Status,
    decimal Total,
    decimal Delivered,     // bought straight to the site
    decimal FromWarehouse, // sent from the warehouse, minus returns
    int PurchaseCount,
    int MovementCount);

// Total in one calendar month.
public record MonthlySpendDto(int Year, int Month, decimal Total);

// The overview: headline totals, every project's cost, the Warehouse bucket,
// and a month-by-month trend of project costs for the selected period.
public record ProjectCostsReportDto(
    decimal ProjectCost,        // what all projects cost
    decimal PurchaseTotal,      // everything bought from suppliers
    decimal WarehousePurchases, // bought into the warehouse
    decimal SentFromWarehouse,  // warehouse stock sent to sites, minus returns
    int PurchaseCount,
    int MovementCount,
    IReadOnlyList<ProjectCostRowDto> Projects,
    ProjectCostRowDto Warehouse,
    IReadOnlyList<MonthlySpendDto> Monthly);

// ---- Drill-down for one project (or the Warehouse) ----

// Where the money came from: a supplier, or the warehouse (SupplierId = null).
public record CostSourceDto(int? SupplierId, string Name, decimal Total, int Count);

public record ItemSpendDto(int ItemId, string Name, string Code, string Unit, int Quantity, decimal Total);

// ---- Sales report ----
//
// A sale counts when it's delivered (the day the material left the warehouse),
// never as an order and never once cancelled.
//   Revenue = Σ quantity × selling price
//   Cost    = Σ quantity × the item's price on delivery (SaleItem.UnitCost)
//   Profit  = Revenue − Cost
// Collected is money received in the period (payment dates), deposits included.

public record SalesMonthDto(int Year, int Month, decimal Revenue, decimal Cost, decimal Profit);

public record CustomerSalesDto(
    int CustomerId, string Name, string Code,
    int SaleCount, decimal Revenue, decimal Profit,
    decimal Owed); // still to pay on these sales, today

public record ItemSalesDto(
    int ItemId, string Name, string Code, string Unit,
    int Quantity, decimal Revenue, decimal Cost, decimal Profit);

public record SalesReportDto(
    decimal Revenue,
    decimal Cost,
    decimal Profit,
    decimal? MarginPercent, // profit ÷ revenue × 100, null with no revenue
    int SaleCount,
    decimal Collected,
    IReadOnlyList<SalesMonthDto> Monthly,
    IReadOnlyList<CustomerSalesDto> ByCustomer, // most revenue first
    IReadOnlyList<ItemSalesDto> ByItem);        // most revenue first

public record ProjectCostDetailDto(
    int? ProjectId,
    string Name,
    string? Code,
    string? Status,
    decimal Total,
    int PurchaseCount,
    int MovementCount,
    IReadOnlyList<CostSourceDto> BySource,
    IReadOnlyList<ItemSpendDto> ByItem,
    IReadOnlyList<MonthlySpendDto> Monthly,
    IReadOnlyList<PurchaseListDto> RecentPurchases,
    IReadOnlyList<StockMovementListDto> RecentMovements);
