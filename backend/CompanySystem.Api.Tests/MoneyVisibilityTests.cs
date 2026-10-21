using System.Net.Http.Json;
using System.Text.Json;
using CompanySystem.Api.Auth;

namespace CompanySystem.Api.Tests;

/// <summary>
/// Who sees which money. Cost figures (what material cost a project) are for
/// managers only; buying prices are for managers and the Procurement Officer;
/// an Employee sees no money at all.
/// </summary>
public class MoneyVisibilityTests(ApiFactory api) : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private int _projectId, _movementId;
    private HttpClient _manager = null!, _buyer = null!, _employee = null!;

    // One small set of data: an item bought into the warehouse, part of it sent
    // to a site, a purchase straight to that site, and a plan for the site.
    public async Task InitializeAsync()
    {
        var admin = await api.SignInAsAdmin();
        var item = await Id(admin.PostAsJsonAsync("/api/items", new { name = "Cement", code = Code(), quantity = 0, unit = "pcs", price = 6.5 }));
        var supplier = await Id(admin.PostAsJsonAsync("/api/suppliers", new { name = "Supplier", code = Code(), status = "Active" }));
        _projectId = await Id(admin.PostAsJsonAsync("/api/projects", new { name = "Site", code = Code(), status = "Active" }));
        await Id(admin.PostAsJsonAsync("/api/purchases", new { supplierId = supplier, projectId = (int?)null, date = "2026-10-01", items = new[] { new { itemId = item, quantity = 20, unitPrice = 6.0 } } }));
        await Id(admin.PostAsJsonAsync("/api/purchases", new { supplierId = supplier, projectId = _projectId, date = "2026-10-02", items = new[] { new { itemId = item, quantity = 5, unitPrice = 6.2 } } }));
        _movementId = await Id(admin.PostAsJsonAsync("/api/stock/movements", new { type = "Issue", projectId = _projectId, date = "2026-10-03", items = new[] { new { itemId = item, quantity = 4 } } }));
        (await admin.PutAsJsonAsync($"/api/projects/{_projectId}/plan", new[] { new { itemId = item, planned = 40 } })).EnsureSuccessStatusCode();

        _manager = (await api.CreatePerson(Roles.WarehouseManager, "Money manager")).Client;
        _buyer = (await api.CreatePerson(Roles.ProcurementOfficer, "Money buyer")).Client;
        _employee = (await api.CreatePerson(Roles.Employee, "Money employee")).Client;
    }

    public Task DisposeAsync() => Task.CompletedTask;

    // ---- Cost figures: managers only ----

    [Fact]
    public async Task Site_stock_values_are_for_managers_only()
    {
        Assert.True(Has(await Get(_manager, "/api/stock/on-site"), "value"));
        Assert.False(Has(await Get(_buyer, "/api/stock/on-site"), "value"));
        Assert.False(Has(await Get(_employee, "/api/stock/on-site"), "value"));
    }

    [Fact]
    public async Task Movement_values_are_for_managers_only()
    {
        Assert.True(Has(await Get(_manager, "/api/stock/movements"), "total"));
        Assert.False(Has(await Get(_buyer, "/api/stock/movements"), "total"));

        var detail = await Get(_buyer, $"/api/stock/movements/{_movementId}");
        Assert.False(Has(detail, "total"));
        Assert.False(Has(detail.GetProperty("lines")[0], "unitCost"));
        Assert.False(Has(detail.GetProperty("lines")[0], "lineTotal"));
        Assert.True(Has(detail.GetProperty("lines")[0], "quantity")); // the rest is still there
    }

    [Fact]
    public async Task Plan_budgets_are_for_managers_only()
    {
        var path = $"/api/projects/{_projectId}/plan";
        Assert.True(Has(await Get(_manager, path), "estimatedBudget"));
        var asBuyer = await Get(_buyer, path);
        Assert.False(Has(asBuyer, "estimatedBudget"));
        Assert.False(Has(asBuyer, "spentSoFar"));
        Assert.False(Has(asBuyer, "stillToSpend"));
        Assert.True(Has(asBuyer, "progress")); // not money
    }

    [Fact]
    public async Task Dashboard_money_is_for_managers_only()
    {
        var asManager = await Get(_manager, "/api/dashboard");
        Assert.True(Has(asManager.GetProperty("activity")[0], "total"));
        Assert.True(Has(asManager.GetProperty("projects")[0], "stillToSpend"));

        var asBuyer = await Get(_buyer, "/api/dashboard");
        Assert.False(Has(asBuyer.GetProperty("activity")[0], "total"));
        Assert.False(Has(asBuyer.GetProperty("projects")[0], "stillToSpend"));
    }

    // ---- Buying prices: managers and the Procurement Officer ----

    [Theory]
    [InlineData("/api/items", "price")]
    [InlineData("/api/purchases", "total")]
    [InlineData("/api/prices", "lastPrice")]
    [InlineData("/api/plans/shortages", "estimatedCost")]
    public async Task Buying_prices_are_for_managers_and_procurement_not_employees(string path, string field)
    {
        Assert.True(Has(await Get(_manager, path), field));
        Assert.True(Has(await Get(_buyer, path), field));
        Assert.False(Has(await Get(_employee, path), field));
    }

    [Fact]
    public async Task Employee_still_sees_everything_that_is_not_money()
    {
        var items = await Get(_employee, "/api/items");
        Assert.True(Has(items, "quantity"));
        Assert.True(Has(items, "name"));
        Assert.True(Has(await Get(_employee, "/api/stock/on-site"), "quantity"));
    }

    // ---- helpers ----

    private static string Code() => $"M-{Guid.NewGuid():N}"[..12];

    private static async Task<int> Id(Task<HttpResponseMessage> request)
    {
        var res = (await request).EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<ApiFactory.IdBody>())!.Id;
    }

    private static async Task<JsonElement> Get(HttpClient client, string path)
    {
        var res = await client.GetAsync(path);
        res.EnsureSuccessStatusCode();
        return await res.Content.ReadFromJsonAsync<JsonElement>();
    }

    // Does the object (or, for a list, its first row) carry this field?
    private static bool Has(JsonElement json, string field)
    {
        var row = json.ValueKind == JsonValueKind.Array ? json[0] : json;
        return row.TryGetProperty(field, out _);
    }
}
