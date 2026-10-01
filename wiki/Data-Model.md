# Data Model

The database is managed by **Entity Framework Core** (code-first migrations, applied on startup). These are the main entities.

## People and access

### User
A login account. Unique `Username`, a hashed password and a **role** (`Administrator` / `WarehouseManager` / `ProcurementOfficer` / `Employee`). Usually linked to one `Employee`.

### Employee
A person in the company directory. May or may not have a `User` account (access is granted separately).

## Warehouse and projects

### Item
A warehouse material. Fields: `Name`, unique `Code`, `Quantity` (**warehouse** stock only), `Unit` (pcs, bag, m…), `Price` (list price), optional `ImageUrl`, `CreatedAt`. Low / out-of-stock alerts are worked out from `Quantity` (out ≤ 0, low ≤ 10).

### Project
A site the company works on — the bucket project costs go into. Fields: `Name`, unique `Code`, `Status` (`Active` / `OnHold` / `Completed`), optional `Description`, `CreatedAt`.

### ProjectMaterial
One line of a project's **material plan**: `ProjectId`, `ItemId`, `PlannedQuantity` (the total needed), `UpdatedById`, `UpdatedAt`. At most one line per project + item.

## Buying

### Supplier
Who the company buys from. Fields: `Name`, unique `Code`, optional `ContactPerson` / `Phone` / `Email` / `Address` / `Notes`, `Status` (`Active` / `Inactive`), `CreatedAt`.

### Purchase
One supplier invoice. Fields: `SupplierId`, `ProjectId` (**null = delivered to the warehouse**, otherwise to that site), optional `InvoiceNumber`, `Date`, optional `Notes`, `CreatedById`, `CreatedAt`, and its `Items` (lines).

### PurchaseItem
One invoice line: `PurchaseId`, `ItemId`, `Quantity`, `UnitPrice` (what was actually paid — may differ from the list price). Price history is read from these lines.

### PurchaseEvent
One entry in a purchase's **edit history**: `PurchaseId`, `Action` (`Edited`), `ActorId`, `Changes` (JSON list of what changed — fields from → to, lines added / removed / changed, with name snapshots), `CreatedAt`.

## Moving stock

### StockMovement
Material moving between the warehouse and one site. Fields: `Type` (`Issue` = warehouse → site, `Return` = site → warehouse), `ProjectId`, `Date`, optional `Notes`, `CreatedById`, `CreatedAt`, and its `Lines`.

### StockMovementLine
One item on a movement: `StockMovementId`, `ItemId`, `Quantity`, `UnitCost` — a snapshot taken when it was recorded (the item's price for an Issue, the average cost on the site for a Return). Stored with 4 decimals so averages don't drift.

> **Site stock isn't a table.** What's on a site = purchases delivered there + issues − returns, worked out by `StockService`. Only the warehouse quantity is stored. See [[Purchasing and Stock]].

## Documents and notifications

### Document
An uploaded Excel file moving through approval. Fields: `Title`, `ProjectId`, `FileName`, `StoredName` (the GUID on disk), `ContentType`, `FileSize`, `Status` (`PendingManager` / `PendingCEO` / `Approved` / `Returned`), `UploadedById`, `CreatedAt`, `UpdatedAt`.

### DocumentEvent
One entry in a document's audit trail. Fields: `DocumentId`, `Action` (`Submitted` / `Approved` / `Returned` / `Resubmitted`), `ActorId`, optional `Note`, `CreatedAt`.

### Notification
A persistent alert for one user. Fields: `RecipientId`, `Type` (`NeedsReview` / `Approved` / `Returned` / `Rejected`), `Title` (a snapshot), optional `DocumentId` (a **loose id, not a foreign key**, so it survives if the document is deleted), optional `Note`, `IsRead`, `CreatedAt`.

## Relationships

```
Employee 1───1 User

Project  1───* ProjectMaterial *───1 Item
Project  1───* StockMovement   1───* StockMovementLine *───1 Item
Project  1───* Purchase        (optional: null = warehouse)
Supplier 1───* Purchase        1───* PurchaseItem *───1 Item
Purchase 1───* PurchaseEvent

Project  1───* Document        1───* DocumentEvent
User     1───* Notification    (as Recipient)
Notification ···> Document     (loose id, NO foreign key)

User is also linked as: Document.UploadedBy, DocumentEvent.Actor, Purchase.CreatedBy,
PurchaseEvent.Actor, StockMovement.CreatedBy, ProjectMaterial.UpdatedBy
```

## Delete behavior (why it's set up this way)

Two goals: **history never disappears**, and SQL Server never sees **multiple cascade paths** to the same table. So "parts of a thing" cascade, and "things referred to" are protected.

| Relationship | On delete | Reason |
|--------------|-----------|--------|
| Purchase → PurchaseItem, PurchaseEvent | **Cascade** | Lines and history are part of the purchase |
| StockMovement → StockMovementLine | **Cascade** | Lines are part of the movement |
| Project → ProjectMaterial | **Cascade** | The plan goes with its project |
| Project → Document → DocumentEvent | **Cascade** | Deleting a project removes its documents and their history |
| Employee → User | **Cascade** | Deleting an employee removes their login |
| Purchase → Supplier | **Restrict** | Can't delete a supplier with purchases — cost history stays intact |
| Purchase / StockMovement → Project | **Restrict** | Can't delete a project with purchases or movements |
| PurchaseItem / StockMovementLine / ProjectMaterial → Item | **Restrict** | Can't delete an item that's been bought, moved or planned |
| Anything → User (CreatedBy, Actor, UploadedBy, Recipient…) | **Restrict** | Removing a user never erases history |
| Notification → Document | *(no FK)* | Alerts outlive rejected/deleted documents |

## A note on statuses

Statuses and types (`ProjectStatuses`, `SupplierStatuses`, `StockMovementTypes`, `DocumentStatuses`, `DocumentActions`, `PurchaseActions`, `NotificationTypes`, `Roles`) are stored as **plain strings** with a small validator class each. Adding a new value is a one-line code change with **no database migration** required.

## Money

Prices and paid unit prices are stored with **2 decimals**; movement unit costs with **4** (they can be averages).
