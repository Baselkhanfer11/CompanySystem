# Roadmap

Where CompanySystem is and where it's heading.

## ✅ Done

**Foundations**
- **Authentication** — JWT login, four roles, per-role access control enforced by the API.
- **Employees** — directory + grant/revoke login access.
- **Store / Items** — materials with prices, units, low / out-of-stock alerts and locations.
- **Projects** — full CRUD, unique codes, statuses.
- **Documents & Approvals** — upload Excel, Engineer → Manager → CEO pipeline, approve / return / reject / resubmit, file storage + authenticated download, full trace / timeline.
- **Notifications** — persistent, two-directional, near-live bell, plus stock alerts.

**Buying and stock** (PRs #1 – #15)
- **Suppliers & Purchases** — invoices delivered to the warehouse or straight to a site (#1, #2).
- **Cost per project** — report with periods, monthly trend and drill-down (#3).
- **Edit purchases** — stock protection and a full edit history (#4).
- **Stock movements** — send / return / undo, stock by location, returns at average site cost (#5).
- **Material plans + To buy** — what each project needs and what to buy (#6).
- **Procurement Officer role** — buying and stock without access to costs or people (#7).
- **Home dashboard** — costs vs last month, project progress, needs attention, activity; to-buy urgency levels (#8).
- **Performance** — leaner queries, a shared request cache, code-split pages (#9).
- **UI polish & consistency** — one spacing / type scale, consistent dialogs and table actions; **Buy** from the to-buy list (#10, #11).
- **Ready to send** — send what the warehouse already has, one site at a time (#12).
- **Supplier price history** — who's cheapest, suggested supplier when buying (#13).
- **Send what we have** — partial sends to single sites, and **Recently sent** with view / undo (#14).
- **Split shared items** — share short stock between several sites, booked all-or-nothing (#15).

**Throughout** — bilingual EN/AR with RTL, dark/light theme, correct UTC times, phone-friendly layouts.

## 🔜 Next up

- **Sales** — the other half of "purchases & sales statistics".
- **Export to Excel** — the to-buy list, stock and movements.
- **Lint cleanup** — clear the remaining linter warnings.

## 💡 Later ideas

- Item **photo upload** (`Item.ImageUrl` is already there).
- **Excel import** to bulk-create items.
- Printable **stock-movement records** ("processes").

---

*This is a learning project, built one focused step at a time. Each feature ships on its own branch as a pull request with a clear scope.*
