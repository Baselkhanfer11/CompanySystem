// Shared formatting helpers.

/** Format an ISO date string as e.g. "22 Sep 2026". */
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
