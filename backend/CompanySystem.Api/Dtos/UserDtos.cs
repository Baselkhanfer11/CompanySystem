namespace CompanySystem.Api.Dtos;

// Admin creates a new user.
public record CreateUserRequest(string Username, string FullName, string Password, string Role, bool IsActive);

// Admin updates a user. Password is optional — only set to change it.
public record UpdateUserRequest(string FullName, string Role, bool IsActive, string? NewPassword);
