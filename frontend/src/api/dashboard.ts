import type { Dashboard } from '../types';
import { api } from './http';

export const dashboardApi = {
  get: () => api.get<Dashboard>('/api/dashboard'),
};
