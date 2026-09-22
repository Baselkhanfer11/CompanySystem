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
