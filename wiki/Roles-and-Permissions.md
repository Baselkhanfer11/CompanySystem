# Roles and Permissions

Every user has exactly **one role**. Roles are defined in one place — `backend/CompanySystem.Api/Auth/Roles.cs` (mirrored in `frontend/src/auth/roles.ts`) — and control both what the API allows and what the UI shows.

## The four roles

| Role (internal name) | Real-world job | What they're for |
|----------------------|----------------|------------------|
| `Administrator` | **CEO** | Everything, final document approver, manages accounts |
| `WarehouseManager` | **Head Manager** | Runs the company data, first document reviewer |
| `ProcurementOfficer` | **Procurement Officer** | Buying and stock: suppliers, purchases, movements, plans, items |
| `Employee` | **Engineer** | Looks things up and submits documents |

Two **groups** are built from them:

- **`Managers`** = `Administrator` + `WarehouseManager`. Can change employees and projects, and see costs.
- **`Procurement`** = the managers + `ProcurementOfficer`. Can change everything to do with buying and stock.

## Who can do what

| Action | Employee | Procurement Officer | Warehouse Manager | Administrator |
|--------|:--------:|:-------------------:|:-----------------:|:-------------:|
| Log in & view employees, items, projects, suppliers, purchases, stock, plans, to-buy | ✅ | ✅ | ✅ | ✅ |
| Upload a document / resubmit **their own** returned one | ✅ | ✅ | ✅ | ✅ |
| Create / edit / delete **items** and **suppliers** | ❌ | ✅ | ✅ | ✅ |
| Record / edit / delete **purchases** | ❌ | ✅ | ✅ | ✅ |
| Send / return / undo **stock movements** (incl. split) | ❌ | ✅ | ✅ | ✅ |
| Edit a project's **material plan** | ❌ | ✅ | ✅ | ✅ |
| Create / edit / delete **employees** and **projects** | ❌ | ❌ | ✅ | ✅ |
| See **money**: the Costs page and the cost tile on the dashboard | ❌ | ❌ | ✅ | ✅ |
| Approve / return / reject at the **Manager** stage | ❌ | ❌ | ✅ | ❌ |
| Approve / return / reject at the **CEO** stage | ❌ | ❌ | ❌ | ✅ |
| Manage user accounts & access | ❌ | ❌ | ❌ | ✅ |

> **Enforced on the server.** The UI hides buttons people can't use, but the API checks every request too — hiding a button is never the only protection.

> **Note on approvals:** a reviewer can only act at **their** stage. A manager cannot approve a document that's already waiting on the CEO, and vice-versa.

> **Why the Procurement Officer can't see costs:** cost reports are financial data for the managers. The officer still sees prices on purchases and on the to-buy list — they need those to buy well.

## Accounts vs. employees

- An **Employee** record is just a person in the directory — it doesn't grant a login.
- To let someone sign in, an **Administrator** goes to **Employees → Grant access**, which creates a `User` (with a role + password) linked to that employee.
- Access can later be updated (role, password) or revoked from the same place.

## Adding a new role later

Because roles live in one file, adding one is three small steps (see the comment in `Roles.cs`):
1. Add a `const` for the new role.
2. Add it to the `All` array.
3. Optionally include it in `Managers` or `Procurement` if it should be allowed to change data.

Then mirror it in `frontend/src/auth/roles.ts` and add its label to the i18n dictionary (`role.*`).
