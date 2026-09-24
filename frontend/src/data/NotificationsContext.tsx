import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { notificationsApi } from '../api/notifications';
import type { AppNotification } from '../types';

interface NotificationsValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

// How often to quietly re-check for new notifications (e.g. another user
// approved your document while you were on a page).
const POLL_MS = 20_000;

/**
 * Owns the current user's bell notifications. Fetches once on mount, then polls
 * quietly so alerts from other users show up without a manual refresh.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // One request at a time: coming back to the tab fires both 'focus' and
  // 'visibilitychange', and they share the same request instead of sending two.
  const inFlight = useRef<Promise<void> | null>(null);
  const refresh = useCallback(() => {
    inFlight.current ??= notificationsApi.getMine()
      .then(setNotifications)
      .catch(() => { /* keep the last good list on a transient error */ })
      .finally(() => { inFlight.current = null; });
    return inFlight.current;
  }, []);

  const markAllRead = useCallback(async () => {
    // Optimistically clear the badge, then tell the server.
    setNotifications((list) => list.map((n) => (n.isRead ? n : { ...n, isRead: true })));
    try { await notificationsApi.markAllRead(); } catch { /* will re-sync on next poll */ }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      await refresh();
      if (active) setLoading(false);
    })();

    // Poll quietly, and also re-check whenever the user comes back to the tab
    // or refocuses the window — so alerts feel live without a manual refresh.
    // Skip the poll while the tab is hidden — nobody can see the bell, and we
    // catch up the moment the tab is shown again (below).
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
    const onFocus = () => refresh();
    const onVisible = () => { if (!document.hidden) refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  const value = useMemo<NotificationsValue>(
    () => ({ notifications, unreadCount, loading, refresh, markAllRead }),
    [notifications, unreadCount, loading, refresh, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return ctx;
}
