import type { AuthResponse, User } from '../types';
import { api } from './http';

export const authApi = {
  login: (username: string, password: string) =>
    api.post<AuthResponse>('/api/auth/login', { username, password }),
  me: () => api.get<User>('/api/auth/me'),
};
