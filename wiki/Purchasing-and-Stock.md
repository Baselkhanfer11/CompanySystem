# Purchasing and Stock

This is the heart of the system: **buying** material, knowing **where it is**, and **moving** it between the warehouse and the sites — with every step recorded and costed.

## Where stock can be

There are two kinds of place:

| Place | How its stock is known |
|-------|------------------------|
| **The warehouse** | Stored on the item: `Item.Quantity` |
| **A project's site** | **Worked out**, never stored: purchases delivered to the site + material sent to it − material returned from it |

Because site stock is calculated from the records, it can never drift out of step with the history. The **Store** page shows each item's warehouse quantity, and its **Locations** window shows how much is out on each site.

```
                 Purchase (to warehouse)
  Supplier  ────────────────────────────▶  Warehouse
     │                                      │    ▲
     │ Purchase (straight to a site)  Issue │    │ Return
     │                                      ▼    │
     └────────────────────────────────▶  Project site
```

### The one rule: stock never goes below zero

All stock changes go through **`StockService.Apply`**. It adds up every change, then checks every place that would **lose** stock. If **any** of them would drop below zero, **nothing** changes and the API answers `409 Conflict` with a readable reason (e.g. *"Can't send — not enough stock. Cement: needs 50 bag from the warehouse, but only 30 bag there."*).

## Suppliers

Who the company buys from: name, unique code, contact details, notes, and a status (`Active` / `Inactive`). Inactive suppliers stay in the history but aren't suggested for new purchases. A supplier that has purchases **can't be deleted** — the cost history must stay intact.

## Purchases

A purchase is **one supplier invoice**: a header (supplier, date, invoice number, notes, **delivered to**) and one or more lines (item, quantity, unit price actually paid).

**Delivered to** decides where the material lands:

- **The warehouse** — adds to the items' warehouse stock. It's charged to a project later, when it's sent there.
- **A project's site** — goes straight onto that site and is charged to that project immediately.

### Editing a purchase

Mistakes happen, so a purchase can be edited (supplier, site, date, lines…). The stock moves by the **difference**: the old lines leave the old place and the new lines arrive at the new one. If that would take stock that has **already been sent or used**, the edit is refused with a `409`.

Every edit writes a **history entry** (`PurchaseEvent`) listing exactly what changed — fields from → to, lines added, removed or changed. Names are snapshots, so the history still reads correctly if an item or supplier is renamed later. The purchase window shows who recorded it, who last edited it, and the full change list.

### Deleting a purchase

Deleting takes the material back out of wherever it was delivered — and is **blocked** if some of it has already moved on.

## Price history

Every purchase line is a price the company actually paid. The **Prices** API turns them into:

- **Per item:** every purchase of it, newest first (the item's price-history window).
- **Per supplier:** what we've bought from them and what they charged last time (the supplier's price list).

From this the app works out **who's cheapest right now**:

- Only **recent** prices count (bought within the last **6 months**) — an old low price doesn't beat what suppliers charge today.
- Only **active** suppliers are suggested.
- The cheapest = lowest last price; a tie goes to the more recent purchase.

When you record a new purchase, each line shows what this supplier charged last time, whether the price went up or down (in %), and who's cheaper right now. Picking an item pre-fills the price they charged last time (or the item's list price). For a purchase of **several** items, the suggested supplier is the one that makes the **whole** purchase cheapest.

## Stock movements

A movement moves material between the warehouse and **one** site:

| Type | Direction | Effect on the project's cost |
|------|-----------|------------------------------|
| `Issue` | warehouse → site ("send") | **Charged** at the item's price today |
| `Return` | site → warehouse | **Credited** at the item's **average cost on that site** |

Using the site's average cost for returns means that returning **everything** takes exactly its cost back off the project — no rounding leftovers. That cost is saved on each line (`UnitCost`) when the movement is recorded, so later price changes never rewrite the past.

The movement form only offers what makes sense: sending can use any item (checked against the warehouse), returning only lists what's on that site. The same item on two lines is checked as one total.

### Undoing a movement

Deleting a movement does the exact opposite of what it did. It's **blocked** if the material has moved on since (e.g. it was sent and then already returned).

### Several movements at once

`POST /api/stock/movements/batch` books up to **50** movements **together**: all of their changes are added up and checked as one, then saved with one `SaveChanges`. Either every movement is booked or none is. This is what the [[Material Plans and To Buy]] page uses to **split** an item between sites.
