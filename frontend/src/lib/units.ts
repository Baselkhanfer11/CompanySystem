// Common units of measure for store items. Extend as needed.
export const UNITS = ['pcs', 'box', 'pack', 'dozen', 'kg', 'g', 'L', 'ml', 'm', 'cm'];

// Currency formatter for unit prices: cents, plus up to 2 more decimals when a
// price has them (small parts can cost $0.075 each).
const unitUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 });
export const formatPrice = (value?: number) => (value === undefined ? '—' : unitUsd.format(value));
