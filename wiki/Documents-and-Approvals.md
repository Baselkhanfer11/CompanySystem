# Documents and Approvals

This is the flagship feature. An engineer uploads an **Excel file**, and it travels **upward** through the company for sign-off, with every step recorded so the CEO can trace exactly what happened.

## The pipeline

```
  Employee                 WarehouseManager              Administrator
 (Engineer)                  (Head Manager)                  (CEO)
     │                             │                            │
     │  upload Excel               │                            │
     ▼                             │                            │
┌──────────────┐   approve   ┌──────────────┐   approve   ┌────────────┐
│ PendingManager│ ──────────▶│  PendingCEO   │ ──────────▶│  Approved  │
└──────────────┘             └──────────────┘             └────────────┘
     ▲       │                     │
     │       │ return (needs edits)│ return (needs edits)
     │       └─────────────────────┘
     │  resubmit (fixed file)      │
     └──── Returned ◀──────────────┘

          any reviewer can  ✗ reject & remove  →  document + file deleted
```

## The states

| Status | Meaning |
|--------|---------|
| `PendingManager` | Waiting for the Warehouse Manager to review |
| `PendingCEO` | Manager approved; waiting for the CEO |
| `Approved` | Fully signed off ✅ |
| `Returned` | Sent back to the engineer for edits |

## What each action does

- **Approve** — moves the document to the next stage (or to `Approved` if the CEO approves). The next reviewer gets a "your turn" notification; on final approval the uploader is told it's approved.
- **Return to engineer** — a **note is required** (what needs fixing). Status becomes `Returned`; the uploader is notified and can fix and **resubmit**, which replaces the file and sends it back to `PendingManager` — the loop starts again.
- **Reject & remove** — for documents that should be killed entirely. The uploader is notified **first**, then the document **and its file are permanently deleted**.

## The file itself

The Excel file is **stored and passed along, never parsed**. It's saved to disk under `Storage/uploads/` with a GUID name (the original filename is remembered for download). Downloading is authenticated: the browser fetches the file with the bearer token, turns it into a blob, and saves it.

## The audit trail (trace / timeline)

Every meaningful action writes a **`DocumentEvent`** — `Submitted`, `Approved`, `Returned`, or `Resubmitted` — recording **who** did it, **when**, and any **note**. Opening a document's **History** shows:

- a **3-step stepper** (Engineer → Manager → CEO) with the current position highlighted, and
- a **vertical timeline** of every event with an icon, the actor's name, the note, and the exact time.

This is what lets the CEO "trace every step in an easy way."

## Notifications

Notifications are stored in their own table so they **survive even if the document is rejected and deleted** (the link to the document is a loose id, not a hard foreign key). Two directions are covered:

- **Reviewers** get *"a document needs your review."*
- **The uploader** gets the **outcome** — approved, returned, or rejected.

The bell polls every 20 seconds and also refreshes on window focus and right after any action, so updates feel live without a manual refresh.

## Key design decisions

- **Fixed 3 steps** — the pipeline is always Engineer → Manager → CEO.
- **Every document belongs to a project.**
- **No new roles** — it reuses the existing three (Employee / WarehouseManager / Administrator).
- **Notifications are decoupled** from documents so history and alerts don't disappear when a document is removed.
