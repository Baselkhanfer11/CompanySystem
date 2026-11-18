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

## Selling

### Customer
Who the company sells to. The same fields as a supplier: `Name`, unique `Code`, optional `ContactPerson` / `Phone` / `Email` / `Address` / `Notes`, `Status` (`Active` / `Inactive`), `CreatedAt`.

### Sale
One order to a customer. Fields: `CustomerId`, optional `Reference`, `Date`, optional `Notes`, `Status` (`Ordered` / `Delivered` / `Cancelled`), `DeliveredAt` / `DeliveredById` (set while delivered), `CancelledAt` / `CancelledById`, `CreatedById`, `CreatedAt`, its `Items` and its `Payments`. The payment status (`Unpaid` / `PartlyPaid` / `Paid`) is **never stored** — it's worked out from the total and the payments. See [[Sales]].

### SaleItem
One order line: `SaleId`, `ItemId`, `Quantity`, `UnitPrice` (the selling price typed on the sale, 4 decimals).

### SalePayment
Money received against a sale: `SaleId`, `Date`, `Amount` (4 decimals), optional `Note`, `RecordedById`, `CreatedAt`.

### SaleEvent
One entry in a sale's history: `SaleId`, `Action` (`Edited` / `Delivered` / `DeliveryUndone` / `Cancelled` / `PaymentAdded` / `PaymentRemoved`), `ActorId`, `Changes` (JSON, like a purchase edit, plus the amount for payments), `CreatedAt`.

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
Customer 1───* Sale            1───* SaleItem *───1 Item
Sale     1───* SalePayment
Sale     1───* SaleEvent

Project  1───* Document        1───* DocumentEvent
User     1───* Notification    (as Recipient)
Notification ···> Document     (loose id, NO foreign key)

User is also linked as: Document.UploadedBy, DocumentEvent.Actor, Purchase.CreatedBy,
PurchaseEvent.Actor, StockMovement.CreatedBy, ProjectMaterial.UpdatedBy, Sale.CreatedBy /
DeliveredBy / CancelledBy, SalePayment.RecordedBy, SaleEvent.Actor
```

## Delete behavior (why it's set up this way)

Two goals: **history never disappears**, and SQL Server never sees **multiple cascade paths** to the same table. So "parts of a thing" cascade, and "things referred to" are protected.

| Relationship | On delete | Reason |
|--------------|-----------|--------|
| Purchase → PurchaseItem, PurchaseEvent | **Cascade** | Lines and history are part of the purchase |
| Sale → SaleItem, SalePayment, SaleEvent | **Cascade** | Lines, payments and history are part of the sale (sales themselves are never deleted, only cancelled) |
| Sale → Customer | **Restrict** | Can't delete a customer with sales |
| StockMovement → StockMovementLine | **Cascade** | Lines are part of the movement |
| Project → ProjectMaterial | **Cascade** | The plan goes with its project |
| Project → Document → DocumentEvent | **Cascade** | Deleting a project removes its documents and their history |
| Employee → User | **Cascade** | Deleting an employee removes their login |
| Purchase → Supplier | **Restrict** | Can't delete a supplier with purchases — cost history stays intact |
| Purchase / StockMovement → Project | **Restrict** | Can't delete a project with purchases or movements |
| PurchaseItem / SaleItem / StockMovementLine / ProjectMaterial → Item | **Restrict** | Can't delete an item that's been bought, sold, moved or planned |
| Anything → User (CreatedBy, Actor, UploadedBy, Recipient…) | **Restrict** | Removing a user never erases history |
| Notification → Document | *(no FK)* | Alerts outlive rejected/deleted documents |

## A note on statuses

Statuses and types (`ProjectStatuses`, `SupplierStatuses`, `CustomerStatuses`, `SaleStatuses`, `SaleActions`, `StockMovementTypes`, `DocumentStatuses`, `DocumentActions`, `PurchaseActions`, `NotificationTypes`, `Roles`) are stored as **plain strings** with a small validator class each. Adding a new value is a one-line code change with **no database migration** required.

## Money

Prices, paid unit prices, selling prices, payments and movement unit costs are all stored with **4 decimals** (a screw can cost 0.075; return costs are averages). Totals are shown with 2.
