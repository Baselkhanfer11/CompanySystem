# CompanySystem

A company management & inventory system — track employees, store (warehouse) materials,
projects, stock movements ("processes"), and purchases & sales statistics.

> 🚧 Work in progress — built step by step for learning.

## Tech stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Backend   | ASP.NET Core Web API (.NET 9, C#)   |
| Frontend  | React 19 + Vite + TypeScript        |
| Database  | SQL Server + Entity Framework Core  |
| Package manager (frontend) | Bun 🐰                 |

## Project structure

```
CompanySystem/
├── backend/
│   ├── CompanySystem.sln          # Visual Studio solution
│   └── CompanySystem.Api/         # The Web API (serves JSON)
└── frontend/                      # React app (calls the API over HTTP)
```

## Getting started

### Prerequisites
- [.NET SDK 9](https://dotnet.microsoft.com/download)
- [Bun](https://bun.sh)
- SQL Server (LocalDB or full)

### Run the backend
```bash
cd backend/CompanySystem.Api
dotnet run
```

### Run the frontend
```bash
cd frontend
bun install
bun run dev
```

## Planned features
- [ ] Employees
- [ ] Store / warehouse (items & stock)
- [ ] Stock movements ("processes") with printable records
- [ ] Projects
- [ ] Purchases & Sales statistics
