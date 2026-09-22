import type { Item, ItemInput } from '../types';
import { api } from './http';

const BASE = '/api/items';

export const itemsApi = {
  getAll: () => api.get<Item[]>(BASE),
  create: (data: ItemInput) => api.post<Item>(BASE, data),
  update: (id: number, data: ItemInput) => api.put<void>(`${BASE}/${id}`, data),
  remove: (id: number) => api.del<void>(`${BASE}/${id}`),
};
