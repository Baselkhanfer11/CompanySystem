import type { ApprovalDocument } from '../types';
import { api } from './http';

const BASE = '/api/documents';

export const documentsApi = {
  getAll: () => api.get<ApprovalDocument[]>(BASE),
  // form must contain: title, projectId, file
  upload: (form: FormData) => api.postForm<ApprovalDocument>(BASE, form),
  download: (id: number, fileName: string) => api.download(`${BASE}/${id}/file`, fileName),

  // Pipeline actions
  approve: (id: number) => api.post<void>(`${BASE}/${id}/approve`, {}),
  returnToEngineer: (id: number, note: string) => api.post<void>(`${BASE}/${id}/return`, { note }),
  reject: (id: number) => api.post<void>(`${BASE}/${id}/reject`, {}),
  // form must contain: file
  resubmit: (id: number, form: FormData) => api.postForm<void>(`${BASE}/${id}/resubmit`, form),
};
