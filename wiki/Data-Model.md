# Data Model

The database is managed by **Entity Framework Core** (code-first migrations). These are the main entities.

## Entities

### User
A login account. Has a hashed password and a **role** (`Administrator` / `WarehouseManager` / `Employee`). Linked to an `Employee`.

### Employee
A person in the company directory. May or may not have a `User` account (access is granted separately).

### Item
A warehouse material / stock item, with quantity and a low-stock threshold that drives stock alerts.

### Project
A unit of work. Fields: `Name`, unique `Code`, `Status` (`Active` / `OnHold` / `Completed`), optional `Description`, `CreatedAt`. Every document belongs to a project.

### Document
An uploaded Excel file moving through approval. Fields: `Title`, `ProjectId`, `FileName`, `StoredName` (the GUID on disk), `ContentType`, `FileSize`, `Status` (`PendingManager` / `PendingCEO` / `Approved` / `Returned`), `UploadedById`, `CreatedAt`, `UpdatedAt`.

### DocumentEvent
One entry in a document's audit trail. Fields: `DocumentId`, `Action` (`Submitted` / `Approved` / `Returned` / `Resubmitted`), `ActorId`, optional `Note`, `CreatedAt`.

### Notification
A persistent alert for one user. Fields: `RecipientId`, `Type` (`NeedsReview` / `Approved` / `Returned` / `Rejected`), `Title` (a snapshot), optional `DocumentId` (a **loose id, not a foreign key**, so it survives if the document is deleted), optional `Note`, `IsRead`, `CreatedAt`.

## Relationships

```
Employee 1───1 User
Project  1───* Document
Document 1───* DocumentEvent
User     1───* Document        (as UploadedBy)
User     1───* DocumentEvent   (as Actor)
User     1───* Notification    (as Recipient)
Notification ···> Document     (loose id, NO foreign key)
```

## Delete behavior (why it's set up this way)

SQL Server rejects **multiple cascade paths** to the same table, so deletes are tuned deliberately:

| Relationship | On delete | Reason |
|--------------|-----------|--------|
| Project → Document | **Cascade** | Deleting a project removes its documents |
| Document → DocumentEvent | **Cascade** | Deleting a document removes its history |
| Document → UploadedBy (User) | **Restrict** | Don't delete a user just because of a document |
| DocumentEvent → Actor (User) | **Restrict** | Same — protect the user record |
| Notification → Recipient (User) | **Restrict** | Notifications don't cascade user deletes |
| Notification → Document | *(no FK)* | Alerts outlive rejected/deleted documents |

## A note on statuses

Statuses and types (`ProjectStatuses`, `DocumentStatuses`, `DocumentActions`, `NotificationTypes`, `Roles`) are stored as **plain strings** with a small validator class each. Adding a new value is a one-line code change with **no database migration** required.
