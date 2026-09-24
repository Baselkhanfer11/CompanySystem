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

    // The "Documents" table (uploaded files moving through the approval pipeline).
    public DbSet<Document> Documents => Set<Document>();

    // The "DocumentEvents" table (a document's approval history / audit trail).
    public DbSet<DocumentEvent> DocumentEvents => Set<DocumentEvent>();

    // The "Notifications" table (per-user bell alerts; outlives the document).
    public DbSet<Notification> Notifications => Set<Notification>();

    // The "Suppliers" table (vendors we buy from).
    public DbSet<Supplier> Suppliers => Set<Supplier>();

    // The "Purchases" table (supplier invoices) and their line items.
    public DbSet<Purchase> Purchases => Set<Purchase>();
    public DbSet<PurchaseItem> PurchaseItems => Set<PurchaseItem>();

    // The "PurchaseEvents" table (a purchase's edit history).
    public DbSet<PurchaseEvent> PurchaseEvents => Set<PurchaseEvent>();

    // The "StockMovements" table (warehouse ⇄ site transfers) and their lines.
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<StockMovementLine> StockMovementLines => Set<StockMovementLine>();

    // The "ProjectMaterials" table (each project's material plan).
    public DbSet<ProjectMaterial> ProjectMaterials => Set<ProjectMaterial>();

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

        // A document belongs to a project. Deleting the project removes its
        // documents (their files are cleaned up in the delete flow).
        modelBuilder.Entity<Document>()
            .HasOne(d => d.Project)
            .WithMany()
            .HasForeignKey(d => d.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        // Track who uploaded a document, but keep the document even if that user
        // is removed (Restrict also avoids multiple cascade paths to Documents).
        modelBuilder.Entity<Document>()
            .HasOne(d => d.UploadedBy)
            .WithMany()
            .HasForeignKey(d => d.UploadedById)
            .OnDelete(DeleteBehavior.Restrict);

        // A document's history entries are deleted with the document (e.g. when
        // it's rejected/removed). Keep the actor link non-cascading.
        modelBuilder.Entity<DocumentEvent>()
            .HasOne(e => e.Document)
            .WithMany()
            .HasForeignKey(e => e.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<DocumentEvent>()
            .HasOne(e => e.Actor)
            .WithMany()
            .HasForeignKey(e => e.ActorId)
            .OnDelete(DeleteBehavior.Restrict);

        // A notification belongs to its recipient. (DocumentId is a loose int
        // with no FK on purpose, so removing a document keeps its notifications.)
        modelBuilder.Entity<Notification>()
            .HasOne(n => n.Recipient)
            .WithMany()
            .HasForeignKey(n => n.RecipientId)
            .OnDelete(DeleteBehavior.Restrict);

        // Supplier codes must be unique.
        modelBuilder.Entity<Supplier>()
            .HasIndex(s => s.Code)
            .IsUnique();

        // A purchase is bought from a supplier. Don't allow deleting a supplier
        // that still has purchases (Restrict), so cost history stays intact.
        modelBuilder.Entity<Purchase>()
            .HasOne(p => p.Supplier)
            .WithMany()
            .HasForeignKey(p => p.SupplierId)
            .OnDelete(DeleteBehavior.Restrict);

        // A purchase may be delivered to a project's site (optional; null = the
        // warehouse). Don't allow deleting a project that has purchases (Restrict)
        // — clearing the link would silently move that material to the warehouse.
        modelBuilder.Entity<Purchase>()
            .HasOne(p => p.Project)
            .WithMany()
            .HasForeignKey(p => p.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);

        // Track who recorded the purchase, but keep the purchase if that user is removed.
        modelBuilder.Entity<Purchase>()
            .HasOne(p => p.CreatedBy)
            .WithMany()
            .HasForeignKey(p => p.CreatedById)
            .OnDelete(DeleteBehavior.Restrict);

        // A purchase's line items are part of the invoice — deleting the purchase
        // removes its lines (Cascade).
        modelBuilder.Entity<PurchaseItem>()
            .HasOne(li => li.Purchase)
            .WithMany(p => p.Items)
            .HasForeignKey(li => li.PurchaseId)
            .OnDelete(DeleteBehavior.Cascade);

        // Each line refers to a warehouse item. Don't delete an item that is
        // referenced by a purchase line (Restrict), so history stays accurate.
        modelBuilder.Entity<PurchaseItem>()
            .HasOne(li => li.Item)
            .WithMany()
            .HasForeignKey(li => li.ItemId)
            .OnDelete(DeleteBehavior.Restrict);

        // Store the paid unit price with 2 decimal places.
        modelBuilder.Entity<PurchaseItem>()
            .Property(li => li.UnitPrice)
            .HasPrecision(18, 2);

        // A purchase's edit history is deleted with the purchase. Keep the
        // editor link non-cascading so removing a user never erases history.
        modelBuilder.Entity<PurchaseEvent>()
            .HasOne(e => e.Purchase)
            .WithMany()
            .HasForeignKey(e => e.PurchaseId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<PurchaseEvent>()
            .HasOne(e => e.Actor)
            .WithMany()
            .HasForeignKey(e => e.ActorId)
            .OnDelete(DeleteBehavior.Restrict);

        // A movement belongs to a site. Keep the history: a project with
        // movements can't be deleted, and neither can the user who recorded it.
        modelBuilder.Entity<StockMovement>()
            .HasOne(m => m.Project)
            .WithMany()
            .HasForeignKey(m => m.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<StockMovement>()
            .HasOne(m => m.CreatedBy)
            .WithMany()
            .HasForeignKey(m => m.CreatedById)
            .OnDelete(DeleteBehavior.Restrict);

        // Lines are part of the movement (Cascade); an item used on a movement
        // can't be deleted (Restrict).
        modelBuilder.Entity<StockMovementLine>()
            .HasOne(l => l.StockMovement)
            .WithMany(m => m.Lines)
            .HasForeignKey(l => l.StockMovementId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<StockMovementLine>()
            .HasOne(l => l.Item)
            .WithMany()
            .HasForeignKey(l => l.ItemId)
            .OnDelete(DeleteBehavior.Restrict);

        // Return costs are averages, so keep 4 decimals to avoid rounding drift.
        modelBuilder.Entity<StockMovementLine>()
            .Property(l => l.UnitCost)
            .HasPrecision(18, 4);

        // A material plan has at most one line per item. The plan goes with its
        // project (Cascade); an item that's planned can't be deleted (Restrict).
        modelBuilder.Entity<ProjectMaterial>()
            .HasIndex(m => new { m.ProjectId, m.ItemId })
            .IsUnique();
        modelBuilder.Entity<ProjectMaterial>()
            .HasOne(m => m.Project)
            .WithMany()
            .HasForeignKey(m => m.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<ProjectMaterial>()
            .HasOne(m => m.Item)
            .WithMany()
            .HasForeignKey(m => m.ItemId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ProjectMaterial>()
            .HasOne(m => m.UpdatedBy)
            .WithMany()
            .HasForeignKey(m => m.UpdatedById)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
