import type { Project, ProjectInput } from '../types';
import { api } from './http';

const BASE = '/api/projects';

export const projectsApi = {
  getAll: () => api.get<Project[]>(BASE),
  create: (data: ProjectInput) => api.post<Project>(BASE, data),
  update: (id: number, data: ProjectInput) => api.put<void>(`${BASE}/${id}`, data),
  remove: (id: number) => api.del<void>(`${BASE}/${id}`),
};
