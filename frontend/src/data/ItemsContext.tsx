import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { itemsApi } from '../api/items';
import { plansApi } from '../api/plans';
import type { Item, Shortage } from '../types';

interface ItemsValue {
  items: Item[];
  shortages: Shortage[]; // what open projects still need vs. the warehouse
  loading: boolean; // true only during the first load (for skeletons)
  error: string;
  refresh: () => Promise<void>; // silent background refetch (no skeleton flash)
}

const ItemsContext = createContext<ItemsValue | null>(null);

/**
 * Owns the single copy of the store items (and the material shortages built
 * on them) that the Store page and the notifications bell both read from — so
 * they share ONE request instead of each fetching their own. Any stock or plan
 * change calls refresh() to update every place (and the bell badge) at once.
 */
export function ItemsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [nextItems, nextShortages] = await Promise.all([itemsApi.getAll(), plansApi.shortages()]);
      setItems(nextItems);
      setShortages(nextShortages);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Fetch once when the authenticated area mounts.
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      await refresh();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [refresh]);

  const value = useMemo<ItemsValue>(() => ({ items, shortages, loading, error, refresh }), [items, shortages, loading, error, refresh]);

  return <ItemsContext.Provider value={value}>{children}</ItemsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useItems() {
  const ctx = useContext(ItemsContext);
  if (!ctx) throw new Error('useItems must be used inside <ItemsProvider>');
  return ctx;
}
