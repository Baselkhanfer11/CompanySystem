// Customer statuses. Must match the backend's CustomerStatuses.
// The label is looked up via t(`customer.status.${status}`).
export const CUSTOMER_STATUSES = ['Active', 'Inactive'] as const;

export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

// Which .badge modifier class to use for each status (see index.css).
export const CUSTOMER_STATUS_BADGE: Record<string, string> = {
  Active: 'active',
  Inactive: 'inactive',
};
