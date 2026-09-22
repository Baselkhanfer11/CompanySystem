# Roles and Permissions

Every user has exactly **one role**. Roles are defined in one place — `backend/CompanySystem.Api/Auth/Roles.cs` — and control both what the API allows and what the UI shows.

## The three roles

| Role (internal name) | Real-world job | In the approval pipeline |
|----------------------|----------------|--------------------------|
| `Administrator` | **CEO** | Final approver |
| `WarehouseManager` | **Head Manager** | First reviewer |
| `Employee` | **Engineer** | Uploads / submits documents |

The **`Managers`** group = `Administrator` + `WarehouseManager`. These are the roles allowed to **create, edit, and delete** data (employees, items, projects) and to **review** documents. `Employee` is read-and-submit only.

## Who can do what

| Action | Employee | WarehouseManager | Administrator |
|--------|:--------:|:----------------:|:-------------:|
| Log in & view data | ✅ | ✅ | ✅ |
| Upload a document | ✅ | ✅ | ✅ |
| Resubmit **their own** returned document | ✅ | ✅ | ✅ |
| Approve at **Manager** stage | ❌ | ✅ | ❌ |
| Approve at **CEO** stage | ❌ | ❌ | ✅ |
| Return / reject a document | ❌ | ✅ (Manager stage) | ✅ (CEO stage) |
| Create / edit / delete employees, items, projects | ❌ | ✅ | ✅ |
| Manage user accounts & access | ❌ | ❌ | ✅ |

> **Note on approvals:** a reviewer can only act at **their** stage. A manager cannot approve a document that's already waiting on the CEO, and vice-versa. This is enforced server-side, not just hidden in the UI.

## Accounts vs. employees

- An **Employee** record is just a person in the directory — it doesn't grant a login.
- To let someone sign in, an **Administrator** goes to **Employees → Grant access**, which creates a `User` (with a role + password) linked to that employee.
- Access can later be updated or revoked from the same place.

## Adding a new role later

Because roles live in one file, adding one is three small steps (see the comment in `Roles.cs`):
1. Add a `const` for the new role.
2. Add it to the `All` array.
3. Optionally include it in `Managers` if it should be allowed to modify data.
