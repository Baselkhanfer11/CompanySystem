import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * A tiny shared request cache ("stale-while-revalidate").
 *
 *  - Each key (e.g. 'projects') is fetched ONCE and shared by every component
 *    that asks for it — even if several ask at the same moment.
 *  - Coming back to a page shows the cached data instantly; it's only fetched
 *    again if it's older than `maxAge` (30 s by default).
 *  - After a change, call invalidate('projects') and everyone showing projects
 *    re-fetches right away (anything not on screen re-fetches when it's next shown).
 *  - clearCache() on login/logout, so one user never sees another user's data.
 */

export interface CacheState<T> {
  data: T | undefined;
  error: string;
  loading: boolean; // a request is in flight
}

interface Entry {
  state: CacheState<unknown>;
  loadedAt: number; // 0 = never loaded, or invalidated
  inFlight: Promise<void> | null;
  fetcher: (() => Promise<unknown>) | null;
  listeners: Set<() => void>;
}

const DEFAULT_MAX_AGE = 30_000;
const entries = new Map<string, Entry>();
let generation = 0; // bumped by clearCache(), so late answers for the previous user are dropped

function entryFor(key: string): Entry {
  let e = entries.get(key);
  if (!e) {
    e = { state: { data: undefined, error: '', loading: false }, loadedAt: 0, inFlight: null, fetcher: null, listeners: new Set() };
    entries.set(key, e);
  }
  return e;
}

function update(e: Entry, patch: Partial<CacheState<unknown>>) {
  e.state = { ...e.state, ...patch }; // a new object, so React sees the change
  e.listeners.forEach((notify) => notify());
}

/** Fetches `key` unless it's fresh (younger than maxAge) or already on its way. */
export function fetchCached<T>(key: string, fetcher: () => Promise<T>, maxAge = DEFAULT_MAX_AGE): Promise<void> {
  const e = entryFor(key);
  e.fetcher = fetcher;
  if (e.inFlight) return e.inFlight;
  if (e.loadedAt && Date.now() - e.loadedAt < maxAge) return Promise.resolve();

  const gen = generation;
  update(e, { loading: true });
  const request = fetcher()
    .then((data) => {
      if (gen !== generation) return;
      e.loadedAt = Date.now();
      update(e, { data, error: '', loading: false });
    })
    .catch((err: Error) => {
      if (gen !== generation) return;
      update(e, { error: err.message, loading: false }); // keep the last good data
    })
    .finally(() => { if (e.inFlight === request) e.inFlight = null; });
  e.inFlight = request;
  return request;
}

/** Re-fetches `key` now (waits for a request already on its way, then asks again). */
export async function refreshCached(key: string): Promise<void> {
  const e = entries.get(key);
  if (!e?.fetcher) return; // never loaded — it'll load when first shown
  if (e.inFlight) await e.inFlight;
  e.loadedAt = 0;
  await fetchCached(key, e.fetcher, 0);
}

/** Marks keys as out of date: re-fetched now if on screen, otherwise when next shown. */
export function invalidate(...keys: string[]) {
  for (const key of keys) {
    const e = entries.get(key);
    if (!e) continue;
    e.loadedAt = 0;
    if (e.listeners.size > 0) void refreshCached(key);
  }
}

/** Forgets everything (login / logout). */
export function clearCache() {
  generation++;
  for (const e of entries.values()) {
    e.loadedAt = 0;
    e.inFlight = null;
    update(e, { data: undefined, error: '', loading: false });
  }
}

/**
 * Reads `key` from the cache, fetching it when needed.
 * `loading` is only true on the very first load (for skeletons); later
 * re-fetches happen quietly behind the data already on screen.
 */
export function useCached<T>(key: string, fetcher: () => Promise<T>, maxAge = DEFAULT_MAX_AGE) {
  const e = entryFor(key);
  const subscribe = useCallback((notify: () => void) => {
    const entry = entryFor(key);
    entry.listeners.add(notify);
    return () => { entry.listeners.delete(notify); };
  }, [key]);
  const state = useSyncExternalStore(subscribe, () => e.state) as CacheState<T>;

  useEffect(() => { void fetchCached(key, fetcher, maxAge); }, [key, fetcher, maxAge]);
  const refresh = useCallback(() => refreshCached(key), [key]);

  return {
    data: state.data,
    error: state.error,
    loading: state.data === undefined && !state.error, // nothing to show yet
    refresh,
  };
}
