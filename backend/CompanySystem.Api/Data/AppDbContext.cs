using CompanySystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CompanySystem.Api.Data;

/// <summary>
/// The bridge between our C# code and the SQL Server database.
/// Each DbSet is a table. Add new DbSet properties here as we add more entities.
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    // The "Employees" table.
    public DbSet<Employee> Employees => Set<Employee>();
}
