import type { Employee, EmployeeInput, GrantAccessInput, UpdateAccessInput } from '../types';
import { api } from './http';

const BASE = '/api/employees';

export const employeesApi = {
  getAll: () => api.get<Employee[]>(BASE),
  create: (data: EmployeeInput) => api.post<Employee>(BASE, data),
  update: (id: number, data: EmployeeInput) => api.put<void>(`${BASE}/${id}`, data),
  remove: (id: number) => api.del<void>(`${BASE}/${id}`),

  // Login access management (admin only).
  grantAccess: (employeeId: number, data: GrantAccessInput) =>
    api.post<void>(`${BASE}/${employeeId}/access`, data),
  updateAccess: (employeeId: number, data: UpdateAccessInput) =>
    api.put<void>(`${BASE}/${employeeId}/access`, data),
  revokeAccess: (employeeId: number) =>
    api.del<void>(`${BASE}/${employeeId}/access`),
};
