// Single source of truth for what counts as "low" / "out of" stock.
// Used by the Store page badges and the notifications bell.
export const LOW_STOCK = 10;

export const isOutOfStock = (quantity: number) => quantity <= 0;
export const isLowStock = (quantity: number) => quantity > 0 && quantity <= LOW_STOCK;

/** "SM-00012": the number printed on a movement's paper record, so a copy can be traced back. */
export const movementNumber = (id: number) => `SM-${String(id).padStart(5, '0')}`;

/** Where the print buttons point. `print=1` opens the print dialog once the page is drawn. */
export const movementPrintUrl = (id: number) => `/movements/${id}/print?print=1`;
