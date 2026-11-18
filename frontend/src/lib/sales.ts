import type { SaleListItem } from '../types';

// Sale and payment statuses. Must match the backend's SaleStatuses / PaymentStatuses.
// Labels are looked up via t(`sale.status.${status}`) and t(`sale.payment.${status}`).

// Which .badge modifier class to use for each sale status (see index.css).
export const SALE_STATUS_BADGE: Record<string, string> = {
  Ordered: 'onhold',
  Delivered: 'active',
  Cancelled: 'reject',
};

export const PAYMENT_STATUS_BADGE: Record<string, string> = {
  Unpaid: 'reject',
  PartlyPaid: 'onhold',
  Paid: 'active',
};

/**
 * Does the customer owe money on this sale? Only once it's delivered — an order
 * that hasn't left the warehouse isn't a debt yet — and only while something is
 * left to pay. (Works without the money figures too, for people who can't see
 * them: the payment status says the same.)
 */
export const isOwing = (s: SaleListItem) => s.status === 'Delivered' && s.paymentStatus !== 'Paid';

/** What's left to pay on a sale (undefined when the money is hidden). */
export const owedOn = (s: SaleListItem) =>
  s.total === undefined ? undefined : Math.max(0, s.total - (s.paid ?? 0));

export interface Debtor {
  customerId: number;
  customerName: string;
  sales: number;
  owed?: number; // undefined when the money is hidden
  oldest: string; // date of the oldest unpaid delivered sale
}

/** Who owes money and how much, biggest debt first (oldest first when the money is hidden). */
export function debtors(sales: SaleListItem[]): Debtor[] {
  const byCustomer = new Map<number, Debtor>();
  for (const s of sales) {
    if (!isOwing(s)) continue;
    const d = byCustomer.get(s.customerId) ?? { customerId: s.customerId, customerName: s.customerName, sales: 0, owed: 0, oldest: s.date };
    d.sales += 1;
    const owed = owedOn(s);
    d.owed = owed === undefined || d.owed === undefined ? undefined : d.owed + owed;
    if (s.date < d.oldest) d.oldest = s.date;
    byCustomer.set(s.customerId, d);
  }
  return [...byCustomer.values()].sort((a, b) =>
    a.owed !== undefined && b.owed !== undefined ? b.owed - a.owed : a.oldest.localeCompare(b.oldest),
  );
}
