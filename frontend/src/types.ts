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

// A bell notification. Named AppNotification to avoid clashing with the DOM's
// global `Notification`.
export interface AppNotification {
  id: number;
  type: string; // NeedsReview | Approved | Returned | Rejected
  title: string;
  documentId?: number | null;
  note?: string | null;
  isRead: boolean;
  createdAt: string;
}

// A document (uploaded Excel file) moving through the approval pipeline.
// Named ApprovalDocument to avoid clashing with the DOM's global `Document`.
export interface ApprovalDocument {
  id: number;
  title: string;
  projectId: number;
  projectName: string;
  fileName: string;
  fileSize: number;
  status: string; // one of DOC_STATUSES
  uploadedById: number;
  uploadedByName: string;
  createdAt: string;
  updatedAt: string;
}

// One entry in a document's history (the trace/timeline).
export interface DocumentEvent {
  id: number;
  action: string; // Submitted | Approved | Returned | Resubmitted
  actorName: string;
  note?: string | null;
  createdAt: string;
}

// A document plus its full history.
export interface DocumentDetail {
  document: ApprovalDocument;
  events: DocumentEvent[];
}

// A supplier / vendor the company buys from.
export interface Supplier {
  id: number;
  name: string;
  code: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  status: string; // one of SUPPLIER_STATUSES
  createdAt: string;
}

export interface SupplierInput {
  name: string;
  code: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  status: string;
}

// A purchase (supplier invoice) as shown in the list — summary only.
export interface PurchaseListItem {
  id: number;
  supplierId: number;
  supplierName: string;
  projectId?: number | null;
  projectName?: string | null;
  invoiceNumber?: string | null;
  date: string;
  lineCount: number;
  total: number;
  createdByName: string;
  createdAt: string;
}

// One line on a purchase, expanded with item details.
export interface PurchaseLine {
  id: number;
  itemId: number;
  itemName: string;
  itemCode: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

// A full purchase with all its lines.
export interface PurchaseDetail {
  id: number;
  supplierId: number;
  supplierName: string;
  projectId?: number | null;
  projectName?: string | null;
  invoiceNumber?: string | null;
  date: string;
  notes?: string | null;
  createdByName: string;
  createdAt: string;
  total: number;
  items: PurchaseLine[];
}

// What we send to create a purchase.
export interface PurchaseLineInput {
  itemId: number;
  quantity: number;
  unitPrice: number;
}
export interface PurchaseInput {
  supplierId: number;
  projectId?: number | null;
  invoiceNumber?: string | null;
  date: string;
  notes?: string | null;
  items: PurchaseLineInput[];
}

// ---- Cost reports ----

// Spend for one project, or the General bucket (projectId = null).
export interface ProjectCostRow {
  projectId: number | null;
  name: string;
  code?: string | null;
  status?: string | null;
  total: number;
  purchaseCount: number;
  lastPurchaseDate?: string | null;
}

export interface MonthlySpend {
  year: number;
  month: number; // 1-12
  total: number;
}

export interface ProjectCostsReport {
  totalSpend: number;
  projectSpend: number;
  generalSpend: number;
  purchaseCount: number;
  projects: ProjectCostRow[];
  general: ProjectCostRow;
  monthly: MonthlySpend[];
}

export interface SupplierSpend {
  supplierId: number;
  name: string;
  total: number;
  purchaseCount: number;
}

export interface ItemSpend {
  itemId: number;
  name: string;
  code: string;
  unit: string;
  quantity: number;
  total: number;
}

export interface ProjectCostDetail {
  projectId: number | null;
  name: string;
  code?: string | null;
  status?: string | null;
  total: number;
  purchaseCount: number;
  bySupplier: SupplierSpend[];
  byItem: ItemSpend[];
  monthly: MonthlySpend[];
  recent: PurchaseListItem[];
}
