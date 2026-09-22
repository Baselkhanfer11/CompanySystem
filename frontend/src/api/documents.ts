import type { ApprovalDocument } from '../types';
import { api } from './http';

const BASE = '/api/documents';

export const documentsApi = {
  getAll: () => api.get<ApprovalDocument[]>(BASE),
  // form must contain: title, projectId, file
  upload: (form: FormData) => api.postForm<ApprovalDocument>(BASE, form),
  download: (id: number, fileName: string) => api.download(`${BASE}/${id}/file`, fileName),
};
