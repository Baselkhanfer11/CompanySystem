// Supplier statuses. Must match the backend's SupplierStatuses.
// The label is looked up via t(`supplier.status.${status}`).
export const SUPPLIER_STATUSES = ['Active', 'Inactive'] as const;

export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

// Which .badge modifier class to use for each status (see index.css).
export const SUPPLIER_STATUS_BADGE: Record<string, string> = {
  Active: 'active',
  Inactive: 'inactive',
};
