import type { PriceHistoryLine, SupplierPrice } from '../types';
import { api } from './http';

const BASE = '/api/prices';

export const pricesApi = {
  // One row per (item, supplier) we've ever bought — last / cheapest / average price.
  getAll: () => api.get<SupplierPrice[]>(BASE),
  // Every purchase of one item, newest first.
  itemHistory: (itemId: number) => api.get<PriceHistoryLine[]>(`${BASE}/items/${itemId}`),
};
