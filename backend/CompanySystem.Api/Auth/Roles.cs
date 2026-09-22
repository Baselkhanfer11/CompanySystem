namespace CompanySystem.Api.Auth;

/// <summary>
/// All roles live here in ONE place. To add a new role later:
///   1) add a const below,
///   2) add it to All,
///   3) (optionally) include it in Managers if it may modify data.
/// Everything else (login, [Authorize(Roles=...)], the Users page) reads from here.
/// </summary>
public static class Roles
{
    public const string Administrator = "Administrator";
    public const string WarehouseManager = "WarehouseManager";
    public const string Employee = "Employee";

    // Every role the system knows about.
    public static readonly string[] All = { Administrator, WarehouseManager, Employee };

    // Roles allowed to create/update/delete data. Extend this as new roles gain write access.
    public const string Managers = Administrator + "," + WarehouseManager;

    // Human-friendly labels (the raw value has no spaces to keep tokens clean).
    public static string DisplayName(string role) => role switch
    {
        WarehouseManager => "Warehouse Manager",
        _ => role,
    };

    public static bool IsValid(string role) => System.Array.IndexOf(All, role) >= 0;
}
