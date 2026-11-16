using System.Net;
using System.Net.Http.Json;
using CompanySystem.Api.Auth;

namespace CompanySystem.Api.Tests;

/// <summary>
/// The company can never be left without an administrator — not even when two
/// of them act at the same moment. Its own database, because it switches the
/// seeded admin off.
/// </summary>
public class AccountRaceTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    // Health check: two administrators demoting each other at the same moment each
    // saw the other still in place, and both succeeded — leaving nobody.
    [Fact]
    public async Task Two_admins_demoting_each_other_at_once_cannot_leave_nobody()
    {
        var a = await api.CreatePerson(Roles.Administrator, "Admin A");
        var b = await api.CreatePerson(Roles.Administrator, "Admin B");

        // Only A and B are left: the seeded admin goes (A and B are enough to allow it).
        var seeded = await (await api.SignInAsAdmin()).GetFromJsonAsync<ApiFactory.IdBody>("/api/auth/me");
        Assert.Equal(HttpStatusCode.NoContent, (await a.Client.DeleteAsync($"/api/users/{seeded!.Id}")).StatusCode);

        var demote = new { role = Roles.Employee, isActive = true, newPassword = (string?)null };
        var results = await Task.WhenAll(
            a.Client.PutAsJsonAsync($"/api/employees/{b.EmployeeId}/access", demote),
            b.Client.PutAsJsonAsync($"/api/employees/{a.EmployeeId}/access", demote));

        // Exactly one of them went through; the other was refused.
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.NoContent);

        // And whoever is left is still an administrator who can manage logins.
        var stillAdmin = await Task.WhenAll(a.Client.GetAsync("/api/users"), b.Client.GetAsync("/api/users"));
        Assert.Contains(stillAdmin, r => r.StatusCode == HttpStatusCode.OK);
    }
}
