// Mirrors the backend Roles class. Add new roles here when the backend gains them.
export const ROLES = {
  Administrator: 'Administrator',
  WarehouseManager: 'WarehouseManager',
  Employee: 'Employee',
} as const;

// Human-friendly role labels now live in the i18n dictionary (role.* keys),
// so components translate them with t(`role.${role}`) instead of a static map.

// Roles allowed to create/edit/delete data.
export const MANAGER_ROLES: string[] = [ROLES.Administrator, ROLES.WarehouseManager];

export const canManage = (role?: string) => !!role && MANAGER_ROLES.includes(role);
export const isAdmin = (role?: string) => role === ROLES.Administrator;
