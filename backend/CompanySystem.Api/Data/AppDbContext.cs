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

    // The "Users" table (login accounts).
    public DbSet<User> Users => Set<User>();

    // The "Items" table (store / warehouse stock).
    public DbSet<Item> Items => Set<Item>();

    // The "Projects" table (sites that material/cost is charged to).
    public DbSet<Project> Projects => Set<Project>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Usernames must be unique — no two accounts can share one.
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username)
            .IsUnique();

        // One-to-one (optional): an Employee has at most one login User.
        // Deleting the employee also removes their login account.
        modelBuilder.Entity<User>()
            .HasOne(u => u.Employee)
            .WithOne(e => e.User)
            .HasForeignKey<User>(u => u.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        // Each employee can be linked to at most one user (nulls allowed for standalone accounts).
        modelBuilder.Entity<User>()
            .HasIndex(u => u.EmployeeId)
            .IsUnique()
            .HasFilter("[EmployeeId] IS NOT NULL");

        // Item codes must be unique.
        modelBuilder.Entity<Item>()
            .HasIndex(i => i.Code)
            .IsUnique();

        // Store money with 2 decimal places.
        modelBuilder.Entity<Item>()
            .Property(i => i.Price)
            .HasPrecision(18, 2);

        // Project codes must be unique.
        modelBuilder.Entity<Project>()
            .HasIndex(p => p.Code)
            .IsUnique();
    }
}
