import type { AuthResponse, User } from '../types';
import { api } from './http';

export const authApi = {
  login: (username: string, password: string) =>
    api.post<AuthResponse>('/api/auth/login', { username, password }),
  me: () => api.get<User>('/api/auth/me'),
  // Replies with a fresh sign-in: every token made under the old password stops working.
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put<AuthResponse>('/api/auth/password', { currentPassword, newPassword }),
};
