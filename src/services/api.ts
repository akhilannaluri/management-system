import { 
  AdminUser, 
  Flat, 
  MaintenanceRecord, 
  MaintenanceSummary, 
  ExpenseTemplate, 
  MonthlyExpense, 
  Task, 
  ApartmentSettings,
  MonthlyReportData 
} from '../types';

const TOKEN_STORAGE_KEY = 'apartment_admin_token';

export const getStoredToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (_) {
    return null;
  }
};

export const setStoredToken = (token: string | null) => {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (_) {}
};

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'x-admin-token': token } : {})
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    },
    credentials: 'include'
  });

  const data = await response.json();

  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'An error occurred during request');
  }

  return data;
}

// ---------------- AUTH API ----------------
export const apiAuth = {
  checkSession: () => fetchJSON<{ success: boolean; isAuthenticated: boolean; user: AdminUser | null }>('/api/auth/me'),
  login: async (credentials: { username: string; password: string }) => {
    const res = await fetchJSON<{ success: boolean; message: string; user: AdminUser; token?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    if (res.token) {
      setStoredToken(res.token);
    }
    return res;
  },
  logout: async () => {
    try {
      return await fetchJSON<{ success: boolean; message: string }>('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
    }
  },
  updateProfile: (profileData: any) => 
    fetchJSON<{ success: boolean; message: string; user: AdminUser }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    })
};

// ---------------- FLATS API ----------------
export const apiFlats = {
  getAll: (params?: { block?: string; search?: string; occupancy?: string; residentType?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJSON<{ success: boolean; count: number; flats: Flat[] }>(`/api/flats${query ? `?${query}` : ''}`);
  },
  getById: (id: string) => fetchJSON<{ success: boolean; flat: Flat }>(`/api/flats/${id}`),
  create: (flatData: Partial<Flat>) => 
    fetchJSON<{ success: boolean; message: string; flat: Flat }>('/api/flats', {
      method: 'POST',
      body: JSON.stringify(flatData)
    }),
  update: (id: string, flatData: Partial<Flat>) => 
    fetchJSON<{ success: boolean; message: string; flat: Flat }>(`/api/flats/${id}`, {
      method: 'PUT',
      body: JSON.stringify(flatData)
    }),
  delete: (id: string) => fetchJSON<{ success: boolean; message: string }>(`/api/flats/${id}`, { method: 'DELETE' }),
  bulkImport: (flats: Array<{ flatNumber: string; residentName: string; customMaintenanceAmount?: number | null; status?: string }>, mode: 'upsert' | 'replace_all' = 'replace_all') =>
    fetchJSON<{ success: boolean; message: string; importedCount: number; totalFlats: number }>('/api/flats/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ flats, mode })
    })
};

// ---------------- MAINTENANCE API ----------------
export const apiMaintenance = {
  getMonthRecords: (month: string, params?: { status?: string; search?: string; block?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJSON<{
      success: boolean;
      month: string;
      summary: MaintenanceSummary;
      count: number;
      records: MaintenanceRecord[];
    }>(`/api/maintenance/month/${month}${query ? `?${query}` : ''}`);
  },
  updatePaymentStatus: (id: string, payload: {
    status: 'Paid' | 'Pending';
    amount?: number;
    paymentMode?: string;
    paidDate?: string;
    receiptNumber?: string;
    remarks?: string;
  }) => 
    fetchJSON<{ success: boolean; message: string; record: MaintenanceRecord }>(`/api/maintenance/record/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),
  batchUpdate: (payload: { recordIds: string[]; status: 'Paid' | 'Pending'; paymentMode?: string; remarks?: string }) =>
    fetchJSON<{ success: boolean; message: string }>('/api/maintenance/batch-update', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  batchSave: (updates: Array<{ id: string; status: 'Paid' | 'Pending' }>) =>
    fetchJSON<{ success: boolean; message: string; updatedCount: number }>('/api/maintenance/batch-save', {
      method: 'POST',
      body: JSON.stringify({ updates })
    })
};

// ---------------- EXPENSES API ----------------
export const apiExpenses = {
  // Templates
  getTemplates: () => fetchJSON<{ success: boolean; count: number; templates: ExpenseTemplate[] }>('/api/expenses/templates'),
  createTemplate: (data: Partial<ExpenseTemplate>) => 
    fetchJSON<{ success: boolean; message: string; template: ExpenseTemplate }>('/api/expenses/templates', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateTemplate: (id: string, data: Partial<ExpenseTemplate>) => 
    fetchJSON<{ success: boolean; message: string; template: ExpenseTemplate }>(`/api/expenses/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteTemplate: (id: string) => fetchJSON<{ success: boolean; message: string }>(`/api/expenses/templates/${id}`, { method: 'DELETE' }),

  // Monthly Expenses
  getMonthExpenses: (month: string) => 
    fetchJSON<{
      success: boolean;
      month: string;
      summary: {
        totalExpenses: number;
        totalRecurring: number;
        totalOneTime: number;
        count: number;
        recurringCount: number;
        oneTimeCount: number;
      };
      recurringExpenses: MonthlyExpense[];
      oneTimeExpenses: MonthlyExpense[];
      allExpenses: MonthlyExpense[];
    }>(`/api/expenses/month/${month}`),
  createMonthlyExpense: (data: Partial<MonthlyExpense>) => 
    fetchJSON<{ success: boolean; message: string; expense: MonthlyExpense }>('/api/expenses/month', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateMonthlyExpense: (id: string, data: Partial<MonthlyExpense>) => 
    fetchJSON<{ success: boolean; message: string; expense: MonthlyExpense }>(`/api/expenses/record/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteMonthlyExpense: (id: string) => 
    fetchJSON<{ success: boolean; message: string }>(`/api/expenses/record/${id}`, { method: 'DELETE' })
};

// ---------------- TASKS API ----------------
export const apiTasks = {
  getAll: (params?: { status?: string; priority?: string; search?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJSON<{
      success: boolean;
      summary: {
        total: number;
        pendingCount: number;
        inProgressCount: number;
        completedCount: number;
        totalEstimatedCost: number;
      };
      count: number;
      tasks: Task[];
    }>(`/api/tasks${query ? `?${query}` : ''}`);
  },
  getById: (id: string) => fetchJSON<{ success: boolean; task: Task }>(`/api/tasks/${id}`),
  create: (data: Partial<Task>) => 
    fetchJSON<{ success: boolean; message: string; task: Task }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<Task>) => 
    fetchJSON<{ success: boolean; message: string; task: Task }>(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  delete: (id: string) => fetchJSON<{ success: boolean; message: string }>(`/api/tasks/${id}`, { method: 'DELETE' })
};

// ---------------- REPORTS API ----------------
export const apiReports = {
  getMonthReport: (month: string) => 
    fetchJSON<MonthlyReportData>(`/api/reports/month/${month}`),
  getAnnualOverview: (year?: string) => 
    fetchJSON<{ success: boolean; year: string; monthlyStats: any[] }>(`/api/reports/annual/${year || new Date().getFullYear()}`)
};

// ---------------- SETTINGS API ----------------
export const apiSettings = {
  get: () => fetchJSON<{ success: boolean; settings: ApartmentSettings; dbType: string }>('/api/settings'),
  update: (data: Partial<ApartmentSettings>) => 
    fetchJSON<{ success: boolean; message: string; settings: ApartmentSettings }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data)
    })
};

// ---------------- EXCEL EXPORT URL HELPER ----------------
export const getExportUrl = (month: string) => `/api/export/month/${month}`;
