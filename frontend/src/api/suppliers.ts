import type { Supplier, SupplierInput } from '../types';
import { api } from './http';

const BASE = '/api/suppliers';

export const suppliersApi = {
  getAll: () => api.get<Supplier[]>(BASE),
  create: (data: SupplierInput) => api.post<Supplier>(BASE, data),
  update: (id: number, data: SupplierInput) => api.put<void>(`${BASE}/${id}`, data),
  remove: (id: number) => api.del<void>(`${BASE}/${id}`),
};
