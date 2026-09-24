import type { PurchaseDetail, PurchaseInput, PurchaseListItem } from '../types';
import { api } from './http';

const BASE = '/api/purchases';

export const purchasesApi = {
  getAll: () => api.get<PurchaseListItem[]>(BASE),
  getById: (id: number) => api.get<PurchaseDetail>(`${BASE}/${id}`),
  create: (data: PurchaseInput) => api.post<PurchaseDetail>(BASE, data),
  remove: (id: number) => api.del<void>(`${BASE}/${id}`),
};
