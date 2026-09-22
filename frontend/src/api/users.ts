import type { User } from '../types';
import { api } from './http';

const BASE = '/api/users';

// The Users page is now a read-only overview + revoke.
// Creating/editing logins happens on the Employees page ("Grant access").
export const usersApi = {
  getAll: () => api.get<User[]>(BASE),
  remove: (id: number) => api.del<void>(`${BASE}/${id}`),
};
