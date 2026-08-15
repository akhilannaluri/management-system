import React, { createContext, useContext, useState, useEffect } from 'react';
import { ApartmentSettings } from '../types';
import { apiSettings, getStoredToken } from '../services/api';

interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'danger' | 'warning' | 'info';
}

interface ApartmentContextType {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  formatMonthDisplay: (month: string) => string;
  availableMonths: { value: string; label: string }[];
  settings: ApartmentSettings;
  updateSettings: (newSettings: Partial<ApartmentSettings>) => Promise<void>;
  refreshTrigger: number;
  triggerRefresh: () => void;
  toast: ToastState;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
  hideToast: () => void;
  downloadExcel: (month?: string) => void;
}

const ApartmentContext = createContext<ApartmentContextType | undefined>(undefined);

export const ApartmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const now = new Date();
  const defaultCurrentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [selectedMonth, setSelectedMonth] = useState<string>(defaultCurrentMonth);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [settings, setSettings] = useState<ApartmentSettings>({
    apartmentName: 'Greenview Heights Apartments',
    societyRegistrationNo: 'REG/HYD/2021/57',
    address: 'Plot 42-45, Phase 2, Madhapur, Hyderabad, 500081',
    totalFlats: 57,
    defaultMonthlyMaintenance: 1500,
    contactPerson: 'Ramesh Varma (Secretary)',
    contactPhone: '+91 98765 43210',
    contactEmail: 'admin@greenviewheights.com',
    upiId: 'greenview.society@upi',
    bankName: 'HDFC Bank',
    accountNumber: '50200012345678',
    ifscCode: 'HDFC0001234',
    currencySymbol: '₹'
  });

  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: '',
    type: 'info'
  });

  const showToast = (message: string, type: 'success' | 'danger' | 'warning' | 'info' = 'success') => {
    setToast({ show: true, message, type });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  // Generate 24 months (18 past months + current + 5 future months)
  const availableMonths = React.useMemo(() => {
    const list: { value: string; label: string }[] = [];
    const date = new Date();
    // Start from 5 months in future down to 18 months in past
    for (let i = 5; i >= -18; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() + i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const lbl = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      list.push({ value: val, label: lbl });
    }
    return list;
  }, []);

  const formatMonthDisplay = (monthStr: string) => {
    if (!monthStr || !monthStr.includes('-')) return monthStr;
    const [year, month] = monthStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  const loadSettings = async () => {
    try {
      const res = await apiSettings.get();
      if (res.settings) {
        setSettings(res.settings);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleUpdateSettings = async (newSettings: Partial<ApartmentSettings>) => {
    const res = await apiSettings.update(newSettings);
    if (res.settings) {
      setSettings(res.settings);
      showToast('Apartment settings updated successfully', 'success');
      triggerRefresh();
    }
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const downloadExcel = async (monthToExport?: string) => {
    const m = monthToExport || selectedMonth;
    try {
      showToast(`Preparing Excel report for ${formatMonthDisplay(m)}...`, 'info');
      const token = getStoredToken();
      const response = await fetch(`/api/export/month/${m}`, {
        headers: {
          ...(token ? { 'x-admin-token': token } : {})
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to download report (HTTP ${response.status})`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      
      const contentDisposition = response.headers.get('content-disposition');
      let filename = '';
      if (contentDisposition && contentDisposition.includes('filename=')) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (matches && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }
      
      if (!filename) {
        const [year, monthNum] = m.split('-');
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = monthNames[parseInt(monthNum, 10) - 1] || m;
        filename = `Apartment_Maintenance_Report_${monthName}_${year}.xlsx`;
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      showToast(`Downloaded Excel report for ${formatMonthDisplay(m)}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error exporting Excel report', 'danger');
    }
  };

  return (
    <ApartmentContext.Provider
      value={{
        selectedMonth,
        setSelectedMonth,
        formatMonthDisplay,
        availableMonths,
        settings,
        updateSettings: handleUpdateSettings,
        refreshTrigger,
        triggerRefresh,
        toast,
        showToast,
        hideToast,
        downloadExcel
      }}
    >
      {children}
    </ApartmentContext.Provider>
  );
};

export const useApartment = (): ApartmentContextType => {
  const context = useContext(ApartmentContext);
  if (!context) {
    throw new Error('useApartment must be used within an ApartmentProvider');
  }
  return context;
};
