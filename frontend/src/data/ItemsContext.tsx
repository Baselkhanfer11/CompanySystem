import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { itemsApi } from '../api/items';
import type { Item } from '../types';

interface ItemsValue {
  items: Item[];
  loading: boolean; // true only during the first load (for skeletons)
  error: string;
  refresh: () => Promise<void>; // silent background refetch (no skeleton flash)
}

const ItemsContext = createContext<ItemsValue | null>(null);

/**
 * Owns the single copy of the store items that the Store page and the
 * notifications bell both read from — so they share ONE /api/items request
 * instead of each fetching their own. Any mutation calls refresh() to update
 * both places (and the bell badge) at once.
 */
export function ItemsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setItems(await itemsApi.getAll());
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

  const value = useMemo<ItemsValue>(() => ({ items, loading, error, refresh }), [items, loading, error, refresh]);

  return <ItemsContext.Provider value={value}>{children}</ItemsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useItems() {
  const ctx = useContext(ItemsContext);
  if (!ctx) throw new Error('useItems must be used inside <ItemsProvider>');
  return ctx;
}
