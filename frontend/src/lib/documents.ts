// The approval-pipeline statuses. Must match the backend's DocumentStatuses.
// The label is looked up via t(`doc.status.${status}`).
export const DOC_STATUSES = ['PendingManager', 'PendingCEO', 'Approved', 'Returned'] as const;

// Which .badge modifier class to use for each status (see index.css).
export const DOC_STATUS_BADGE: Record<string, string> = {
  PendingManager: 'onhold',
  PendingCEO: 'onhold',
  Approved: 'active',
  Returned: 'reject',
};

// Human-readable file size, e.g. 2048 → "2 KB".
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[i]}`;
}
