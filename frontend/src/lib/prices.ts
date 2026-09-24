import type { SupplierPrice } from '../types';

// "Recent" = bought within the last 6 months. An old low price doesn't beat
// what suppliers charge today, so only recent prices can be "the cheapest".
const RECENT_MS = 183 * 24 * 60 * 60 * 1000;
export const isRecent = (p: SupplierPrice, now = Date.now()) => now - new Date(p.lastDate).getTime() <= RECENT_MS;

/** The price rows grouped by item, for quick lookups. */
export type PriceIndex = Map<number, SupplierPrice[]>;
export function indexPrices(prices: SupplierPrice[]): PriceIndex {
  const idx: PriceIndex = new Map();
  for (const p of prices) idx.set(p.itemId, [...(idx.get(p.itemId) ?? []), p]);
  return idx;
}

/** What we paid this supplier for this item last time (null = never bought it from them). */
export const lastFrom = (idx: PriceIndex, itemId: number, supplierId: number) =>
  idx.get(itemId)?.find((p) => p.supplierId === supplierId) ?? null;

/**
 * The cheapest supplier for an item right now: active, bought from recently,
 * lowest last price (a tie goes to the more recent purchase).
 */
export function bestRecent(idx: PriceIndex, itemId: number): SupplierPrice | null {
  let best: SupplierPrice | null = null;
  for (const p of idx.get(itemId) ?? []) {
    if (!p.supplierActive || !isRecent(p)) continue;
    if (!best || p.lastPrice < best.lastPrice || (p.lastPrice === best.lastPrice && p.lastDate > best.lastDate)) best = p;
  }
  return best;
}

/**
 * One supplier for a purchase of several items: the one that makes the whole
 * purchase cheapest. Each candidate is priced at what they charged recently,
 * and at the item's list price for anything we've never bought from them.
 * Candidates = active suppliers we've bought any of these items from recently.
 */
export function suggestSupplier(
  idx: PriceIndex,
  lines: { itemId: number; quantity: number; listPrice: number }[],
): number | null {
  const candidates = new Set<number>();
  for (const l of lines) for (const p of idx.get(l.itemId) ?? []) if (p.supplierActive && isRecent(p)) candidates.add(p.supplierId);

  let pick: number | null = null;
  let lowest = Infinity;
  for (const supplierId of candidates) {
    const total = lines.reduce((sum, l) => {
      const last = lastFrom(idx, l.itemId, supplierId);
      return sum + l.quantity * (last && isRecent(last) ? last.lastPrice : l.listPrice);
    }, 0);
    if (total < lowest) { lowest = total; pick = supplierId; }
  }
  return pick;
}

/** How much `price` differs from `before`, in whole percent (+ = dearer). */
export const pctChange = (price: number, before: number) => (before > 0 ? Math.round(((price - before) / before) * 100) : 0);
