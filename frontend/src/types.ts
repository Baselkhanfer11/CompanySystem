// The login access an employee has, if any.
export interface EmployeeAccess {
  userId: number;
  username: string;
  role: string;
  isActive: boolean;
}

// Mirrors the C# EmployeeDto from the backend.
export interface Employee {
  id: number;
  fullName: string;
  email?: string | null;
  position?: string | null;
  hireDate: string; // ISO date string
  isActive: boolean;
  access?: EmployeeAccess | null;
}

// The shape we send when creating/updating an employee's core fields.
export interface EmployeeInput {
  fullName: string;
  email?: string | null;
  position?: string | null;
  isActive: boolean;
}

// Grant / update a login for an employee.
export interface GrantAccessInput {
  username: string;
  password: string;
  role: string;
  isActive: boolean;
}
export interface UpdateAccessInput {
  role: string;
  isActive: boolean;
  newPassword?: string | null;
}

// A login account (mirrors the backend UserDto — never includes the password).
export interface User {
  id: number;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  employeeId?: number | null;
}

// What /api/auth/login returns.
export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: User;
}

// A store / warehouse stock item.
export interface Item {
  id: number;
  name: string;
  code: string;
  quantity: number;
  unit: string;
  price: number;
  imageUrl?: string | null;
  createdAt: string;
}

export interface ItemInput {
  name: string;
  code: string;
  quantity: number;
  unit: string;
  price: number;
}

// A project / site the company works on.
export interface Project {
  id: number;
  name: string;
  code: string;
  status: string; // one of PROJECT_STATUSES
  description?: string | null;
  createdAt: string;
}

export interface ProjectInput {
  name: string;
  code: string;
  status: string;
  description?: string | null;
}
