# CompanySystem Wiki

**CompanySystem** is an internal web tool for a contracting company ("The Contractor") to manage its people, warehouse, projects, and — the flagship feature — an **Excel document approval pipeline** that moves paperwork from an engineer up through a manager to the CEO, with a full audit trail and live notifications.

> 🚧 Work in progress — built step by step as a learning project.

---

## What it does today

- 👥 **Employees** — keep a directory of staff, and grant them login access.
- 📦 **Store / Items** — track warehouse materials with low-stock alerts.
- 🏗️ **Projects** — every piece of work belongs to a project (with a unique code + status).
- 📄 **Documents & Approvals** — upload an Excel file and route it **Engineer → Manager → CEO**; each reviewer can approve, return for edits, or reject. Everyone sees a **live bell notification**, and any document's full history can be traced step by step.
- 🔔 **Notifications** — real-time bell that tells reviewers "it's your turn" and tells the uploader the outcome.
- 🌍 **Bilingual UI** — English + Arabic (with full right-to-left layout) and a dark/light theme.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | ASP.NET Core Web API (.NET 9, C#) |
| Frontend | React 19 + Vite + TypeScript |
| Database | SQL Server + Entity Framework Core |
| Auth | JWT bearer tokens |
| Frontend package manager | **Bun** 🐰 (not npm) |

---

## Wiki pages

| Page | What's inside |
|------|---------------|
| [[Getting Started]] | Install, run the backend + frontend, log in |
| [[Architecture]] | How the pieces fit together and the key patterns |
| [[Roles and Permissions]] | The three roles and who can do what |
| [[Documents and Approvals]] | The approval pipeline explained in full |
| [[API Reference]] | Every HTTP endpoint |
| [[Data Model]] | The database entities and their relationships |
| [[Roadmap]] | What's done and what's next |
