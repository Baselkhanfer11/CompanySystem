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

    // Review finding: a manager could rename an admin, or switch a dismissed admin back on.
    [Fact]
    public async Task Manager_cannot_rename_or_switch_on_an_admin()
    {
        var admin = await api.SignInAsAdmin();
        var manager = await api.CreatePerson(Roles.WarehouseManager, "Helpful manager");
        var former = await api.CreatePerson(Roles.Administrator, "Former admin");

        var off = await admin.PutAsJsonAsync($"/api/employees/{former.EmployeeId}",
            new { fullName = "Former admin", email = (string?)null, position = (string?)null, isActive = false });
        Assert.Equal(HttpStatusCode.NoContent, off.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await former.Client.GetAsync("/api/users")).StatusCode);

        var on = await manager.Client.PutAsJsonAsync($"/api/employees/{former.EmployeeId}",
            new { fullName = "Former admin", email = (string?)null, position = (string?)null, isActive = true });
        Assert.Equal(HttpStatusCode.Forbidden, on.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await former.Client.GetAsync("/api/users")).StatusCode);

        var boss = await api.CreatePerson(Roles.Administrator, "Boss");
        var rename = await manager.Client.PutAsJsonAsync($"/api/employees/{boss.EmployeeId}",
            new { fullName = "Someone else", email = (string?)null, position = (string?)null, isActive = true });
        Assert.Equal(HttpStatusCode.Forbidden, rename.StatusCode);
    }

    // Review finding: a stolen sign-in kept working for hours after the password was changed.
    [Fact]
    public async Task Changing_the_password_ends_every_other_sign_in()
    {
        var person = await api.CreatePerson(Roles.Employee, "Careful person");
        var stolen = await api.SignIn(person.Username, person.Password);
        Assert.Equal(HttpStatusCode.OK, (await stolen.GetAsync("/api/auth/me")).StatusCode);

        var change = await person.Client.PutAsJsonAsync("/api/auth/password",
            new { currentPassword = person.Password, newPassword = "brand-new-password" });
        Assert.Equal(HttpStatusCode.OK, change.StatusCode);

        // The copy made earlier is refused; the session that changed it carries on with the new token.
        Assert.Equal(HttpStatusCode.Unauthorized, (await stolen.GetAsync("/api/auth/me")).StatusCode);
        var fresh = await change.Content.ReadFromJsonAsync<TokenBody>();
        person.Client.DefaultRequestHeaders.Authorization = new("Bearer", fresh!.Token);
        Assert.Equal(HttpStatusCode.OK, (await person.Client.GetAsync("/api/auth/me")).StatusCode);

        // An admin's reset does the same.
        var admin = await api.SignInAsAdmin();
        var reset = await admin.PutAsJsonAsync($"/api/employees/{person.EmployeeId}/access",
            new { role = Roles.Employee, isActive = true, newPassword = "reset-by-admin" });
        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await person.Client.GetAsync("/api/auth/me")).StatusCode);
    }

    // Review finding: a disabled account's correct password was confirmed with a different message.
    [Fact]
    public async Task A_refused_sign_in_never_says_why()
    {
        var admin = await api.SignInAsAdmin();
        var person = await api.CreatePerson(Roles.Employee, "Leaver");
        (await admin.PutAsJsonAsync($"/api/employees/{person.EmployeeId}/access",
            new { role = Roles.Employee, isActive = false, newPassword = (string?)null })).EnsureSuccessStatusCode();

        var client = api.Anonymous();
        var attempts = new[]
        {
            new { username = "nobody-" + Guid.NewGuid().ToString("N"), password = "whatever-123" },
            new { username = person.Username, password = "wrong-password" },
            new { username = person.Username, password = person.Password },
        };
        foreach (var attempt in attempts)
        {
            var res = await client.PostAsJsonAsync("/api/auth/login", attempt);
            Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
            Assert.Equal("Invalid username or password.", (await res.Content.ReadFromJsonAsync<MessageBody>())!.Message);
        }
    }

    // Review finding: removing a login that is named on history crashed with a 500.
    [Fact]
    public async Task Removing_a_login_with_history_is_refused_not_crashed()
    {
        var admin = await api.SignInAsAdmin();
        var uploader = await api.CreatePerson(Roles.Employee, "Uploader");
        await Upload(uploader.Client); // the upload names this login on the document

        var revoke = await admin.DeleteAsync($"/api/employees/{uploader.EmployeeId}/access");
        Assert.Equal(HttpStatusCode.Conflict, revoke.StatusCode);
        var remove = await admin.DeleteAsync($"/api/users/{uploader.UserId}");
        Assert.Equal(HttpStatusCode.Conflict, remove.StatusCode);

        // Switching off still works, and takes effect at once.
        var off = await admin.PutAsJsonAsync($"/api/employees/{uploader.EmployeeId}/access",
            new { role = Roles.Employee, isActive = false, newPassword = (string?)null });
        Assert.Equal(HttpStatusCode.NoContent, off.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await uploader.Client.GetAsync("/api/auth/me")).StatusCode);
    }

    // Review finding: deleting a project silently took its documents (and their approval history) with it.
    [Fact]
    public async Task A_project_with_documents_cannot_be_deleted()
    {
        var admin = await api.SignInAsAdmin();
        var doc = await Upload(admin);
        var docs = await admin.GetFromJsonAsync<List<DocProjectRow>>("/api/documents");
        var projectId = docs!.Single(d => d.Id == doc).ProjectId;

        Assert.Equal(HttpStatusCode.Conflict, (await admin.DeleteAsync($"/api/projects/{projectId}")).StatusCode);
        Assert.Equal("PendingManager", await StatusOf(admin, doc)); // still there
    }

    private record TokenBody(string Token);
    private record MessageBody(string Message);
    private record DocProjectRow(int Id, int ProjectId);

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

    // ---- Uploads ----

    // Health check: any file named .xlsx was accepted, and sent back later with
    // whatever type the browser claimed on upload (a web page could come back as one).
    [Fact]
    public async Task Upload_accepts_only_a_real_excel_file_and_never_trusts_the_claimed_type()
    {
        var admin = await api.SignInAsAdmin();
        var project = await (await admin.PostAsJsonAsync("/api/projects", new { name = "Doc project", code = Code(), status = "Active" }))
            .EnsureSuccessStatusCode().Content.ReadFromJsonAsync<ApiFactory.IdBody>();

        var fake = await admin.PostAsync("/api/documents", Form(project!.Id, "<html>not excel</html>"u8.ToArray()));
        Assert.Equal(HttpStatusCode.BadRequest, fake.StatusCode);

        var real = await admin.PostAsync("/api/documents", Form(project.Id, XlsxHead));
        Assert.Equal(HttpStatusCode.Created, real.StatusCode);
        var doc = await real.Content.ReadFromJsonAsync<ApiFactory.IdBody>();

        var download = await admin.GetAsync($"/api/documents/{doc!.Id}/file");
        Assert.Equal("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", download.Content.Headers.ContentType?.MediaType);
        Assert.Equal("nosniff", download.Headers.GetValues("X-Content-Type-Options").Single());

        static MultipartFormDataContent Form(int projectId, byte[] bytes)
        {
            var file = new ByteArrayContent(bytes);
            file.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("text/html"); // what the browser claims
            return new MultipartFormDataContent
            {
                { new StringContent("Budget"), "title" },
                { new StringContent(projectId.ToString()), "projectId" },
                { file, "file", "budget.xlsx" },
            };
        }
    }

    // ---- Typed text ----

    // Health check: text had no length limit, so a pasted document could be saved
    // as an item's name. Now it's refused with a message, before it reaches the database.
    [Fact]
    public async Task Text_that_is_far_too_long_is_refused_with_a_message()
    {
        var admin = await api.SignInAsAdmin();
        var res = await admin.PostAsJsonAsync("/api/items",
            new { name = new string('x', 201), code = Code(), quantity = 0, unit = "pcs", price = 1m });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("200", await res.Content.ReadAsStringAsync());
    }

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
            { new ByteArrayContent(XlsxHead), "file", "budget.xlsx" },
        };
        var res = await client.PostAsync("/api/documents", form);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<ApiFactory.IdBody>())!.Id;
    }

    // How a real .xlsx file (a zip) starts.
    private static readonly byte[] XlsxHead = [0x50, 0x4B, 0x03, 0x04, 0, 0, 0, 0];

    private static async Task<string> StatusOf(HttpClient client, int docId)
    {
        var docs = await client.GetFromJsonAsync<List<DocRow>>("/api/documents");
        return docs!.Single(d => d.Id == docId).Status;
    }

    private record EmployeeRow(int Id, LoginRow? Access);
    private record LoginRow(string Username, string Role);
    private record DocRow(int Id, string Status);
}
