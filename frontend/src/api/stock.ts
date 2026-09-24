import type { SiteStock, StockMovementDetail, StockMovementInput, StockMovementListItem } from '../types';
import { api } from './http';

const BASE = '/api/stock';

export const stockApi = {
  // What's on each site right now (or on one site).
  onSite: (projectId?: number) => api.get<SiteStock[]>(`${BASE}/on-site${projectId ? `?projectId=${projectId}` : ''}`),
  movements: () => api.get<StockMovementListItem[]>(`${BASE}/movements`),
  getMovement: (id: number) => api.get<StockMovementDetail>(`${BASE}/movements/${id}`),
  createMovement: (data: StockMovementInput) => api.post<StockMovementDetail>(`${BASE}/movements`, data),
  // Several at once (e.g. one item split between sites): all are booked, or none.
  createMovements: (data: StockMovementInput[]) => api.post<StockMovementDetail[]>(`${BASE}/movements/batch`, data),
  removeMovement: (id: number) => api.del<void>(`${BASE}/movements/${id}`),
};
