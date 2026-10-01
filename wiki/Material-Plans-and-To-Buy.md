# Material Plans and To Buy

A project says **what it needs**; the system compares that with what's already on the site and in the warehouse, and tells you **what to send and what to buy**.

## Material plans

Each project has a **plan**: one line per item, with the **total** quantity the project needs (not "still needed" — that's worked out). Open it from **Projects → Plan**. Anyone can look at a plan; managers and the Procurement Officer can edit it.

For every line the plan window shows:

| Number | Meaning |
|--------|---------|
| Planned | The total the project needs |
| On site | What's on the site now (see [[Purchasing and Stock]]) |
| Still needed | `max(0, planned − on site)` |

And for the whole plan (worked out by `PlanMath`, so the dashboard shows the same numbers):

- **Budget** = planned × price
- **Still to spend** = still needed × price
- **Progress** = the share of the planned material (by value) that's already on site

Items that are on the site but not in the plan are listed too, so nothing is hidden.

## Shortages — what's still needed across all projects

`GET /api/plans/shortages` looks at every **open** project (completed projects don't need anything more) and, per item:

```
needed     = sum over projects of  max(0, planned − on site)
inWarehouse = the item's warehouse stock
toBuy      = max(0, needed − inWarehouse)
estimated cost = toBuy × price
```

It also lists **which sites** need it and how much each one still needs.

## The To buy page

The page sorts every shortage by how urgent it is:

| Level | Meaning |
|-------|---------|
| 🔴 **Urgent** | The warehouse has none — the site waits until we buy |
| 🟠 **Partial** | The warehouse can send some; the rest must be bought |
| 🟢 **Covered** | The warehouse has enough — nothing to buy, just send it |

The sidebar shows how many items are short next to **To buy**, and the bell lists them too.

### Buy

**Buy** opens the purchase form already filled in:

- **Delivered to:** if only one project needs it and the warehouse has none, it goes **straight to that site**; otherwise into the warehouse, to be sent on from there.
- **Supplier:** the cheapest recent one, at what they charged last time (see *Price history* in [[Purchasing and Stock]]).

**Buy all** puts everything that's short on **one** purchase, with the supplier that makes the whole purchase cheapest.

### Ready to send

Material the warehouse already has, grouped **by site** (like one truck per site). **Send** opens the movement form filled in for that site. The warehouse only offers what it can send without taking stock another site is counting on:

- **Covered** items — every site's full need.
- **Partial** items that **only one** site needs — all the warehouse has (the rest is bought).

### Shared items → Split

A **partial** item that **several** sites need is "shared": there isn't enough for everyone, and who gets what is a person's call. These get their own rows with a **Split** button. The split window shows:

- what's in the warehouse, what the sites need, and what's left after the split;
- one row per site with a quantity box and a **Fill** button (gives that site what's left, up to its need);
- **Share by need** — a fair first guess: the warehouse stock shared in proportion to each site's need, in whole units (leftover units go to the biggest fractions);
- **Clear** — start from zero.

A site can't get more than it needs, and the total can't be more than the warehouse has. **Send split** books one `Issue` per site **together** through the batch endpoint — all of them or none. Whatever is still short stays on the list to buy.

### Recently sent

Sends from the last **7 days**, as proof that it went. Each row can be **viewed** or **undone**, and anything you just sent is highlighted.
