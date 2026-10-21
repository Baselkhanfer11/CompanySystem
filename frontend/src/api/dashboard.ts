import { localDate } from '../lib/format';
import type { Dashboard } from '../types';
import { api } from './http';

export const dashboardApi = {
  // "This month" is the viewer's month, not the server's (UTC) one.
  get: () => api.get<Dashboard>(`/api/dashboard?today=${localDate()}`),
};
