using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace CompanySystem.Api.Tests;

/// <summary>
/// Stock and money stay right: no more can leave than is there (even when people
/// click at the same moment), editing an item never puts old stock back, prices
/// keep 4 decimals, a site's cost never goes below zero, and typos are refused.
/// </summary>
public class StockSafetyTests(ApiFactory api) : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private HttpClient _admin = null!;
    private int _supplierId;
    private static readonly string Today = DateTime.UtcNow.ToString("yyyy-MM-dd");

    public async Task InitializeAsync()
    {
        _admin = await api.SignInAsAdmin();
        _supplierId = await Id(_admin.PostAsJsonAsync("/api/suppliers", new { name = "Supplier", code = Code(), status = "Active" }));
    }

    public Task DisposeAsync() => Task.CompletedTask;

    // ---- simultaneous sends ----

    [Fact]
    public async Task Simultaneous_sends_never_take_more_than_is_in_the_warehouse()
    {
        var item = await NewItem(quantity: 30);
        var site = await NewSite();

        // Ten people each send 10 at the same moment; only 30 are there.
        var sends = Enumerable.Range(0, 10).Select(_ => Send(site, item, 10));
        var results = await Task.WhenAll(sends);

        Assert.Equal(3, results.Count(r => r.IsSuccessStatusCode));
        Assert.All(results.Where(r => !r.IsSuccessStatusCode), r => Assert.Equal(HttpStatusCode.Conflict, r.StatusCode));
        Assert.Equal(0, await WarehouseQty(item));
        Assert.Equal(30, (await OnSite(site, item)).Qty);
    }

    [Fact]
    public async Task Simultaneous_purchases_into_the_warehouse_all_count()
    {
        var item = await NewItem(quantity: 0);
        var buys = Enumerable.Range(0, 8).Select(_ => Buy(null, item, 5, 2m));
        Assert.All(await Task.WhenAll(buys), r => r.EnsureSuccessStatusCode());
        Assert.Equal(40, await WarehouseQty(item));
    }

    // ---- editing an item ----

    [Fact]
    public async Task Editing_an_item_does_not_put_old_stock_back()
    {
        var item = await NewItem(quantity: 10);
        var site = await NewSite();
        // The form is opened showing 10; meanwhile 8 are sent out.
        (await Send(site, item, 8)).EnsureSuccessStatusCode();

        // Saving a new price from that form leaves the warehouse at 2.
        (await EditItem(item, quantity: 10, quantityWas: 10, price: 9m)).EnsureSuccessStatusCode();
        Assert.Equal(2, await WarehouseQty(item));

        // An older form that doesn't say what it showed can't change stock either.
        (await EditItem(item, quantity: 10, quantityWas: null, price: 9m)).EnsureSuccessStatusCode();
        Assert.Equal(2, await WarehouseQty(item));
    }

    [Fact]
    public async Task A_stock_count_correction_works_but_not_from_an_out_of_date_form()
    {
        var item = await NewItem(quantity: 10);
        var site = await NewSite();

        // Corrected from 10 to 12 on an up-to-date form.
        (await EditItem(item, quantity: 12, quantityWas: 10, price: 5m)).EnsureSuccessStatusCode();
        Assert.Equal(12, await WarehouseQty(item));

        // Opened at 12, then 4 were sent: a "correction" to 11 would be a guess.
        (await Send(site, item, 4)).EnsureSuccessStatusCode();
        var stale = await EditItem(item, quantity: 11, quantityWas: 12, price: 5m);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Equal(8, await WarehouseQty(item));
    }

    // ---- prices with 4 decimals ----

    [Fact]
    public async Task Prices_keep_four_decimals()
    {
        var item = await NewItem(quantity: 0, price: 0.075m);
        Assert.Equal(0.075m, (await GetJson($"/api/items/{item}")).GetProperty("price").GetDecimal());

        var purchase = await Id(Buy(null, item, 1000, 0.0751m));
        var line = (await GetJson($"/api/purchases/{purchase}")).GetProperty("items")[0];
        Assert.Equal(0.0751m, line.GetProperty("unitPrice").GetDecimal());
        Assert.Equal(75.1m, line.GetProperty("lineTotal").GetDecimal());
    }

    [Fact]
    public async Task More_than_four_decimals_is_refused_not_rounded()
    {
        var item = await NewItem(quantity: 0);
        Assert.Equal(HttpStatusCode.BadRequest, (await Buy(null, item, 1, 0.07505m)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await EditItem(item, 0, 0, 1.00001m)).StatusCode);
    }

    // ---- a site's cost can't go below zero ----

    [Fact]
    public async Task A_price_change_after_a_return_is_refused()
    {
        var item = await NewItem(quantity: 0);
        var site = await NewSite();
        var purchase = await Id(Buy(site, item, 10, 6m)); // delivered to the site: 60
        (await Return(site, item, 10)).EnsureSuccessStatusCode(); // all back, at 6 each

        // Lowering the price now would leave the site at 0 pcs worth -40.
        var res = await EditPurchasePrice(purchase, site, 2m);
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.Equal((0, 0m), await OnSite(site, item));

        // Deleting it would too.
        Assert.Equal(HttpStatusCode.Conflict, (await _admin.DeleteAsync($"/api/purchases/{purchase}")).StatusCode);
    }

    [Fact]
    public async Task A_price_change_before_any_return_still_works()
    {
        var item = await NewItem(quantity: 0);
        var site = await NewSite();
        var purchase = await Id(Buy(site, item, 10, 6m));

        (await EditPurchasePrice(purchase, site, 2m)).EnsureSuccessStatusCode();
        Assert.Equal((10, 20m), await OnSite(site, item));
    }

    [Fact]
    public async Task Undoing_a_send_after_a_return_is_refused()
    {
        var item = await NewItem(quantity: 20, price: 6m);
        var site = await NewSite();
        var first = await Id(Send(site, item, 10));     // 10 at 6
        (await EditItem(item, 10, 10, 2m)).EnsureSuccessStatusCode();
        (await Send(site, item, 10)).EnsureSuccessStatusCode(); // 10 at 2 → 20 pcs worth 80
        (await Return(site, item, 10)).EnsureSuccessStatusCode(); // 10 back at the average, 4

        // Undoing the first send would leave 0 pcs worth -20.
        var res = await _admin.DeleteAsync($"/api/stock/movements/{first}");
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.Equal((10, 40m), await OnSite(site, item));
    }

    // ---- typos ----

    [Theory]
    [InlineData("9999-12-31")]
    [InlineData("0001-01-01")]
    public async Task Impossible_dates_are_refused(string date)
    {
        var item = await NewItem(quantity: 5);
        var site = await NewSite();
        var buy = await _admin.PostAsJsonAsync("/api/purchases", new { supplierId = _supplierId, projectId = (int?)null, date, items = new[] { new { itemId = item, quantity = 1, unitPrice = 1m } } });
        var send = await _admin.PostAsJsonAsync("/api/stock/movements", new { type = "Issue", projectId = site, date, items = new[] { new { itemId = item, quantity = 1 } } });
        Assert.Equal(HttpStatusCode.BadRequest, buy.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, send.StatusCode);
    }

    [Fact]
    public async Task A_far_future_report_date_is_refused_not_a_crash()
    {
        var res = await _admin.GetAsync("/api/reports/project-costs?to=9999-12-31");
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Huge_quantities_are_refused()
    {
        var item = await NewItem(quantity: 0);
        Assert.Equal(HttpStatusCode.BadRequest, (await Buy(null, item, 2_000_000_000, 1m)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _admin.PostAsJsonAsync("/api/items",
            new { name = "Big", code = Code(), quantity = 2_000_000_000, unit = "pcs", price = 1 })).StatusCode);
    }

    // ---- helpers ----

    private static string Code() => $"S-{Guid.NewGuid():N}"[..12];

    private Task<int> NewItem(int quantity, decimal price = 5m) =>
        Id(_admin.PostAsJsonAsync("/api/items", new { name = "Item " + Code(), code = Code(), quantity, unit = "pcs", price }));

    private Task<int> NewSite() =>
        Id(_admin.PostAsJsonAsync("/api/projects", new { name = "Site " + Code(), code = Code(), status = "Active" }));

    private Task<HttpResponseMessage> Send(int site, int item, int quantity) =>
        _admin.PostAsJsonAsync("/api/stock/movements", new { type = "Issue", projectId = site, date = Today, items = new[] { new { itemId = item, quantity } } });

    private Task<HttpResponseMessage> Return(int site, int item, int quantity) =>
        _admin.PostAsJsonAsync("/api/stock/movements", new { type = "Return", projectId = site, date = Today, items = new[] { new { itemId = item, quantity } } });

    private Task<HttpResponseMessage> Buy(int? site, int item, int quantity, decimal unitPrice) =>
        _admin.PostAsJsonAsync("/api/purchases", new { supplierId = _supplierId, projectId = site, date = Today, items = new[] { new { itemId = item, quantity, unitPrice } } });

    private async Task<HttpResponseMessage> EditItem(int item, int quantity, int? quantityWas, decimal price)
    {
        var current = await GetJson($"/api/items/{item}");
        return await _admin.PutAsJsonAsync($"/api/items/{item}", new
        {
            name = current.GetProperty("name").GetString(),
            code = current.GetProperty("code").GetString(),
            quantity, quantityWas, unit = "pcs", price,
        });
    }

    // Changes the price on a one-line purchase, keeping everything else.
    private async Task<HttpResponseMessage> EditPurchasePrice(int purchase, int site, decimal unitPrice)
    {
        var line = (await GetJson($"/api/purchases/{purchase}")).GetProperty("items")[0];
        return await _admin.PutAsJsonAsync($"/api/purchases/{purchase}", new
        {
            supplierId = _supplierId, projectId = site, date = Today,
            items = new[] { new { id = line.GetProperty("id").GetInt32(), itemId = line.GetProperty("itemId").GetInt32(), quantity = line.GetProperty("quantity").GetInt32(), unitPrice } },
        });
    }

    private async Task<int> WarehouseQty(int item) => (await GetJson($"/api/items/{item}")).GetProperty("quantity").GetInt32();

    private async Task<(int Qty, decimal Value)> OnSite(int site, int item)
    {
        foreach (var row in (await GetJson($"/api/stock/on-site?projectId={site}")).EnumerateArray())
            if (row.GetProperty("itemId").GetInt32() == item)
                return (row.GetProperty("quantity").GetInt32(), row.GetProperty("value").GetDecimal());
        return (0, 0m); // nothing there is left out of the list
    }

    private async Task<JsonElement> GetJson(string path)
    {
        var res = (await _admin.GetAsync(path)).EnsureSuccessStatusCode();
        return await res.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static async Task<int> Id(Task<HttpResponseMessage> request)
    {
        var res = (await request).EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<ApiFactory.IdBody>())!.Id;
    }
}
