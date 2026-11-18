import type { PaymentInput, SaleDetail, SaleInput, SaleListItem } from '../types';
import { api } from './http';

const BASE = '/api/sales';

export const salesApi = {
  getAll: () => api.get<SaleListItem[]>(BASE),
  getById: (id: number) => api.get<SaleDetail>(`${BASE}/${id}`),
  create: (data: SaleInput) => api.post<SaleDetail>(BASE, data),
  update: (id: number, data: SaleInput) => api.put<SaleDetail>(`${BASE}/${id}`, data),
  // The life cycle: the material leaves the warehouse on delivery, comes back on undo.
  deliver: (id: number) => api.post<SaleDetail>(`${BASE}/${id}/deliver`, undefined),
  undoDelivery: (id: number) => api.post<SaleDetail>(`${BASE}/${id}/undo-delivery`, undefined),
  cancel: (id: number) => api.post<SaleDetail>(`${BASE}/${id}/cancel`, undefined),
  addPayment: (id: number, data: PaymentInput) => api.post<SaleDetail>(`${BASE}/${id}/payments`, data),
  removePayment: (id: number, paymentId: number) => api.del<void>(`${BASE}/${id}/payments/${paymentId}`),
};
