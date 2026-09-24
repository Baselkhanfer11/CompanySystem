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
  lastEditedByName?: string | null;
  lastEditedAt?: string | null;
  history: PurchaseEvent[]; // oldest first
}

// One change inside an edit. `kind` says which fields are filled in.
export interface PurchaseChange {
  kind: 'Field' | 'LineAdded' | 'LineRemoved' | 'LineChanged';
  field?: 'supplier' | 'project' | 'date' | 'invoiceNumber' | 'notes';
  from?: string | null;
  to?: string | null;
  item?: string;
  unit?: string;
  fromQty?: number;
  toQty?: number;
  fromPrice?: number;
  toPrice?: number;
}

// One entry in a purchase's edit history.
export interface PurchaseEvent {
  id: number;
  action: string; // Edited
  actorName: string;
  createdAt: string;
  changes: PurchaseChange[];
}

// What we send to create or edit a purchase. When editing, `id` marks an
// existing line; leave it out for a new line.
export interface PurchaseLineInput {
  id?: number | null;
  itemId: number;
  quantity: number;
  unitPrice: number;
}
// A new purchase that starts pre-filled (e.g. from the to-buy list).
export interface PurchaseDraft {
  projectId: number | null; // where it's delivered (null = warehouse)
  supplierId?: number | null; // suggested from the price history (the cheapest recent one)
  lines: { itemId: number; quantity: number; unitPrice: number }[];
}

// ---- Supplier price history ----

// What we've paid one supplier for one item (built from past purchases).
export interface SupplierPrice {
  itemId: number;
  supplierId: number;
  supplierName: string;
  supplierCode: string;
  supplierActive: boolean;
  lastPrice: number; // on the most recent purchase
  lastDate: string;
  minPrice: number;
  avgPrice: number; // per unit, weighted by quantity
  timesBought: number;
  totalQuantity: number;
}

// One past purchase of an item.
export interface PriceHistoryLine {
  purchaseId: number;
  date: string;
  supplierId: number;
  supplierName: string;
  invoiceNumber: string | null;
  deliveredTo: string | null; // project name, or null = the warehouse
  quantity: number;
  unitPrice: number;
}

// A new "send to site" movement that starts pre-filled (from the to-buy list).
export interface MovementDraft {
  projectId: number;
  lines: { itemId: number; quantity: number }[];
}

export interface PurchaseInput {
  supplierId: number;
  projectId?: number | null;
  invoiceNumber?: string | null;
  date: string;
  notes?: string | null;
  items: PurchaseLineInput[];
}

// ---- Stock by location ----

// Warehouse stock is Item.quantity; this is what's on one site.
export interface SiteStock {
  projectId: number;
  projectName: string;
  projectCode: string;
  itemId: number;
  itemName: string;
  itemCode: string;
  unit: string;
  quantity: number;
  value: number; // what this material cost the project
}

export type MovementType = 'Issue' | 'Return'; // warehouse → site | site → warehouse

export interface StockMovementListItem {
  id: number;
  type: MovementType;
  projectId: number;
  projectName: string;
  projectCode: string;
  date: string;
  notes?: string | null;
  lineCount: number;
  itemNames: string[];
  total: number;
  createdByName: string;
  createdAt: string;
}

export interface StockMovementLine {
  id: number;
  itemId: number;
  itemName: string;
  itemCode: string;
  unit: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

export interface StockMovementDetail {
  id: number;
  type: MovementType;
  projectId: number;
  projectName: string;
  projectCode: string;
  date: string;
  notes?: string | null;
  createdByName: string;
  createdAt: string;
  total: number;
  lines: StockMovementLine[];
}

export interface StockMovementInput {
  type: MovementType;
  projectId: number;
  date: string;
  notes?: string | null;
  items: { itemId: number; quantity: number }[];
}

// ---- Cost reports ----
// A project's cost = delivered straight to its site + sent from the warehouse − returns.

// One project, or the Warehouse bucket (projectId = null) = purchases delivered to the warehouse.
export interface ProjectCostRow {
  projectId: number | null;
  name: string;
  code?: string | null;
  status?: string | null;
  total: number;
  delivered: number;
  fromWarehouse: number;
  purchaseCount: number;
  movementCount: number;
}

export interface MonthlySpend {
  year: number;
  month: number; // 1-12
  total: number;
}

export interface ProjectCostsReport {
  projectCost: number;
  purchaseTotal: number;
  warehousePurchases: number;
  sentFromWarehouse: number;
  purchaseCount: number;
  movementCount: number;
  projects: ProjectCostRow[];
  warehouse: ProjectCostRow;
  monthly: MonthlySpend[];
}

// Where the money came from: a supplier, or the warehouse (supplierId = null).
export interface CostSource {
  supplierId: number | null;
  name: string;
  total: number;
  count: number;
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
  movementCount: number;
  bySource: CostSource[];
  byItem: ItemSpend[];
  monthly: MonthlySpend[];
  recentPurchases: PurchaseListItem[];
  recentMovements: StockMovementListItem[];
}

// ---- Material plans ----

// One item on a project's plan: planned vs. what's already on the site.
export interface PlanLine {
  itemId: number;
  name: string;
  code: string;
  unit: string;
  price: number;
  planned: number;
  onSite: number;
  stillNeeded: number;
  stillToSpend: number; // still needed × price
  inPlan: boolean; // false = on the site but not planned
}

export interface ProjectPlan {
  projectId: number;
  name: string;
  code: string;
  status: string;
  lines: PlanLine[];
  estimatedBudget: number;
  spentSoFar: number;
  stillToSpend: number;
  progress: number; // 0-100
  updatedByName?: string | null;
  updatedAt?: string | null;
}

// One item across every open project: needed vs. warehouse → what to buy.
export interface Shortage {
  itemId: number;
  name: string;
  code: string;
  unit: string;
  price: number;
  needed: number;
  inWarehouse: number;
  toBuy: number;
  estimatedCost: number;
  projects: { projectId: number; projectName: string; stillNeeded: number }[];
}

// ---- Home dashboard ----

export interface ProjectProgress {
  id: number;
  name: string;
  code: string;
  status: string;
  hasPlan: boolean;
  progress: number; // 0-100
  stillToSpend: number;
  itemsOnSite: number;
}

// A recent purchase or stock movement.
export interface Activity {
  kind: 'Purchase' | 'Issue' | 'Return';
  id: number;
  actorName: string;
  supplierName?: string | null;
  projectName?: string | null; // null on a purchase = delivered to the warehouse
  items: string[];
  total: number;
  createdAt: string;
}

export interface Dashboard {
  employees: number;
  activeEmployees: number;
  recentEmployees: { id: number; fullName: string; position?: string | null; email?: string | null }[];
  activeProjects: number;
  costThisMonth?: number | null; // null when you can't see costs
  costLastMonth?: number | null;
  projects: ProjectProgress[];
  activity: Activity[];
}
