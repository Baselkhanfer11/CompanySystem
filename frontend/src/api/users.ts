import type { CreateUserInput, UpdateUserInput, User } from '../types';
import { api } from './http';

const BASE = '/api/users';

export const usersApi = {
  getAll: () => api.get<User[]>(BASE),
  create: (data: CreateUserInput) => api.post<User>(BASE, data),
  update: (id: number, data: UpdateUserInput) => api.put<void>(`${BASE}/${id}`, data),
  remove: (id: number) => api.del<void>(`${BASE}/${id}`),
};
