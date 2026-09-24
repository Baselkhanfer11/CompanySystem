import type { ProjectPlan, Shortage } from '../types';
import { api } from './http';

export const plansApi = {
  get: (projectId: number) => api.get<ProjectPlan>(`/api/projects/${projectId}/plan`),
  // Replaces the whole plan; a line with 0 (or left out) is removed.
  save: (projectId: number, lines: { itemId: number; planned: number }[]) =>
    api.put<ProjectPlan>(`/api/projects/${projectId}/plan`, lines),
  // What every open project still needs, and what has to be bought.
  shortages: () => api.get<Shortage[]>('/api/plans/shortages'),
};
