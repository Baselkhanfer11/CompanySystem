import type { Customer, CustomerInput } from '../types';
import { api } from './http';

const BASE = '/api/customers';

export const customersApi = {
  getAll: () => api.get<Customer[]>(BASE),
  create: (data: CustomerInput) => api.post<Customer>(BASE, data),
  update: (id: number, data: CustomerInput) => api.put<void>(`${BASE}/${id}`, data),
  remove: (id: number) => api.del<void>(`${BASE}/${id}`),
};
