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

## Features
- [x] Employees, login access and four roles
- [x] Store / warehouse (items & stock, by location)
- [x] Projects with material plans
- [x] Suppliers, purchases and supplier price history
- [x] Stock movements (send / return / split between sites)
- [x] To-buy list, project costs and a home dashboard
- [x] Excel document approvals with notifications
- [ ] Sales
- [ ] Export to Excel
- [ ] Printable stock-movement records

More in the [wiki](wiki/Home.md).
