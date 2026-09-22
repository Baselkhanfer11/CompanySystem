using CompanySystem.Api.Auth;
using CompanySystem.Api.Models;
using Microsoft.AspNetCore.Identity;

namespace CompanySystem.Api.Data;

/// <summary>
/// Creates a default Administrator account the first time the app runs
/// (only if there are no users yet). Credentials come from appsettings "Seed".
/// </summary>
public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        var db = services.GetRequiredService<AppDbContext>();
        var hasher = services.GetRequiredService<IPasswordHasher<User>>();
        var config = services.GetRequiredService<IConfiguration>();

        if (db.Users.Any()) return; // already seeded

        var seed = config.GetSection("Seed");
        var admin = new User
        {
            Username = seed["AdminUsername"] ?? "admin",
            FullName = seed["AdminFullName"] ?? "System Administrator",
            Role = Roles.Administrator,
            IsActive = true,
        };
        admin.PasswordHash = hasher.HashPassword(admin, seed["AdminPassword"] ?? "Admin@123");

        db.Users.Add(admin);
        await db.SaveChangesAsync();
    }
}
