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
