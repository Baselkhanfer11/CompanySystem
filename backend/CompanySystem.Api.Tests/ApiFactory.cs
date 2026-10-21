using System.Net.Http.Headers;
using System.Net.Http.Json;
using CompanySystem.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CompanySystem.Api.Tests;

/// <summary>
/// Starts the real API against its own brand-new SQL Server database (the same
/// engine as in real use), and deletes that database when the tests are done.
/// Set COMPANYSYSTEM_TEST_SQL to use another server than .\SQL2025.
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>
{
    public const string AdminPassword = "test-admin-password";

    private readonly string _connection =
        $"Server={Environment.GetEnvironmentVariable("COMPANYSYSTEM_TEST_SQL") ?? @".\SQL2025"};" +
        $"Database=CompanySystemDb_Test_{Guid.NewGuid():N};Trusted_Connection=True;TrustServerCertificate=True;";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:DefaultConnection", _connection);
        builder.UseSetting("Jwt:Key", "a-test-only-signing-key-that-is-long-enough-0123456789");
        builder.UseSetting("Seed:AdminPassword", AdminPassword);
    }

    public override async ValueTask DisposeAsync()
    {
        using (var scope = Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureDeletedAsync();
        await base.DisposeAsync();
        GC.SuppressFinalize(this);
    }

    /// <summary>A client with no sign-in.</summary>
    public HttpClient Anonymous() => CreateClient();

    /// <summary>Signs in and returns a client that sends that sign-in on every request.</summary>
    public async Task<HttpClient> SignIn(string username, string password)
    {
        var client = CreateClient();
        var res = await client.PostAsJsonAsync("/api/auth/login", new { username, password });
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<LoginBody>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.Token);
        return client;
    }

    public Task<HttpClient> SignInAsAdmin() => SignIn("admin", AdminPassword);

    /// <summary>
    /// Creates an employee with a login in the given role (as the seeded admin).
    /// Names are made unique, so tests never trip over each other.
    /// </summary>
    public async Task<Person> CreatePerson(string role, string name = "Test person")
    {
        var admin = await SignInAsAdmin();
        var unique = $"{name.ToLowerInvariant().Replace(' ', '.')}.{Guid.NewGuid():N}"[..30];
        var employee = await (await admin.PostAsJsonAsync("/api/employees",
            new { fullName = name, email = (string?)null, position = (string?)null, isActive = true }))
            .EnsureSuccessStatusCode().Content.ReadFromJsonAsync<IdBody>();
        (await admin.PostAsJsonAsync($"/api/employees/{employee!.Id}/access",
            new { username = unique, password = "password-123", role, isActive = true }))
            .EnsureSuccessStatusCode();
        var client = await SignIn(unique, "password-123");
        var me = await client.GetFromJsonAsync<IdBody>("/api/auth/me");
        return new Person(employee.Id, me!.Id, unique, "password-123", client);
    }

    private record LoginBody(string Token);
    public record IdBody(int Id);
}

/// <summary>A test employee with a login, and a client already signed in as them.</summary>
public record Person(int EmployeeId, int UserId, string Username, string Password, HttpClient Client);
