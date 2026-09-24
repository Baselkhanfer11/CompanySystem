// Shared formatting helpers.

/** Format an ISO date string as e.g. "22 Sep 2026". */
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

/** Format a money amount with grouped thousands and 2 decimals, e.g. "1,250.00". */
export const formatMoney = (n: number) =>
  (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Exact local date + time, e.g. "22 Sep 2026, 07:46 PM" — used for tooltips. */
export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

/**
 * Short relative time, e.g. "just now", "5m", "3h", "2d". Falls back to the
 * date for anything older than a week. `t` translates the small unit words.
 */
export const formatTimeAgo = (iso: string, t: (key: string, vars?: Record<string, string | number>) => string) => {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 45) return t('time.now');
  const mins = Math.round(secs / 60);
  if (mins < 60) return t('time.m', { n: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t('time.h', { n: hours });
  const days = Math.round(hours / 24);
  if (days < 7) return t('time.d', { n: days });
  return formatDate(iso);
};
