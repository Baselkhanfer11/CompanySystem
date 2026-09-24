import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { itemsApi } from '../api/items';
import { plansApi } from '../api/plans';
import { fetchCached, useCached } from '../lib/cache';
import type { Item, Shortage } from '../types';
import { KEYS } from './queries';

interface ItemsValue {
  items: Item[];
  shortages: Shortage[]; // what open projects still need vs. the warehouse
  loading: boolean; // true only during the first load (for skeletons)
  error: string;
  refresh: () => Promise<void>; // re-fetch now (after a change)
  revalidate: () => void; // re-fetch only if the copy is getting old (on a page visit)
}

const ItemsContext = createContext<ItemsValue | null>(null);

// Items and shortages always change together, so they're one cache entry.
const fetchStock = async () => {
  const [items, shortages] = await Promise.all([itemsApi.getAll(), plansApi.shortages()]);
  return { items, shortages };
};
const EMPTY = { items: [] as Item[], shortages: [] as Shortage[] };

/**
 * Owns the single copy of the store items (and the material shortages built
 * on them) that the Store page, the dashboard and the notifications bell all
 * read from — ONE request shared by all of them (see lib/cache.ts).
 */
export function ItemsProvider({ children }: { children: ReactNode }) {
  const { data, loading, error, refresh } = useCached(KEYS.stock, fetchStock);
  const revalidate = useCallback(() => { void fetchCached(KEYS.stock, fetchStock); }, []);

  const value = useMemo<ItemsValue>(() => ({
    items: (data ?? EMPTY).items,
    shortages: (data ?? EMPTY).shortages,
    loading,
    error,
    refresh,
    revalidate,
  }), [data, loading, error, refresh, revalidate]);

  return <ItemsContext.Provider value={value}>{children}</ItemsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useItems() {
  const ctx = useContext(ItemsContext);
  if (!ctx) throw new Error('useItems must be used inside <ItemsProvider>');
  return ctx;
}
