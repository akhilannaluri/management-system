import React from 'react';
import { 
  LayoutDashboard, 
  Wallet, 
  Receipt, 
  FileBarChart, 
  Building2,
  Settings,
  X
} from 'lucide-react';
import { useApartment } from '../../context/ApartmentContext';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  sidebarOpen,
  onCloseSidebar
}) => {
  const { settings, selectedMonth } = useApartment();

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard
    },
    {
      id: 'flats',
      label: 'Flats',
      icon: Building2
    },
    {
      id: 'maintenance',
      label: 'Maintenance',
      icon: Wallet
    },
    {
      id: 'expenses',
      label: 'Expenses',
      icon: Receipt
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileBarChart
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings
    }
  ];

  return (
    <>
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark opacity-50 z-3 d-lg-none"
          onClick={onCloseSidebar}
        />
      )}

      <aside 
        className={`bg-white border-end d-flex flex-column transition-all z-3 ${
          sidebarOpen ? 'position-fixed top-0 start-0 h-100' : 'd-none d-lg-flex'
        }`}
        style={{
          width: '240px',
          minWidth: '240px',
          height: 'calc(100vh - 61px)',
          overflowY: 'auto'
        }}
      >
        <div className="p-3">
          
          {/* Active Period Indicator */}
          <div className="bg-light border rounded-3 p-2.5 mb-3 text-center">
            <div className="text-muted small fw-semibold" style={{ fontSize: '0.75rem' }}>
              BILLING MONTH
            </div>
            <div className="fw-bold text-dark font-monospace mt-0.5">
              {selectedMonth}
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="nav flex-column gap-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-link text-start border-0 rounded-3 px-3 py-2.5 d-flex align-items-center gap-3 transition-all ${
                    isActive 
                      ? 'bg-primary text-white fw-bold shadow-sm' 
                      : 'text-dark hover-bg-light fw-medium'
                  }`}
                  onClick={() => {
                    setActiveView(item.id);
                    onCloseSidebar();
                  }}
                  style={{
                    backgroundColor: isActive ? undefined : 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  <Icon size={20} className={isActive ? 'text-white' : 'text-secondary'} />
                  <span className="fs-6">{item.label}</span>
                </button>
              );
            })}
          </nav>

        </div>

        {/* Footer info */}
        <div className="mt-auto p-3 border-top bg-light text-center">
          <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
            {settings.apartmentName || 'Apartment Register'}
          </div>
          <div className="text-muted small" style={{ fontSize: '0.7rem' }}>
            {settings.totalFlats || 57} Registered Flats
          </div>
        </div>

      </aside>
    </>
  );
};
