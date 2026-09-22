// Single source of truth for what counts as "low" / "out of" stock.
// Used by the Store page badges and the notifications bell.
export const LOW_STOCK = 10;

export const isOutOfStock = (quantity: number) => quantity <= 0;
export const isLowStock = (quantity: number) => quantity > 0 && quantity <= LOW_STOCK;
