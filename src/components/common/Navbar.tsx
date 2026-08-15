import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApartment } from '../../context/ApartmentContext';
import { 
  Building2, 
  Calendar, 
  FileSpreadsheet, 
  LogOut, 
  User, 
  Menu,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface NavbarProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  activeView: string;
  setActiveView: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, activeView, setActiveView }) => {
  const { user, logout } = useAuth();
  const { selectedMonth, setSelectedMonth, availableMonths, settings, downloadExcel } = useApartment();

  return (
    <header className="navbar navbar-expand-lg navbar-light bg-white border-bottom sticky-top py-2 px-3 shadow-xs">
      <div className="container-fluid p-0 d-flex align-items-center justify-content-between">
        
        {/* Left: Brand & Mobile Sidebar Toggle */}
        <div className="d-flex align-items-center gap-2">
          <button 
            className="btn btn-outline-secondary btn-sm d-lg-none p-1"
            onClick={onToggleSidebar}
            title="Toggle Sidebar"
            aria-label="Toggle Sidebar"
          >
            <Menu size={20} />
          </button>
          
          <div className="d-flex align-items-center gap-2 cursor-pointer" onClick={() => setActiveView('dashboard')}>
            <div className="bg-primary text-white p-2 rounded-3 d-flex align-items-center justify-content-center">
              <Building2 size={20} />
            </div>
            <div>
              <h6 className="mb-0 fw-bold text-dark lh-1">{settings.apartmentName}</h6>
              <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                {settings.totalFlats} Flats • Admin Portal
              </small>
            </div>
          </div>
        </div>

        {/* Center: Month Selector */}
        <div className="d-none d-md-flex align-items-center bg-light px-3 py-1 rounded-pill border">
          <Calendar size={16} className="text-primary me-2" />
          <span className="text-muted small me-2 fw-medium">Active Billing Month:</span>
          <select
            className="form-select form-select-sm border-0 bg-transparent fw-semibold text-primary py-0 ps-1 pe-4"
            style={{ width: 'auto', cursor: 'pointer' }}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {availableMonths.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Right: Quick Actions & User Menu */}
        <div className="d-flex align-items-center gap-2">
          
          {/* Quick Excel Export button */}
          <button
            className="btn btn-outline-success btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill shadow-2xs"
            onClick={() => downloadExcel()}
            title="Export this month's complete report to Excel"
          >
            <FileSpreadsheet size={16} />
            <span className="d-none d-sm-inline fw-medium">Export Excel</span>
          </button>

          {/* User Profile dropdown */}
          <div className="dropdown">
            <button
              className="btn btn-light btn-sm d-flex align-items-center gap-2 border rounded-pill px-2.5 py-1"
              type="button"
              id="userMenuButton"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              onClick={() => {
                // simple profile toggle or click
              }}
            >
              <div className="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: 26, height: 26 }}>
                <User size={14} />
              </div>
              <span className="fw-semibold small text-dark d-none d-sm-inline">
                {user?.name || 'Administrator'}
              </span>
            </button>
            
            {/* Direct Logout / Settings fast action */}
            <button
              onClick={() => logout()}
              className="btn btn-outline-danger btn-sm p-1.5 rounded-circle ms-1"
              title="Logout from Admin"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

      </div>

      {/* Mobile Month Selector Bar */}
      <div className="d-flex d-md-none w-100 mt-2 pt-2 border-top align-items-center justify-content-between">
        <span className="text-muted small fw-medium">Billing Month:</span>
        <select
          className="form-select form-select-sm w-auto fw-semibold text-primary"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {availableMonths.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
};
