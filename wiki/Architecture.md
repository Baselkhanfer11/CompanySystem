# Architecture

CompanySystem is two apps that talk over HTTP: a **React frontend** and an **ASP.NET Core API**, backed by **SQL Server**.

```
┌─────────────────┐     /api/... (JSON + JWT)     ┌──────────────────┐     EF Core     ┌────────────┐
│  React frontend │  ─────────────────────────▶   │  ASP.NET Core API │  ───────────▶  │ SQL Server │
│  (Vite, Bun)    │  ◀─────────────────────────   │  (.NET 9, C#)     │  ◀───────────  │            │
└─────────────────┘                                └──────────────────┘                 └────────────┘
```

## Folder layout

```
CompanySystem/
├── backend/
│   ├── CompanySystem.sln
│   └── CompanySystem.Api/
│       ├── Controllers/     # HTTP endpoints (Auth, Employees, Items, Projects, Documents, Notifications…)
│       ├── Models/          # EF Core entities (User, Employee, Item, Project, Document, DocumentEvent, Notification)
│       ├── Dtos/            # Shapes sent to/from the frontend
│       ├── Data/            # AppDbContext + migrations
│       ├── Services/        # FileStorage, JWT token service
│       ├── Json/            # UtcDateTimeConverter
│       └── Storage/uploads/ # Saved Excel files (git-ignored)
└── frontend/
    └── src/
        ├── api/          # Thin fetch wrappers per resource
        ├── auth/         # AuthContext + role constants
        ├── components/   # Reusable UI (modals, bell, icons…)
        ├── data/         # React Contexts for shared data (Items, Notifications)
        ├── pages/        # One component per screen
        ├── layouts/      # AppLayout (sidebar + topbar + providers)
        ├── lib/          # Formatting + status helpers
        └── i18n/         # English + Arabic dictionaries, RTL
```

## Backend patterns

- **Controllers are thin.** Each one uses the `AppDbContext` directly and returns **DTOs**, never raw entities.
- **JWT auth.** `POST /api/auth/login` returns a bearer token; every other endpoint requires it. The token carries the user's **role**, which `[Authorize(Roles = ...)]` checks.
- **Roles in one place.** `Auth/Roles.cs` defines `Administrator`, `WarehouseManager`, `Employee`, plus a `Managers` group (the roles allowed to write).
- **String-based statuses.** Statuses and types (project status, document status, notification type…) are plain strings, so new values can be added **without a database migration**.
- **UTC everywhere.** A global `UtcDateTimeConverter` stamps every serialized `DateTime` with a `Z`, so the browser shows correct local times (no "3 hours ago" for something that just happened).

### EF Core gotcha worth knowing
You cannot call a C# helper method inside a database query — EF can't translate it. The pattern used here is: **load first, map second**.
```csharp
var docs = await db.Documents
    .Include(d => d.Project)
    .Include(d => d.UploadedBy)
    .ToListAsync();          // hits the database
return docs.Select(ToDto);   // maps in memory
```

## Frontend patterns

- **Context for shared data, page-state for the rest.** Data the whole app needs (the notifications bell, item stock) lives in a **React Context**; data only one screen needs is fetched in that page.
- **Near-live notifications.** The bell polls every 20s and also refreshes on window focus / tab visibility, and immediately after any approval action.
- **i18n + RTL.** A flat dictionary of dot-namespaced keys (`doc.status.Approved`, …) in English and Arabic; switching to Arabic flips the whole layout right-to-left.
- **Theming via CSS variables.** Dark is the default; a `[data-theme="light"]` override provides light mode.
