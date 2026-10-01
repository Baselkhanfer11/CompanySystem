# CompanySystem Wiki

**CompanySystem** is an internal web tool for a contracting company ("The Contractor"). It runs the warehouse and the buying side of the business: what the company has, where it is, what each project needs, what still has to be bought, and what every project has cost so far. It also carries an **Excel document approval pipeline** (Engineer → Manager → CEO) with a full audit trail and live notifications.

> 🚧 Work in progress — built step by step as a learning project.

---

## What it does today

- 🏠 **Dashboard** — one screen with this month's project costs, open projects and how far their material plans are, what needs attention, and the latest activity.
- 👥 **Employees** — a staff directory, and login access granted per person.
- 📦 **Store / Items** — warehouse materials with prices, units and low / out-of-stock alerts, plus where each item is (warehouse vs. sites).
- 🏗️ **Projects** — every site is a project, with a unique code, a status and a **material plan**.
- 🚚 **Suppliers & Purchases** — who the company buys from, every invoice line, delivered to the warehouse or straight to a site. Purchases can be edited (with a full change history) or deleted, and stock is protected both ways.
- 💲 **Price history** — what each supplier charged for each item, and who's cheapest right now. New purchases suggest the cheapest supplier.
- 🔁 **Stock movements** — send material from the warehouse to a site, or return it. Each movement is costed and can be undone.
- 🛒 **To buy** — what open projects still need, what the warehouse can cover, and what must be bought. You can buy, send or **split** a short item between sites straight from the list.
- 💰 **Project costs** — what each project has cost, by supplier, item and month (managers only).
- 📄 **Documents & Approvals** — upload an Excel file and route it **Engineer → Manager → CEO**. Each reviewer can approve, return or reject, and every step is traceable.
- 🔔 **Notifications** — a near-live bell for document reviews and outcomes, and for stock that's short, low or out.
- 🌍 **Bilingual UI** — English + Arabic (full right-to-left layout), dark / light theme, works on phones.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | ASP.NET Core Web API (.NET 9, C#) |
| Frontend | React 19 + Vite + TypeScript |
| Database | SQL Server + Entity Framework Core |
| Auth | JWT bearer tokens, 4 roles |
| Frontend package manager | **Bun** 🐰 (not npm) |

---

## Wiki pages

| Page | What's inside |
|------|---------------|
| [[Getting Started]] | Install, run the backend + frontend, log in |
| [[Architecture]] | How the pieces fit together and the key patterns |
| [[Roles and Permissions]] | The four roles and who can do what |
| [[Purchasing and Stock]] | Suppliers, purchases, price history, stock movements |
| [[Material Plans and To Buy]] | Project plans, shortages, buy / send / split |
| [[Project Costs]] | How a project's cost is worked out, and the cost report |
| [[Documents and Approvals]] | The approval pipeline explained in full |
| [[API Reference]] | Every HTTP endpoint |
| [[Data Model]] | The database entities and their relationships |
| [[Roadmap]] | What's done and what's next |
