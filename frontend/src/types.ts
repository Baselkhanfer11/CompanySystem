// Mirrors the C# Employee model from the backend.
export interface Employee {
  id: number;
  fullName: string;
  email?: string | null;
  position?: string | null;
  hireDate: string; // ISO date string
  isActive: boolean;
}

// The shape we send when creating/updating (no server-generated id).
export interface EmployeeInput {
  fullName: string;
  email?: string | null;
  position?: string | null;
  isActive: boolean;
}

// A login account (mirrors the backend UserDto — never includes the password).
export interface User {
  id: number;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

// What /api/auth/login returns.
export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: User;
}

// Admin create/update user payloads.
export interface CreateUserInput {
  username: string;
  fullName: string;
  password: string;
  role: string;
  isActive: boolean;
}
export interface UpdateUserInput {
  fullName: string;
  role: string;
  isActive: boolean;
  newPassword?: string | null;
}
