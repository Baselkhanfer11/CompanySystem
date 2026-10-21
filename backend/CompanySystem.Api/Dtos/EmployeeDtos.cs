using CompanySystem.Api.Models;

namespace CompanySystem.Api.Dtos;

// The login access an employee has, if any (shown on the Employees page).
public record EmployeeAccessDto(int UserId, string Username, string Role, bool IsActive)
{
    public static EmployeeAccessDto? From(User? u) =>
        u is null ? null : new EmployeeAccessDto(u.Id, u.Username, u.Role, u.IsActive);
}

// An employee plus their access status.
public record EmployeeDto(
    int Id, string FullName, string? Email, string? Position,
    DateTime HireDate, bool IsActive, EmployeeAccessDto? Access)
{
    // Requires the User navigation to be loaded (Include(e => e.User)).
    // The login (username + role) is only filled in for administrators.
    public static EmployeeDto From(Employee e, bool withLogin) =>
        new(e.Id, e.FullName, e.Email, e.Position, e.HireDate, e.IsActive, withLogin ? EmployeeAccessDto.From(e.User) : null);
}

// What the frontend sends to create/update an employee's core fields.
public record EmployeeInputDto(string FullName, string? Email, string? Position, bool IsActive);

// Grant a login to an employee.
public record GrantAccessRequest(string Username, string Password, string Role, bool IsActive);

// Update an employee's existing login (password optional).
public record UpdateAccessRequest(string Role, bool IsActive, string? NewPassword);
