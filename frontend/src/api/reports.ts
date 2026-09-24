import type { ProjectCostDetail, ProjectCostsReport } from '../types';
import { api } from './http';

const BASE = '/api/reports/project-costs';

// A period as yyyy-mm-dd strings; either end may be omitted (open-ended).
export interface DateRange {
  from?: string;
  to?: string;
}

const query = ({ from, to }: DateRange) => {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

// The id the API uses for the "General" bucket (purchases with no project).
export const GENERAL_ID = 0;

export const reportsApi = {
  projectCosts: (range: DateRange) => api.get<ProjectCostsReport>(`${BASE}${query(range)}`),
  projectCostDetail: (projectId: number | null, range: DateRange) =>
    api.get<ProjectCostDetail>(`${BASE}/${projectId ?? GENERAL_ID}${query(range)}`),
};
