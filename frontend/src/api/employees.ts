import type { Employee, EmployeeInput } from '../types';
import { api } from './http';

const BASE = '/api/employees';

export const employeesApi = {
  getAll: () => api.get<Employee[]>(BASE),
  create: (data: EmployeeInput) => api.post<Employee>(BASE, data),
  update: (id: number, data: EmployeeInput) => api.put<void>(`${BASE}/${id}`, { ...data, id }),
  remove: (id: number) => api.del<void>(`${BASE}/${id}`),
};
