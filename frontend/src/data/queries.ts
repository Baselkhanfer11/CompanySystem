import { dashboardApi } from '../api/dashboard';
import { documentsApi } from '../api/documents';
import { employeesApi } from '../api/employees';
import { pricesApi } from '../api/prices';
import { projectsApi } from '../api/projects';
import { purchasesApi } from '../api/purchases';
import { stockApi } from '../api/stock';
import { suppliersApi } from '../api/suppliers';
import { usersApi } from '../api/users';
import { invalidate, useCached } from '../lib/cache';

// Every shared list, by cache key. Pages read them through the hooks below, so
// the same list is only downloaded once however many pages show it.
export const KEYS = {
  projects: 'projects',
  suppliers: 'suppliers',
  siteStock: 'siteStock',
  purchases: 'purchases',
  movements: 'movements',
  employees: 'employees',
  users: 'users',
  documents: 'documents',
  dashboard: 'dashboard',
  stock: 'stock', // store items + shortages (see ItemsContext)
  prices: 'prices', // what each supplier charged for each item
} as const;

// The fetchers live at module level so their identity never changes.
const onSiteAll = () => stockApi.onSite();

export const useProjects = () => useCached(KEYS.projects, projectsApi.getAll);
export const useSuppliers = () => useCached(KEYS.suppliers, suppliersApi.getAll);
export const useSiteStock = () => useCached(KEYS.siteStock, onSiteAll);
export const usePurchases = () => useCached(KEYS.purchases, purchasesApi.getAll);
export const useMovements = () => useCached(KEYS.movements, stockApi.movements);
export const useEmployees = () => useCached(KEYS.employees, employeesApi.getAll);
export const useUsers = () => useCached(KEYS.users, usersApi.getAll);
export const useDocuments = () => useCached(KEYS.documents, documentsApi.getAll);
export const usePrices = () => useCached(KEYS.prices, pricesApi.getAll);
// The dashboard mixes everything, so it re-checks on every visit (maxAge 0) —
// but still shows the last copy instantly while it does.
export const useDashboard = () => useCached(KEYS.dashboard, dashboardApi.get, 0);

// "No data yet" — one shared empty array, so it never looks like a change to React.
export const NONE: never[] = [];

// ---- what to refresh after a change ----
// (The dashboard re-checks on every visit anyway, so it's never listed here.)

/** A purchase was recorded, edited or deleted: it moves stock too. */
export const purchasesChanged = () => invalidate(KEYS.purchases, KEYS.stock, KEYS.siteStock, KEYS.prices);
/** A stock movement was recorded or undone. */
export const movementsChanged = () => invalidate(KEYS.movements, KEYS.stock, KEYS.siteStock);
/** A store item was added, edited or deleted (its name/price shows in many lists). */
export const itemsChanged = () => invalidate(KEYS.stock, KEYS.siteStock, KEYS.purchases, KEYS.movements, KEYS.prices);
/** A project was added, edited or deleted (its name/status shows almost everywhere). */
export const projectsChanged = () =>
  invalidate(KEYS.projects, KEYS.stock, KEYS.siteStock, KEYS.purchases, KEYS.movements, KEYS.documents);
/** A supplier was added, edited or deleted. */
export const suppliersChanged = () => invalidate(KEYS.suppliers, KEYS.purchases, KEYS.prices);
/** An employee or their login changed (the Users page lists the same people). */
export const peopleChanged = () => invalidate(KEYS.employees, KEYS.users);
/** A document moved through the approval pipeline. */
export const documentsChanged = () => invalidate(KEYS.documents);
