using CompanySystem.Api.Auth;
using CompanySystem.Api.Models;
using Microsoft.AspNetCore.Identity;

namespace CompanySystem.Api.Data;

/// <summary>
/// Creates a default Administrator account the first time the app runs
/// (only if there are no users yet). The password is a secret
/// (dotnet user-secrets locally) and is never in git.
/// </summary>
public static class DbSeeder
{
    // The admin password that used to be written in appsettings.json. It's in the
    // git history, so treat it as public: an account still using it gets the new one.
    private const string OldPublicPassword = "Admin@123";

    public static async Task SeedAsync(IServiceProvider services)
    {
        var db = services.GetRequiredService<AppDbContext>();
        var hasher = services.GetRequiredService<IPasswordHasher<User>>();
        var config = services.GetRequiredService<IConfiguration>();
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(DbSeeder));

        var password = config["Seed:AdminPassword"];
        var hasPassword = !string.IsNullOrWhiteSpace(password);

        if (db.Users.Any())
        {
            ReplaceOldPublicPassword(db, hasher, logger, hasPassword ? password : null);
            await db.SaveChangesAsync();
            return;
        }

        if (!hasPassword)
        {
            logger.LogWarning(
                "No users yet. Set Seed:AdminPassword with dotnet user-secrets " +
                "inside backend/CompanySystem.Api, then restart the API.");
            return;
        }

        var admin = new User
        {
            Username = config["Seed:AdminUsername"] ?? "admin",
            FullName = config["Seed:AdminFullName"] ?? "System Administrator",
            Role = Roles.Administrator,
            IsActive = true,
        };
        admin.PasswordHash = hasher.HashPassword(admin, password!);

        db.Users.Add(admin);
        await db.SaveChangesAsync();
    }

    private static void ReplaceOldPublicPassword(
        AppDbContext db, IPasswordHasher<User> hasher, ILogger logger, string? newPassword)
    {
        var exposed = db.Users.Where(u => u.Role == Roles.Administrator).AsEnumerable()
            .Where(u => hasher.VerifyHashedPassword(u, u.PasswordHash, OldPublicPassword) != PasswordVerificationResult.Failed)
            .ToList();
        if (exposed.Count == 0) return;

        if (newPassword is null)
        {
            logger.LogWarning(
                "{Count} administrator account(s) still use the old password from git. Set Seed:AdminPassword " +
                "with dotnet user-secrets inside backend/CompanySystem.Api and restart to replace it.",
                exposed.Count);
            return;
        }

        foreach (var user in exposed) user.PasswordHash = hasher.HashPassword(user, newPassword);
        logger.LogInformation(
            "Replaced the old password from git on {Count} administrator account(s) with Seed:AdminPassword.",
            exposed.Count);
    }
}
