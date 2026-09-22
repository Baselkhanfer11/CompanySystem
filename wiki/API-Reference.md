# API Reference

All endpoints live under `/api` and (except login) require a **JWT bearer token** in the `Authorization: Bearer <token>` header. Endpoints marked **Managers** need the `Administrator` or `WarehouseManager` role; **Admin** endpoints need `Administrator`.

## Auth

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| POST | `/api/auth/login` | Public | Exchange username + password for a JWT |
| GET | `/api/auth/me` | Any logged-in | Return the current user (id, name, role) |

## Employees

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/employees` | Any logged-in | List employees |
| GET | `/api/employees/{id}` | Any logged-in | One employee |
| POST | `/api/employees` | Managers | Create |
| PUT | `/api/employees/{id}` | Managers | Update |
| DELETE | `/api/employees/{id}` | Managers | Delete |

### Employee access (accounts)

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| POST | `/api/employees/{employeeId}/access` | Admin | Grant a login (create user) |
| PUT | `/api/employees/{employeeId}/access` | Admin | Update role / reset password |
| DELETE | `/api/employees/{employeeId}/access` | Admin | Revoke access |

## Items (store / warehouse)

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/items` | Any logged-in | List items |
| GET | `/api/items/{id}` | Any logged-in | One item |
| POST | `/api/items` | Managers | Create |
| PUT | `/api/items/{id}` | Managers | Update |
| DELETE | `/api/items/{id}` | Managers | Delete |

## Projects

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/projects` | Any logged-in | List projects |
| GET | `/api/projects/{id}` | Any logged-in | One project |
| POST | `/api/projects` | Managers | Create (code must be unique → 409 if taken) |
| PUT | `/api/projects/{id}` | Managers | Update |
| DELETE | `/api/projects/{id}` | Managers | Delete |

## Documents & approvals

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/documents` | Any logged-in | List all documents |
| GET | `/api/documents/{id}` | Any logged-in | One document **+ its full event history** |
| POST | `/api/documents` | Any logged-in | Upload (multipart: title, projectId, file) |
| GET | `/api/documents/{id}/file` | Any logged-in | Download the stored Excel file |
| POST | `/api/documents/{id}/approve` | Stage reviewer | Approve → next stage / Approved |
| POST | `/api/documents/{id}/return` | Stage reviewer | Return to engineer (note required) |
| POST | `/api/documents/{id}/reject` | Stage reviewer | Reject & permanently remove |
| POST | `/api/documents/{id}/resubmit` | Uploader | Replace file and resubmit a returned doc |

## Notifications

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/notifications` | Any logged-in | Current user's newest 50 notifications |
| POST | `/api/notifications/read` | Any logged-in | Mark all as read |

## Users

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/users` | Admin | List user accounts |
| DELETE | `/api/users/{id}` | Admin | Delete a user account |
