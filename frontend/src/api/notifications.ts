import type { AppNotification } from '../types';
import { api } from './http';

const BASE = '/api/notifications';

export const notificationsApi = {
  getMine: () => api.get<AppNotification[]>(BASE),
  markAllRead: () => api.post<void>(`${BASE}/read`, {}),
};
