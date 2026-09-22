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

The API starts on its configured port (e.g. `http://localhost:5022`) and serves JSON under `/api/...`.

> **Database:** Entity Framework Core migrations create the tables. Apply them with:
> ```bash
> dotnet ef database update
> ```
> Run this inside `backend/CompanySystem.Api` whenever new migrations are added.

## 2. Run the frontend (the web app)

```bash
cd frontend
bun install
bun run dev
```

Vite serves the app (e.g. `http://localhost:5173`) and **proxies** every `/api` request to the backend, so the two talk to each other automatically. If the frontend shows a `502`, it almost always means the **backend isn't running** — start it first.

## 3. Log in

Open the app in your browser and sign in with an account. Roles decide what you can see and do — read [[Roles and Permissions]].

- **Administrator** accounts can create other users from **Employees → Grant access**.
- New staff are added as **Employees** first, then given login access.

## Handy notes for development

- **Git:** always run `git add .` from the **repo root** (`CompanySystem/`), never from `backend/` or `frontend/`, or you'll only stage half your changes.
- **Uploaded files** live under `backend/CompanySystem.Api/Storage/uploads/` and are git-ignored — they never get committed.
- **PowerShell 5.1** has no `&&`; chain commands with `;` instead.
