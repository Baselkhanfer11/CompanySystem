using System.Net;
using System.Net.Http.Json;
using CompanySystem.Api.Auth;

namespace CompanySystem.Api.Tests;

/// <summary>
/// Who may do what — and that a changed or switched-off account loses its powers
/// at once. Each test that found a real problem in the October 2026 health check
/// says so.
/// </summary>
public class SecurityTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    // ---- Signing in ----

    [Fact]
    public async Task Without_signing_in_only_login_is_open()
    {
        var client = api.Anonymous();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/items")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/employees")).StatusCode);

        var login = await client.PostAsJsonAsync("/api/auth/login", new { username = "admin", password = ApiFactory.AdminPassword });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    // Health check: a demoted, switched-off admin used their old sign-in to make themselves admin again.
    [Fact]
    public async Task Switched_off_admin_loses_powers_at_once_and_cannot_restore_them()
    {
        var admin = await api.SignInAsAdmin();
        var other = await api.CreatePerson(Roles.Administrator, "Second admin");

        var off = await admin.PutAsJsonAsync($"/api/employees/{other.EmployeeId}/access",
            new { role = Roles.Employee, isActive = false, newPassword = (string?)null });
        Assert.Equal(HttpStatusCode.NoContent, off.StatusCode);

        // Their old sign-in is refused everywhere, including the way back to admin.
        Assert.Equal(HttpStatusCode.Unauthorized, (await other.Client.GetAsync("/api/users")).StatusCode);
        var comeback = await other.Client.PutAsJsonAsync($"/api/employees/{other.EmployeeId}/access",
            new { role = Roles.Administrator, isActive = true, newPassword = (string?)null });
        Assert.Equal(HttpStatusCode.Unauthorized, comeback.StatusCode);

        var signIn = await api.Anonymous().PostAsJsonAsync("/api/auth/login", new { username = other.Username, password = other.Password });
        Assert.Equal(HttpStatusCode.Unauthorized, signIn.StatusCode);
    }

    [Fact]
    public async Task Demoted_user_loses_the_old_role_at_once()
    {
        var admin = await api.SignInAsAdmin();
        var manager = await api.CreatePerson(Roles.WarehouseManager, "Demoted manager");

        var demote = await admin.PutAsJsonAsync($"/api/employees/{manager.EmployeeId}/access",
            new { role = Roles.Employee, isActive = true, newPassword = (string?)null });
        Assert.Equal(HttpStatusCode.NoContent, demote.StatusCode);

        // The old sign-in still claims "WarehouseManager" — it must not work any more.
        var create = await manager.Client.PostAsJsonAsync("/api/projects", new { name = "Sneaky", code = Code(), status = "Active" });
        Assert.Equal(HttpStatusCode.Unauthorized, create.StatusCode);

        // Signing in again gives the new role, with the new (smaller) powers.
        var again = await api.SignIn(manager.Username, manager.Password);
        var create2 = await again.PostAsJsonAsync("/api/projects", new { name = "Sneaky", code = Code(), status = "Active" });
        Assert.Equal(HttpStatusCode.Forbidden, create2.StatusCode);
    }

    [Fact]
    public async Task Switching_off_an_employee_signs_out_their_login_at_once()
    {
        var admin = await api.SignInAsAdmin();
        var worker = await api.CreatePerson(Roles.Employee, "Leaving worker");

        var off = await admin.PutAsJsonAsync($"/api/employees/{worker.EmployeeId}",
            new { fullName = "Leaving worker", email = (string?)null, position = (string?)null, isActive = false });
        Assert.Equal(HttpStatusCode.NoContent, off.StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await worker.Client.GetAsync("/api/items")).StatusCode);
    }

    // ---- Protecting administrators ----

    // Health check: a Warehouse Manager locked an admin out by switching off the admin's employee record.
    [Fact]
    public async Task Manager_cannot_switch_off_or_delete_an_admin()
    {
        var manager = await api.CreatePerson(Roles.WarehouseManager, "Bold manager");
        var boss = await api.CreatePerson(Roles.Administrator, "Boss");

        var off = await manager.Client.PutAsJsonAsync($"/api/employees/{boss.EmployeeId}",
            new { fullName = "Boss", email = (string?)null, position = (string?)null, isActive = false });
        Assert.Equal(HttpStatusCode.Forbidden, off.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await manager.Client.DeleteAsync($"/api/employees/{boss.EmployeeId}")).StatusCode);

        // The admin can still sign in and work.
        Assert.Equal(HttpStatusCode.OK, (await boss.Client.GetAsync("/api/users")).StatusCode);
    }

    [Fact]
    public async Task Manager_can_still_switch_off_an_ordinary_employee()
    {
        var manager = await api.CreatePerson(Roles.WarehouseManager, "Shift manager");
        var worker = await api.CreatePerson(Roles.Employee, "Seasonal worker");

        var off = await manager.Client.PutAsJsonAsync($"/api/employees/{worker.EmployeeId}",
            new { fullName = "Seasonal worker", email = (string?)null, position = (string?)null, isActive = false });
        Assert.Equal(HttpStatusCode.NoContent, off.StatusCode);
    }

    [Fact]
    public async Task Nobody_can_switch_off_or_delete_themselves()
    {
        var manager = await api.CreatePerson(Roles.WarehouseManager, "Tired manager");
        var off = await manager.Client.PutAsJsonAsync($"/api/employees/{manager.EmployeeId}",
            new { fullName = "Tired manager", email = (string?)null, position = (string?)null, isActive = false });
        Assert.Equal(HttpStatusCode.BadRequest, off.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await manager.Client.DeleteAsync($"/api/employees/{manager.EmployeeId}")).StatusCode);
    }

    [Fact]
    public async Task Admin_cannot_change_their_own_role()
    {
        var admin = await api.CreatePerson(Roles.Administrator, "Humble admin");
        var demote = await admin.Client.PutAsJsonAsync($"/api/employees/{admin.EmployeeId}/access",
            new { role = Roles.Employee, isActive = true, newPassword = (string?)null });
        Assert.Equal(HttpStatusCode.BadRequest, demote.StatusCode);
    }

    [Fact]
    public async Task Logins_need_a_password_of_at_least_8_characters()
    {
        var admin = await api.SignInAsAdmin();
        var employee = await (await admin.PostAsJsonAsync("/api/employees",
            new { fullName = "Short password", email = (string?)null, position = (string?)null, isActive = true }))
            .Content.ReadFromJsonAsync<ApiFactory.IdBody>();

        var grant = await admin.PostAsJsonAsync($"/api/employees/{employee!.Id}/access",
            new { username = $"short.{Guid.NewGuid():N}"[..20], password = "1234567", role = Roles.Employee, isActive = true });
        Assert.Equal(HttpStatusCode.BadRequest, grant.StatusCode);
    }

    // ---- Seeing other people's logins ----

    [Fact]
    public async Task Only_admins_see_login_names_and_roles()
    {
        var worker = await api.CreatePerson(Roles.Employee, "Curious worker");
        var asWorker = await worker.Client.GetFromJsonAsync<List<EmployeeRow>>("/api/employees");
        Assert.All(asWorker!, e => Assert.Null(e.Access));

        var asAdmin = await (await api.SignInAsAdmin()).GetFromJsonAsync<List<EmployeeRow>>("/api/employees");
        Assert.Contains(asAdmin!, e => e.Access?.Username == worker.Username);
    }

    // ---- Document approvals: nobody reviews their own step ----

    [Fact]
    public async Task Engineer_upload_goes_manager_then_ceo()
    {
        var engineer = await api.CreatePerson(Roles.Employee, "Engineer");
        var manager = await api.CreatePerson(Roles.WarehouseManager, "Reviewing manager");
        var ceo = await api.SignInAsAdmin();

        var doc = await Upload(engineer.Client);
        Assert.Equal("PendingManager", await StatusOf(ceo, doc));
        Assert.Equal(HttpStatusCode.NoContent, (await manager.Client.PostAsync($"/api/documents/{doc}/approve", null)).StatusCode);
        Assert.Equal("PendingCEO", await StatusOf(ceo, doc));
        Assert.Equal(HttpStatusCode.NoContent, (await ceo.PostAsync($"/api/documents/{doc}/approve", null)).StatusCode);
        Assert.Equal("Approved", await StatusOf(ceo, doc));
    }

    // Health check: a manager approved their own upload.
    [Fact]
    public async Task Manager_upload_skips_their_own_step_and_cannot_be_self_approved()
    {
        var manager = await api.CreatePerson(Roles.WarehouseManager, "Uploading manager");
        var ceo = await api.SignInAsAdmin();

        var doc = await Upload(manager.Client);
        Assert.Equal("PendingCEO", await StatusOf(ceo, doc));
        Assert.Equal(HttpStatusCode.Forbidden, (await manager.Client.PostAsync($"/api/documents/{doc}/approve", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await ceo.PostAsync($"/api/documents/{doc}/approve", null)).StatusCode);
        Assert.Equal("Approved", await StatusOf(ceo, doc));
    }

    [Fact]
    public async Task Ceo_upload_is_final_once_a_manager_approves()
    {
        var ceo = await api.SignInAsAdmin();
        var manager = await api.CreatePerson(Roles.WarehouseManager, "Checking manager");

        var doc = await Upload(ceo);
        Assert.Equal("PendingManager", await StatusOf(ceo, doc));
        Assert.Equal(HttpStatusCode.NoContent, (await manager.Client.PostAsync($"/api/documents/{doc}/approve", null)).StatusCode);
        Assert.Equal("Approved", await StatusOf(ceo, doc));
    }

    // ---- helpers ----

    private static string Code() => $"T-{Guid.NewGuid():N}"[..12];

    private async Task<int> Upload(HttpClient client)
    {
        var admin = await api.SignInAsAdmin();
        var project = await (await admin.PostAsJsonAsync("/api/projects", new { name = "Doc project", code = Code(), status = "Active" }))
            .EnsureSuccessStatusCode().Content.ReadFromJsonAsync<ApiFactory.IdBody>();

        using var form = new MultipartFormDataContent
        {
            { new StringContent("Budget"), "title" },
            { new StringContent(project!.Id.ToString()), "projectId" },
            { new ByteArrayContent([1, 2, 3]), "file", "budget.xlsx" },
        };
        var res = await client.PostAsync("/api/documents", form);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<ApiFactory.IdBody>())!.Id;
    }

    private static async Task<string> StatusOf(HttpClient client, int docId)
    {
        var docs = await client.GetFromJsonAsync<List<DocRow>>("/api/documents");
        return docs!.Single(d => d.Id == docId).Status;
    }

    private record EmployeeRow(int Id, LoginRow? Access);
    private record LoginRow(string Username, string Role);
    private record DocRow(int Id, string Status);
}
