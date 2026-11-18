using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace CompanySystem.Api.Tests;

/// <summary>
/// Sales: an order moves nothing, a delivery takes exactly what the warehouse
/// has (never more, even when two people deliver at the same moment), payments
/// never exceed the total, and nothing can be undone once money is involved.
/// </summary>
public class SalesTests(ApiFactory api) : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private HttpClient _admin = null!;
    private int _customerId;
    private static readonly string Today = DateTime.UtcNow.ToString("yyyy-MM-dd");

    public async Task InitializeAsync()
    {
        _admin = await api.SignInAsAdmin();
        _customerId = await Id(_admin.PostAsJsonAsync("/api/customers", new { name = "Customer", code = Code(), status = "Active" }));
    }

    public Task DisposeAsync() => Task.CompletedTask;

    // ---- orders and deliveries ----

    [Fact]
    public async Task An_order_moves_nothing_a_delivery_takes_it_and_undo_brings_it_back()
    {
        var item = await NewItem(quantity: 10);
        var sale = await Id(Order(item, 4, 12.5m));
        Assert.Equal(10, await WarehouseQty(item));

        var delivered = await Post($"/api/sales/{sale}/deliver");
        Assert.Equal(HttpStatusCode.OK, delivered.StatusCode);
        Assert.Equal(6, await WarehouseQty(item));
        var detail = await GetJson($"/api/sales/{sale}");
        Assert.Equal("Delivered", detail.GetProperty("status").GetString());
        Assert.Equal("System Administrator", detail.GetProperty("deliveredByName").GetString());
        Assert.Equal(50m, detail.GetProperty("total").GetDecimal());

        // Delivered twice? No.
        Assert.Equal(HttpStatusCode.Conflict, (await Post($"/api/sales/{sale}/deliver")).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await Post($"/api/sales/{sale}/undo-delivery")).StatusCode);
        Assert.Equal(10, await WarehouseQty(item));
        detail = await GetJson($"/api/sales/{sale}");
        Assert.Equal("Ordered", detail.GetProperty("status").GetString());
        Assert.Equal(["Delivered", "DeliveryUndone"], detail.GetProperty("history").EnumerateArray().Select(e => e.GetProperty("action").GetString()));
    }

    [Fact]
    public async Task Delivering_more_than_the_warehouse_has_is_refused_and_changes_nothing()
    {
        var item = await NewItem(quantity: 3);
        var sale = await Id(Order(item, 5, 1m)); // an order may exceed stock: it's a promise, not a move

        var res = await Post($"/api/sales/{sale}/deliver");
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.Contains("not enough stock", await res.Content.ReadAsStringAsync());

        Assert.Equal(3, await WarehouseQty(item));
        Assert.Equal("Ordered", (await GetJson($"/api/sales/{sale}")).GetProperty("status").GetString());
    }

    [Fact]
    public async Task Simultaneous_deliveries_never_take_more_than_is_in_the_warehouse()
    {
        var item = await NewItem(quantity: 30);
        var sales = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => Id(Order(item, 10, 2m))));

        // Ten orders of 10 delivered at the same moment; only 30 are there.
        var results = await Task.WhenAll(sales.Select(s => Post($"/api/sales/{s}/deliver")));

        Assert.Equal(3, results.Count(r => r.IsSuccessStatusCode));
        Assert.All(results.Where(r => !r.IsSuccessStatusCode), r => Assert.Equal(HttpStatusCode.Conflict, r.StatusCode));
        Assert.Equal(0, await WarehouseQty(item));
    }

    [Fact]
    public async Task A_delivered_or_cancelled_sale_cannot_be_changed()
    {
        var item = await NewItem(quantity: 10);
        var sale = await Id(Order(item, 2, 3m));
        (await Post($"/api/sales/{sale}/deliver")).EnsureSuccessStatusCode();

        var edit = await _admin.PutAsJsonAsync($"/api/sales/{sale}", OrderBody(item, 3, 3m));
        Assert.Equal(HttpStatusCode.Conflict, edit.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Post($"/api/sales/{sale}/cancel")).StatusCode);

        var other = await Id(Order(item, 1, 3m));
        Assert.Equal(HttpStatusCode.OK, (await Post($"/api/sales/{other}/cancel")).StatusCode);
        Assert.Equal(10 - 2, await WarehouseQty(item)); // cancelling moved nothing
        Assert.Equal(HttpStatusCode.Conflict, (await Post($"/api/sales/{other}/deliver")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await _admin.PutAsJsonAsync($"/api/sales/{other}", OrderBody(item, 1, 3m))).StatusCode);
    }

    [Fact]
    public async Task Editing_an_order_is_written_to_its_history()
    {
        var item = await NewItem(quantity: 10);
        var sale = await Id(Order(item, 2, 3m));
        var line = (await GetJson($"/api/sales/{sale}")).GetProperty("items")[0].GetProperty("id").GetInt32();

        var edit = await _admin.PutAsJsonAsync($"/api/sales/{sale}", new
        {
            customerId = _customerId, reference = "PO-7", date = Today, notes = (string?)null,
            items = new[] { new { itemId = item, quantity = 5, unitPrice = 3.5m, id = line } },
        });
        Assert.Equal(HttpStatusCode.OK, edit.StatusCode);

        var history = (await GetJson($"/api/sales/{sale}")).GetProperty("history");
        var changes = history[0].GetProperty("changes").EnumerateArray().ToList();
        Assert.Equal("Edited", history[0].GetProperty("action").GetString());
        Assert.Contains(changes, c => c.GetProperty("kind").GetString() == "Field" && c.GetProperty("field").GetString() == "reference");
        Assert.Contains(changes, c => c.GetProperty("kind").GetString() == "LineChanged" && c.GetProperty("toQty").GetInt32() == 5);
    }

    // ---- payments ----

    [Fact]
    public async Task Payments_add_up_to_the_total_and_never_beyond_it()
    {
        var item = await NewItem(quantity: 10);
        var sale = await Id(Order(item, 4, 25m)); // total 100
        (await Post($"/api/sales/{sale}/deliver")).EnsureSuccessStatusCode();
        Assert.Equal("Unpaid", (await GetJson($"/api/sales/{sale}")).GetProperty("paymentStatus").GetString());

        Assert.Equal(HttpStatusCode.OK, (await Pay(sale, 40m)).StatusCode);
        var detail = await GetJson($"/api/sales/{sale}");
        Assert.Equal("PartlyPaid", detail.GetProperty("paymentStatus").GetString());
        Assert.Equal(60m, detail.GetProperty("remaining").GetDecimal());

        var tooMuch = await Pay(sale, 60.01m);
        Assert.Equal(HttpStatusCode.BadRequest, tooMuch.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Pay(sale, 0m)).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await Pay(sale, 60m)).StatusCode);
        detail = await GetJson($"/api/sales/{sale}");
        Assert.Equal("Paid", detail.GetProperty("paymentStatus").GetString());
        Assert.Equal(0m, detail.GetProperty("remaining").GetDecimal());
        Assert.Equal(2, detail.GetProperty("payments").GetArrayLength());

        // The list shows the same picture without loading the payments.
        var row = (await GetJson("/api/sales")).EnumerateArray().Single(s => s.GetProperty("id").GetInt32() == sale);
        Assert.Equal("Paid", row.GetProperty("paymentStatus").GetString());
        Assert.Equal(100m, row.GetProperty("paid").GetDecimal());
    }

    [Fact]
    public async Task Nothing_is_undone_while_money_has_been_received()
    {
        var item = await NewItem(quantity: 10);
        var sale = await Id(Order(item, 1, 10m));
        (await Post($"/api/sales/{sale}/deliver")).EnsureSuccessStatusCode();
        (await Pay(sale, 10m)).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.Conflict, (await Post($"/api/sales/{sale}/undo-delivery")).StatusCode);

        // Remove the payment (recorded by mistake), and the delivery can be undone again.
        var paymentId = (await GetJson($"/api/sales/{sale}")).GetProperty("payments")[0].GetProperty("id").GetInt32();
        Assert.Equal(HttpStatusCode.NoContent, (await _admin.DeleteAsync($"/api/sales/{sale}/payments/{paymentId}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Post($"/api/sales/{sale}/undo-delivery")).StatusCode);
        Assert.Equal(10, await WarehouseQty(item));

        // An order with a deposit can't be cancelled either.
        (await Pay(sale, 5m)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await Post($"/api/sales/{sale}/cancel")).StatusCode);

        var actions = (await GetJson($"/api/sales/{sale}")).GetProperty("history").EnumerateArray().Select(e => e.GetProperty("action").GetString()).ToList();
        Assert.Equal(["Delivered", "PaymentAdded", "PaymentRemoved", "DeliveryUndone", "PaymentAdded"], actions);
    }

    // ---- what stays ----

    [Fact]
    public async Task A_customer_with_sales_and_an_item_that_was_sold_cannot_be_deleted()
    {
        var customer = await Id(_admin.PostAsJsonAsync("/api/customers", new { name = "Keeper", code = Code(), status = "Active" }));
        var item = await NewItem(quantity: 1);
        await Id(_admin.PostAsJsonAsync("/api/sales", new { customerId = customer, reference = (string?)null, date = Today, notes = (string?)null, items = new[] { new { itemId = item, quantity = 1, unitPrice = 1m } } }));

        Assert.Equal(HttpStatusCode.Conflict, (await _admin.DeleteAsync($"/api/customers/{customer}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await _admin.DeleteAsync($"/api/items/{item}")).StatusCode);
    }

    [Fact]
    public async Task An_inactive_customer_gets_no_new_sales()
    {
        var customer = await Id(_admin.PostAsJsonAsync("/api/customers", new { name = "Gone", code = Code(), status = "Inactive" }));
        var item = await NewItem(quantity: 1);
        var res = await _admin.PostAsJsonAsync("/api/sales", new { customerId = customer, reference = (string?)null, date = Today, notes = (string?)null, items = new[] { new { itemId = item, quantity = 1, unitPrice = 1m } } });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    // ---- helpers ----

    private static string Code() => $"C-{Guid.NewGuid():N}"[..12];

    private Task<int> NewItem(int quantity, decimal price = 5m) =>
        Id(_admin.PostAsJsonAsync("/api/items", new { name = "Item " + Code(), code = Code(), quantity, unit = "pcs", price }));

    private object OrderBody(int item, int quantity, decimal unitPrice) =>
        new { customerId = _customerId, reference = (string?)null, date = Today, notes = (string?)null, items = new[] { new { itemId = item, quantity, unitPrice } } };

    private Task<HttpResponseMessage> Order(int item, int quantity, decimal unitPrice) =>
        _admin.PostAsJsonAsync("/api/sales", OrderBody(item, quantity, unitPrice));

    private Task<HttpResponseMessage> Pay(int sale, decimal amount) =>
        _admin.PostAsJsonAsync($"/api/sales/{sale}/payments", new { date = Today, amount, note = "cash" });

    private Task<HttpResponseMessage> Post(string path) => _admin.PostAsync(path, null);

    private async Task<int> WarehouseQty(int item) => (await GetJson($"/api/items/{item}")).GetProperty("quantity").GetInt32();

    private async Task<JsonElement> GetJson(string path)
    {
        var res = await _admin.GetAsync(path);
        res.EnsureSuccessStatusCode();
        return await res.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static async Task<int> Id(Task<HttpResponseMessage> request)
    {
        var res = (await request).EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<ApiFactory.IdBody>())!.Id;
    }
}
