export interface AdminUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
}

export interface Flat {
  _id: string;
  id?: string;
  flatNumber: string;
  residentName: string;
  customMaintenanceAmount?: number | null;
  status?: 'Active' | 'Inactive';
  block?: string;
  floor?: number;
  residentType?: 'Owner' | 'Tenant';
  phone?: string;
  email?: string;
  occupancyStatus?: 'Occupied' | 'Vacant';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MaintenanceRecord {
  _id: string;
  id?: string;
  month: string; // YYYY-MM
  flatId: string | Partial<Flat>;
  flatNumber: string;
  residentName: string;
  amount: number;
  status: 'Paid' | 'Pending';
  paidDate?: string | null;
  paymentMode?: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Other' | '';
  receiptNumber?: string;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MaintenanceSummary {
  totalFlats: number;
  expectedMaintenance: number;
  totalCollected: number;
  totalPending: number;
  paidCount: number;
  pendingCount: number;
  collectionPercentage: number;
}

export interface ExpenseTemplate {
  _id: string;
  id?: string;
  name: string;
  defaultAmount: number;
  category: string;
  description?: string;
  isActive: boolean;
  orderIndex?: number;
}

export interface MonthlyExpense {
  _id: string;
  id?: string;
  month: string;
  expenseType: 'Recurring' | 'One-Time';
  templateId?: string | null;
  name: string;
  amount: number;
  category: string;
  paymentDate?: string | null;
  paidTo?: string;
  paymentMode?: string;
  invoiceOrReceiptNo?: string;
  notes?: string;
  isPaid?: boolean;
  createdAt?: string;
}

export interface Task {
  _id: string;
  id?: string;
  title: string;
  estimatedAmount: number;
  actualAmount?: number;
  description: string;
  dueDate: string;
  month?: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  assignedTo?: string;
  contactNumber?: string;
  completionDate?: string | null;
  notes?: string;
  createdAt?: string;
}

export interface ApartmentSettings {
  _id?: string;
  apartmentName: string;
  societyRegistrationNo?: string;
  address: string;
  totalFlats: number;
  defaultMonthlyMaintenance: number;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  upiId?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  currencySymbol: string;
}

export interface MonthlyReportData {
  month: string;
  monthDisplay?: string;
  settings: ApartmentSettings;
  financialSummary: {
    totalFlats: number;
    expectedMaintenance: number;
    collectedMaintenance: number;
    pendingMaintenance: number;
    collectionRate: number;
    paidFlatsCount: number;
    pendingFlatsCount: number;
    recurringExpensesTotal: number;
    oneTimeExpensesTotal: number;
    totalExpenses: number;
    remainingBalance: number;
  };
  expensesBreakdown: {
    byCategory: Record<string, number>;
    recurring: MonthlyExpense[];
    oneTime: MonthlyExpense[];
  };
  expenses?: MonthlyExpense[];
  paidFlats: MaintenanceRecord[];
  pendingFlats: MaintenanceRecord[];
  allMaintenanceRecords?: MaintenanceRecord[];
  cumulativeSummary?: {
    cutoffMonth: string;
    cutoffMonthDisplay: string;
    monthsIncluded: string[];
    totalCollected: number;
    totalExpenses: number;
    cumulativeSavings: number;
  };
  tasks: Task[];
}
