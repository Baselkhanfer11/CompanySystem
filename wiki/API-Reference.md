# API Reference

All endpoints live under `/api` and (except login) require a **JWT bearer token** in the `Authorization: Bearer <token>` header.

**Access** column:
- **Any** — any logged-in user
- **Procurement** — `Administrator`, `WarehouseManager` or `ProcurementOfficer`
- **Managers** — `Administrator` or `WarehouseManager`
- **Admin** — `Administrator` only

See [[Roles and Permissions]] for the roles themselves.

**Errors:** `400` for bad input, `404` when something doesn't exist, `409 Conflict` when the action would break a rule (a duplicate code, stock going below zero, deleting something that's still in use). The body is `{ "message": "..." }` with a readable reason.

## Auth

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| POST | `/api/auth/login` | Public | Exchange username + password for a JWT |
| GET | `/api/auth/me` | Any | Return the current user (id, name, role) |

## Dashboard

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/dashboard` | Any | Everything the home screen needs in one response: team, open projects with plan progress, latest activity. Cost this month / last month only for managers (`null` otherwise) |

## Employees

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/employees` | Any | List employees |
| GET | `/api/employees/{id}` | Any | One employee |
| POST | `/api/employees` | Managers | Create |
| PUT | `/api/employees/{id}` | Managers | Update |
| DELETE | `/api/employees/{id}` | Managers | Delete |

### Employee access (accounts)

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| POST | `/api/employees/{employeeId}/access` | Admin | Grant a login (create user) |
| PUT | `/api/employees/{employeeId}/access` | Admin | Update role / reset password |
| DELETE | `/api/employees/{employeeId}/access` | Admin | Revoke access |

## Users

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/users` | Admin | List user accounts |
| DELETE | `/api/users/{id}` | Admin | Delete a user account |

## Items (store / warehouse)

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/items` | Any | List items (quantity = warehouse stock) |
| GET | `/api/items/{id}` | Any | One item |
| POST | `/api/items` | Procurement | Create (code must be unique) |
| PUT | `/api/items/{id}` | Procurement | Update |
| DELETE | `/api/items/{id}` | Procurement | Delete (refused if it's used on a purchase, movement or plan) |

## Projects

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/projects` | Any | List projects |
| GET | `/api/projects/{id}` | Any | One project |
| POST | `/api/projects` | Managers | Create (code must be unique → 409 if taken) |
| PUT | `/api/projects/{id}` | Managers | Update |
| DELETE | `/api/projects/{id}` | Managers | Delete (refused if it has purchases or movements) |

## Material plans

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/projects/{projectId}/plan` | Any | The plan, with what's on site, what's still needed and the totals |
| PUT | `/api/projects/{projectId}/plan` | Procurement | Replace the whole plan (lines at 0 are removed) |
| GET | `/api/plans/shortages` | Any | Per item across open projects: needed, in the warehouse, to buy, estimated cost, and which sites need it |

## Suppliers

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/suppliers` | Any | List suppliers |
| GET | `/api/suppliers/{id}` | Any | One supplier |
| POST | `/api/suppliers` | Procurement | Create (code must be unique) |
| PUT | `/api/suppliers/{id}` | Procurement | Update |
| DELETE | `/api/suppliers/{id}` | Procurement | Delete (refused if it has purchases) |

## Purchases

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/purchases` | Any | List purchases, newest first |
| GET | `/api/purchases/{id}` | Any | One purchase with all its lines and its edit history |
| POST | `/api/purchases` | Procurement | Record a purchase; the material lands in the warehouse or on the chosen site |
| PUT | `/api/purchases/{id}` | Procurement | Edit; stock moves by the difference and the change is recorded (409 if stock already moved on) |
| DELETE | `/api/purchases/{id}` | Procurement | Delete; takes its material back out (409 if some already moved on) |

## Prices

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/prices` | Any | One row per (item, supplier) ever bought: last price and date, lowest and average price, times bought, total quantity, whether the supplier is active |
| GET | `/api/prices/items/{itemId}` | Any | Every purchase of one item, newest first |

## Stock

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/stock/on-site?projectId=` | Any | What's on each site right now (optionally one site). Warehouse stock is on the items |
| GET | `/api/stock/movements?projectId=` | Any | Movements, newest first (optionally one site) |
| GET | `/api/stock/movements/{id}` | Any | One movement with its lines |
| POST | `/api/stock/movements` | Procurement | Send (`Issue`) or return (`Return`) material; 409 if there isn't enough |
| POST | `/api/stock/movements/batch` | Procurement | 1–50 movements booked together — all or none |
| DELETE | `/api/stock/movements/{id}` | Procurement | Undo a movement (409 if the material has moved since) |

## Reports

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/reports/project-costs?from=&to=` | Managers | Every project's cost (most expensive first), the warehouse bucket, and the monthly trend. Dates optional and inclusive |
| GET | `/api/reports/project-costs/{projectId}?from=&to=` | Managers | One project's drill-down: by supplier, top items, latest activity. Use `0` for the warehouse |

## Documents & approvals

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/documents` | Any | List all documents |
| GET | `/api/documents/{id}` | Any | One document **+ its full event history** |
| POST | `/api/documents` | Any | Upload (multipart: title, projectId, file) |
| GET | `/api/documents/{id}/file` | Any | Download the stored Excel file |
| POST | `/api/documents/{id}/approve` | Stage reviewer | Approve → next stage / Approved |
| POST | `/api/documents/{id}/return` | Stage reviewer | Return to engineer (note required) |
| POST | `/api/documents/{id}/reject` | Stage reviewer | Reject & permanently remove |
| POST | `/api/documents/{id}/resubmit` | Uploader | Replace file and resubmit a returned doc |

## Notifications

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/notifications` | Any | Current user's newest 50 notifications |
| POST | `/api/notifications/read` | Any | Mark all as read |
