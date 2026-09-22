// The project life-cycle statuses. Must match the backend's ProjectStatuses.
// The label is looked up via t(`project.status.${status}`).
export const PROJECT_STATUSES = ['Active', 'OnHold', 'Completed'] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// Which .badge modifier class to use for each status (see index.css).
export const STATUS_BADGE_CLASS: Record<string, string> = {
  Active: 'active',
  OnHold: 'onhold',
  Completed: 'done',
};
