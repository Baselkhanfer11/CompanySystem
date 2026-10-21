using CompanySystem.Api.Data;
using CompanySystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CompanySystem.Api.Auth;

/// <summary>
/// Account rules in one place, shared by sign-in, the check on every request
/// (Program.cs) and the screens that manage logins, so they can never disagree.
/// </summary>
public static class AccountRules
{
    public const int MinPasswordLength = 8;

    /// <summary>
    /// Logins that may be used right now: switched on, and — when linked to an
    /// employee — that employee is active too.
    /// </summary>
    public static IQueryable<User> UsableLogins(AppDbContext db) =>
        db.Users.Where(u => u.IsActive && (u.EmployeeId == null || u.Employee!.IsActive));

    /// <summary>
    /// Is there a usable administrator other than this login? Guards every change
    /// that could leave the company without one (demote, switch off, delete).
    /// </summary>
    public static Task<bool> HasOtherUsableAdmin(AppDbContext db, int excludeUserId) =>
        UsableLogins(db).AnyAsync(u => u.Role == Roles.Administrator && u.Id != excludeUserId);

    /// <summary>The error to show for a too-short password, or null when it's long enough.</summary>
    public static string? PasswordProblem(string? password) =>
        string.IsNullOrWhiteSpace(password) || password.Length < MinPasswordLength
            ? $"The password needs at least {MinPasswordLength} characters."
            : null;
}
