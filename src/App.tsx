import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ApartmentProvider } from './context/ApartmentContext';

import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { Toast } from './components/common/Toast';

import { LoginView } from './components/views/LoginView';
import { DashboardView } from './components/views/DashboardView';
import { FlatsView } from './components/views/FlatsView';
import { MaintenanceView } from './components/views/MaintenanceView';
import { ExpensesView } from './components/views/ExpensesView';
import { ReportsView } from './components/views/ReportsView';
import { SettingsView } from './components/views/SettingsView';

import { Building2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  if (isLoading) {
    return (
      <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center bg-light">
        <div className="bg-primary text-white p-3 rounded-4 shadow-sm mb-3 animate-pulse">
          <Building2 size={36} />
        </div>
        <div className="spinner-border text-primary mb-2" role="status" style={{ width: '2.5rem', height: '2.5rem' }}>
          <span className="visually-hidden">Loading...</span>
        </div>
        <div className="fw-semibold text-dark">Apartment Management</div>
        <small className="text-muted">Loading...</small>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginView />
        <Toast />
      </>
    );
  }

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView setActiveView={setActiveView} />;
      case 'flats':
        return <FlatsView />;
      case 'maintenance':
        return <MaintenanceView />;
      case 'expenses':
        return <ExpensesView />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView setActiveView={setActiveView} />;
    }
  };

  return (
    <div className="min-vh-100 d-flex flex-column bg-light" style={{ backgroundColor: '#f8fafc' }}>
      
      {/* Top Navigation Bar */}
      <Navbar
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Main Layout Area */}
      <div className="d-flex flex-grow-1 position-relative">
        
        {/* Left Fixed Sidebar */}
        <Sidebar
          activeView={activeView}
          setActiveView={setActiveView}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
        />

        {/* Dynamic Viewport Content */}
        <main className="flex-grow-1 overflow-x-hidden" style={{ minWidth: 0 }}>
          {renderActiveView()}
        </main>

      </div>

      {/* Global Toast Notifications */}
      <Toast />

    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ApartmentProvider>
        <AppContent />
      </ApartmentProvider>
    </AuthProvider>
  );
}
