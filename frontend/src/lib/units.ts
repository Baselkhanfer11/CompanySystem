// Common units of measure for store items. Extend as needed.
export const UNITS = ['pcs', 'box', 'pack', 'dozen', 'kg', 'g', 'L', 'ml', 'm', 'cm'];

// Currency formatter for prices.
export const formatPrice = (value?: number) =>
  value === undefined ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
