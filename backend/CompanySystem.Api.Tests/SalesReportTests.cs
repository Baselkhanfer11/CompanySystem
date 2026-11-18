using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CompanySystem.Api.Auth;

namespace CompanySystem.Api.Tests;

/// <summary>
/// The sales report: only delivered sales count, profit uses what the material
/// cost on the day it was delivered (a later price change never rewrites it),
/// and it's for managers only. Its own database, so the totals are exact.
/// </summary>
public class SalesReportTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private static readonly string Today = DateTime.UtcNow.ToString("yyyy-MM-dd");

    [Fact]
    public async Task Revenue_cost_and_profit_come_from_delivered_sales_only()
    {
        var admin = await api.SignInAsAdmin();
        var cement = await Id(admin.PostAsJsonAsync("/api/items", new { name = "Cement", code = Code(), quantity = 100, unit = "bag", price = 5m }));
        var tile = await Id(admin.PostAsJsonAsync("/api/items", new { name = "Tile", code = Code(), quantity = 100, unit = "pcs", price = 2m }));
        var noor = await Id(admin.PostAsJsonAsync("/api/customers", new { name = "Noor", code = Code(), status = "Active" }));
        var majd = await Id(admin.PostAsJsonAsync("/api/customers", new { name = "Majd", code = Code(), status = "Active" }));

        // Delivered: Noor 10 cement at 8 (cost 5) → revenue 80, profit 30.
        var s1 = await Id(Sell(admin, noor, cement, 10, 8m));
        (await admin.PostAsync($"/api/sales/{s1}/deliver", null)).EnsureSuccessStatusCode();
        // Delivered: Majd 20 tiles at 3 (cost 2) → revenue 60, profit 20.
        var s2 = await Id(Sell(admin, majd, tile, 20, 3m));
        (await admin.PostAsync($"/api/sales/{s2}/deliver", null)).EnsureSuccessStatusCode();
        // Not counted: an order not delivered, and a cancelled one.
        await Id(Sell(admin, noor, cement, 50, 9m));
        var s4 = await Id(Sell(admin, majd, tile, 5, 3m));
        (await admin.PostAsync($"/api/sales/{s4}/cancel", null)).EnsureSuccessStatusCode();
        // Noor pays 30 of 80.
        (await admin.PostAsJsonAsync($"/api/sales/{s1}/payments", new { date = Today, amount = 30m, note = (string?)null })).EnsureSuccessStatusCode();

        // The cement gets dearer after the delivery: past profit must not change.
        var cementNow = await admin.GetFromJsonAsync<JsonElement>($"/api/items/{cement}");
        (await admin.PutAsJsonAsync($"/api/items/{cement}", new { name = "Cement", code = cementNow.GetProperty("code").GetString(), quantity = 0, unit = "bag", price = 7.5m })).EnsureSuccessStatusCode();

        var report = await admin.GetFromJsonAsync<JsonElement>($"/api/reports/sales?from={Today}&to={Today}");

        Assert.Equal(140m, report.GetProperty("revenue").GetDecimal());
        Assert.Equal(90m, report.GetProperty("cost").GetDecimal());
        Assert.Equal(50m, report.GetProperty("profit").GetDecimal());
        Assert.Equal(35.7m, report.GetProperty("marginPercent").GetDecimal());
        Assert.Equal(2, report.GetProperty("saleCount").GetInt32());
        Assert.Equal(30m, report.GetProperty("collected").GetDecimal());

        var byCustomer = report.GetProperty("byCustomer").EnumerateArray().ToList();
        Assert.Equal(["Noor", "Majd"], byCustomer.Select(c => c.GetProperty("name").GetString()));
        Assert.Equal(30m, byCustomer[0].GetProperty("profit").GetDecimal());
        Assert.Equal(50m, byCustomer[0].GetProperty("owed").GetDecimal());
        Assert.Equal(60m, byCustomer[1].GetProperty("owed").GetDecimal());

        var cementRow = report.GetProperty("byItem").EnumerateArray().Single(i => i.GetProperty("itemId").GetInt32() == cement);
        Assert.Equal(10, cementRow.GetProperty("quantity").GetInt32());
        Assert.Equal(50m, cementRow.GetProperty("cost").GetDecimal());

        var month = report.GetProperty("monthly").EnumerateArray().Single();
        Assert.Equal(140m, month.GetProperty("revenue").GetDecimal());
        Assert.Equal(50m, month.GetProperty("profit").GetDecimal());

        // A period with no deliveries is empty, not an error.
        var tomorrow = DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-dd");
        var empty = await admin.GetFromJsonAsync<JsonElement>($"/api/reports/sales?from={tomorrow}&to={tomorrow}");
        Assert.Equal(0m, empty.GetProperty("revenue").GetDecimal());
        Assert.Equal(JsonValueKind.Null, empty.GetProperty("marginPercent").ValueKind);
    }

    [Fact]
    public async Task The_sales_report_is_for_managers_only()
    {
        var buyer = await api.CreatePerson(Roles.ProcurementOfficer, "Report buyer");
        var employee = await api.CreatePerson(Roles.Employee, "Report employee");
        var manager = await api.CreatePerson(Roles.WarehouseManager, "Report manager");

        Assert.Equal(HttpStatusCode.Forbidden, (await buyer.Client.GetAsync("/api/reports/sales")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.Client.GetAsync("/api/reports/sales")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await manager.Client.GetAsync("/api/reports/sales")).StatusCode);
    }

    private static string Code() => $"R-{Guid.NewGuid():N}"[..12];

    private static Task<HttpResponseMessage> Sell(HttpClient client, int customer, int item, int quantity, decimal unitPrice) =>
        client.PostAsJsonAsync("/api/sales", new { customerId = customer, reference = (string?)null, date = Today, notes = (string?)null, items = new[] { new { itemId = item, quantity, unitPrice } } });

    private static async Task<int> Id(Task<HttpResponseMessage> request)
    {
        var res = (await request).EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<ApiFactory.IdBody>())!.Id;
    }
}
