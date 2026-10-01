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
│       ├── Auth/            # Roles.cs (all roles in one place) + JWT token service
│       ├── Controllers/     # HTTP endpoints: Auth, Dashboard, Employees, Items, Projects,
│       │                    #   MaterialPlan, Suppliers, Purchases, Prices, Stock, Reports,
│       │                    #   Documents, Notifications, Users
│       ├── Models/          # EF Core entities (see Data Model)
│       ├── Dtos/            # Shapes sent to/from the frontend
│       ├── Data/            # AppDbContext + DbSeeder (first admin)
│       ├── Migrations/      # EF Core migrations (applied on startup)
│       ├── Services/        # StockService, PlanMath, FileStorage
│       ├── Json/            # UtcDateTimeConverter
│       └── Storage/uploads/ # Saved Excel files (git-ignored)
└── frontend/
    └── src/
        ├── api/          # Thin fetch wrappers per resource
        ├── auth/         # AuthContext + role constants and helpers
        ├── components/   # Reusable UI (modals, bell, icons, charts…)
        ├── data/         # Shared data: items + shortages, notifications, cached queries
        ├── pages/        # One component per screen (lazy-loaded)
        ├── layouts/      # AppLayout (sidebar + topbar + providers)
        ├── lib/          # Formatting, stock, prices, reports helpers + the request cache
        └── i18n/         # English + Arabic dictionaries, RTL
```

## Backend patterns

- **Controllers are thin.** Each one uses the `AppDbContext` directly and returns **DTOs**, never raw entities.
- **JWT auth.** `POST /api/auth/login` returns a bearer token; every other endpoint requires it. The token carries the user's **role**, which `[Authorize(Roles = ...)]` checks.
- **Roles in one place.** `Auth/Roles.cs` defines the four roles and two groups: `Managers` (Administrator + WarehouseManager) and `Procurement` (the managers + ProcurementOfficer). See [[Roles and Permissions]].
- **One place moves stock.** `StockService` is the only code that changes stock. Warehouse stock is stored on the item; **site stock is never stored** — it's worked out from purchases and movements, so it can't drift from the history. `Apply(delta)` checks every change first: if **any** place would go below zero, **nothing** changes and a readable reason comes back (the API turns it into a `409`). See [[Purchasing and Stock]].
- **All or nothing.** Anything that touches several records (a purchase edit, a batch of movements) is saved with **one** `SaveChanges`, so it either all happens or none of it does.
- **Numbers in one place.** `PlanMath` works out a plan's budget, still-to-spend and progress, so the plan window and the dashboard can never disagree.
- **Read-only queries are lean.** List and report endpoints use `AsNoTracking()`, select only the columns they show, and let SQL do the summing.
- **String-based statuses.** Statuses and types (project status, document status, movement type…) are plain strings, so new values can be added **without a database migration**.
- **UTC everywhere.** A global `UtcDateTimeConverter` stamps every serialized `DateTime` with a `Z`, so the browser shows correct local times.

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

- **A shared request cache.** `lib/cache.ts` is a small "stale-while-revalidate" cache: each key (projects, suppliers, prices…) is fetched **once** and shared by every component that needs it. Coming back to a page shows cached data instantly and only re-fetches if it's older than 30 s. After a change, the page calls `invalidate(...)` so everything showing that data refreshes. The cache is cleared on login / logout.
- **Items and shortages travel together.** The store items and the to-buy shortages are one cache entry (`ItemsContext`), read by the Store page, the dashboard, the To buy page and the bell — one request for all of them.
- **Code splitting.** Every page is `lazy()`-loaded, so the first load only downloads what the login screen and the current page need.
- **Near-live notifications.** The bell polls every 20 s and also refreshes on window focus / tab visibility and right after any approval action.
- **i18n + RTL.** A flat dictionary of dot-namespaced keys (`doc.status.Approved`, `toBuy.split`, …) in English and Arabic; switching to Arabic flips the whole layout right-to-left.
- **One design system.** Colors, font sizes (`--fs-*`), spacing (`--sp-*`) and radii (`--radius-*`) are CSS variables in `index.css`, with shared classes for tables, buttons, chips and stat tiles. Dark is the default; `[data-theme="light"]` provides light mode. Layouts are checked at phone width.
