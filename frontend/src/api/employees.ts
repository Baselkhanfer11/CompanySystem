import type { Employee, EmployeeInput } from '../types';

// All requests go to /api/... which Vite proxies to the .NET backend (see vite.config.ts).
const BASE = '/api/employees';

// Small helper that throws a readable error if the response isn't OK.
async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed (${res.status})`);
  }
  // 204 No Content has no body.
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const employeesApi = {
  getAll: () => fetch(BASE).then(handle<Employee[]>),

  create: (data: EmployeeInput) =>
    fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handle<Employee>),

  update: (id: number, data: EmployeeInput) =>
    fetch(`${BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, id }),
    }).then(handle<void>),

  remove: (id: number) =>
    fetch(`${BASE}/${id}`, { method: 'DELETE' }).then(handle<void>),
};
