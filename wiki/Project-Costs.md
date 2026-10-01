# Project Costs

What has each project cost? This is **financial data**, so only managers (Administrator and Warehouse Manager) can see it — the API enforces that, not just the menu.

## How a project's cost is worked out

Every cost comes from records that already exist — nothing is typed in twice:

```
project cost =   purchases delivered straight to its site   (price paid)
               + material sent to it from the warehouse      (Issue, item price at the time)
               − material returned from it                   (Return, average cost on the site)
```

Material bought **into the warehouse** isn't a project's cost yet — it becomes one when it's sent to a site. So the report shows the **Warehouse** as its own bucket, set apart (grayed out) and **not** part of the project shares.

Because each movement line stores its cost when it's recorded, later price changes never rewrite past costs.

## The Costs page

- **Period** — this month, the last 3 months, this year, or all time. (The API takes any `from` / `to`, whole days, both inclusive.)
- **Projects, most expensive first** — every project is listed, even at zero, with how many purchases and movements make up its cost. The warehouse bar uses the same scale so it's comparable.
- **Monthly trend** — cost per calendar month; empty months show as zero, so the chart never silently skips one.

Click a project (or the warehouse) to **drill down**:

- **Where the money came from** — each supplier, plus "sent from the warehouse".
- **Top items** — the items that cost the most, net of returns.
- **Latest activity** — its most recent purchases and movements.

## On the dashboard

Managers also see **this month's project costs** on the home dashboard, compared with last month (up / down in %). For everyone else that tile is hidden and the API doesn't send the number at all.
