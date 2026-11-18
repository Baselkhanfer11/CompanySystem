# Sales

The selling side of the warehouse: **who** the company sells to, **what** was ordered, **when** it left the warehouse, and **how much** of it has been paid. It mirrors [[Purchasing and Stock]] — a sale is to a customer what a purchase is to a supplier — with one difference: a sale has a life cycle.

## Customers

Who the company sells to: name, unique code, contact details, notes, and a status (`Active` / `Inactive`). An inactive customer keeps their sales history but isn't offered for new sales. A customer that has sales **can't be deleted** — set them to Inactive instead.

## The life of a sale

```
            deliver                 (payments, any time after the order)
  Ordered ───────────▶ Delivered
     │  ◀───────────────┘ undo delivery (only while nothing is paid)
     │ cancel (only while nothing is paid)
     ▼
  Cancelled
```

| State | What it means | Stock |
|-------|---------------|-------|
| `Ordered` | The order is recorded: customer, date, optional reference, lines with a quantity and a **selling price** each. | Nothing has moved. The warehouse count is unchanged. |
| `Delivered` | The material has left the warehouse, all at once. | Each line's quantity is taken out of the warehouse. |
| `Cancelled` | The order was called off before delivery. | Nothing ever moved. |

**Recording an order never moves stock.** An order may even ask for more than the warehouse has — it's a promise, not a move — and the form says so under the line (*"Only 30 bag in the warehouse"*) so nobody promises blindly.

**Delivering takes the stock, or refuses.** `POST /api/sales/{id}/deliver` goes through the same stock lock as every other stock change (`StockService.BeginChange`, see [[Purchasing and Stock]]). If the warehouse doesn't have every line in full, the API answers `409 Conflict` with the reason and **nothing changes**. Two people delivering the last units at the same moment can't both succeed.

**Undoing a delivery** puts every line back in the warehouse and makes the sale an order again. It's only allowed while **no payment** has been recorded — once money is involved, the record must stand. Remove the payments first if the delivery really was a mistake.

**Cancelling** is for orders only (a delivered sale is undone, not cancelled), and also only while nothing has been paid. A cancelled sale stays in the list, greyed out, so the record of what was asked for is never lost. Nothing is ever hard-deleted.

**Editing** (customer, date, reference, notes, lines) is only possible while the sale is an order. Every edit is written to the history, like a purchase edit.

## Prices

The selling price is **typed per line** when the order is recorded. Picking an item pre-fills its current price from the Store, but the person can change it on every sale — there is no separate "selling price" field on items. The total is the sum of the lines.

## Payments

A sale is paid with **one or more payments**, each with a date, an amount and an optional note (cash, cheque number, bank reference). A payment can be recorded as soon as the order exists — a deposit — and at any time after delivery.

- A payment can't take the total paid **above the sale's total**.
- Three figures are always shown: **total**, **paid**, **remaining**.
- The **payment status** is never stored; it's worked out from those figures: `Unpaid`, `PartlyPaid`, `Paid`.
- A payment recorded by mistake can be removed (and that is written to the history too).

## The audit trail

Every step is a `SaleEvent` with who did it and when, shown as a timeline on the sale:

| Action | Written when |
|--------|--------------|
| `Edited` | the order was changed — with the list of changes (fields from → to, lines added, removed, changed) |
| `Delivered` | the material left the warehouse |
| `DeliveryUndone` | it came back |
| `Cancelled` | the order was called off |
| `PaymentAdded` / `PaymentRemoved` | money came in, or a payment was taken back — with the amount |

## Who may do what

The same split as purchases: anyone signed in can **see** sales and customers; managers and the Procurement Officer can **record, edit, deliver, undo, cancel** and **take payments**. Selling prices, totals and payment amounts are money, and are left out of the API's answers for the Employee role (`[SellingPrice]` in `Json/MoneyVisibility.cs`) — an Employee sees the order, its quantities and whether it's paid, but no figures.

## Who owes money

A customer **owes** on a sale once it's **delivered** and not fully paid. An order that hasn't left the warehouse isn't a debt yet, and a cancelled one never is.

- **Dashboard → Owed by customers**: the total still owed, and by how many customers on how many sales. Clicking the tile opens the Owing view. (Shown to the people who see selling prices.)
- **Sales → Owing**: a summary of **who owes how much** (biggest debt first, with the date of their oldest unpaid sale), then those sales, **oldest first**. The address is `/sales?show=owing`, so it can be bookmarked.
- In the normal list, every delivered sale that isn't fully paid shows what's **owed** under its total.

All of this is worked out in the browser from the sales list (total − paid); nothing extra is stored.

## Where it shows up

- **Dashboard → Recent activity** lists new orders next to purchases and movements.
- The **Store** page's warehouse counts drop on delivery, like a send to a site.
- **Export to Excel** on both the Customers and the Sales page.
