// Mirrors the backend Roles class. Add new roles here when the backend gains them.
export const ROLES = {
  Administrator: 'Administrator',
  WarehouseManager: 'WarehouseManager',
  Employee: 'Employee',
} as const;

// Human-friendly labels (raw values have no spaces).
export const ROLE_LABELS: Record<string, string> = {
  Administrator: 'Administrator',
  WarehouseManager: 'Warehouse Manager',
  Employee: 'Employee',
};

// Roles allowed to create/edit/delete data.
export const MANAGER_ROLES: string[] = [ROLES.Administrator, ROLES.WarehouseManager];

export const roleLabel = (role?: string) => (role ? ROLE_LABELS[role] ?? role : '');
export const canManage = (role?: string) => !!role && MANAGER_ROLES.includes(role);
export const isAdmin = (role?: string) => role === ROLES.Administrator;
