# Getting Started

How to run CompanySystem on your own machine.

## Prerequisites

- [.NET SDK 9](https://dotnet.microsoft.com/download)
- [Bun](https://bun.sh) (the frontend package manager — we do **not** use npm)
- SQL Server (LocalDB or a full instance)

## 1. Run the backend (the API)

```bash
cd backend/CompanySystem.Api
dotnet run
```

The API starts on `http://localhost:5022` and serves JSON under `/api/...`. You can also run it from Visual Studio (open `backend/CompanySystem.sln` and press F5).

> **Database:** on startup the API **applies any pending EF Core migrations by itself** and creates the tables, so a fresh database just works.
> If you add a new migration, it's applied the next time the API starts (or run `dotnet ef database update` inside `backend/CompanySystem.Api`).

> **First admin account:** the very first time the app runs (when there are no users yet), it creates one **Administrator** account. Its username and password come from the `Seed` section of `appsettings` — set your own there and keep real passwords out of git.

## 2. Run the frontend (the web app)

```bash
cd frontend
bun install
bun run dev
```

Vite serves the app on `http://localhost:5173` and **proxies** every `/api` request to the backend on port 5022, so the two talk to each other automatically. If the frontend shows a `502`, it almost always means the **backend isn't running** — start it first.

Other useful scripts:

| Command | What it does |
|---------|--------------|
| `bun run build` | Type-check and build for production |
| `bun run lint` | Run the linter (oxlint) |

## 3. Log in

Open the app in your browser and sign in with the admin account. Roles decide what you can see and do — read [[Roles and Permissions]].

- New staff are added as **Employees** first.
- An **Administrator** then gives them a login from **Employees → Grant access**, choosing their role.

## A sensible first run

To see the main features working with real numbers:

1. **Store** — add a few items with a price and unit.
2. **Suppliers** — add one or two suppliers.
3. **Projects** — add a project, then open its **Plan** and say how much of each item it needs.
4. **To buy** — the project's needs show up here. Click **Buy** to record a purchase, then **Send** to move it to the site.
5. **Costs** — see what the project has cost so far.

## Handy notes for development

- **Git:** always run `git add .` from the **repo root** (`CompanySystem/`), never from `backend/` or `frontend/`, or you'll only stage half your changes.
- **Workflow:** every feature gets its own branch → pull request → merge into `main`.
- **Uploaded files** live under `backend/CompanySystem.Api/Storage/uploads/` and are git-ignored — they never get committed.
- **PowerShell 5.1** has no `&&`; chain commands with `;` instead.
