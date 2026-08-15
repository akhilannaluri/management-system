import React, { useState, useEffect } from 'react';
import { useApartment } from '../../context/ApartmentContext';
import { apiMaintenance, apiExpenses } from '../../services/api';
import { MaintenanceSummary } from '../../types';
import { 
  Building2, 
  CheckCircle2, 
  Clock, 
  Users, 
  ArrowRight,
  Receipt,
  FileBarChart,
  Wallet,
  TrendingUp,
  DollarSign
} from 'lucide-react';

interface DashboardViewProps {
  setActiveView: (view: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveView }) => {
  const { selectedMonth, formatMonthDisplay, settings, refreshTrigger } = useApartment();
  const [summary, setSummary] = useState<MaintenanceSummary>({
    totalFlats: settings.totalFlats || 57,
    expectedMaintenance: 0,
    totalCollected: 0,
    totalPending: 0,
    paidCount: 0,
    pendingCount: 0,
    collectionPercentage: 0
  });
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const [maintRes, expRes] = await Promise.all([
        apiMaintenance.getMonthRecords(selectedMonth),
        apiExpenses.getMonthExpenses(selectedMonth)
      ]);

      if (maintRes.summary) {
        setSummary(maintRes.summary);
      }
      if (expRes.summary) {
        setTotalExpenses(expRes.summary.totalExpenses || 0);
      } else if (Array.isArray(expRes.allExpenses)) {
        const sum = expRes.allExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
        setTotalExpenses(sum);
      }
    } catch (err) {
      console.error('Error loading dashboard summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedMonth, refreshTrigger]);

  const currency = settings.currencySymbol || '₹';
  const remainingSavings = summary.totalCollected - totalExpenses;

  return (
    <div className="container-fluid p-3 p-md-4 max-w-6xl mx-auto">
      
      {/* Header with selected month */}
      <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white mb-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="text-uppercase text-primary fw-bold small mb-1" style={{ letterSpacing: '0.05em' }}>
              {settings.apartmentName || 'Greenview Heights Apartments'}
            </div>
            <h2 className="fw-bold text-dark mb-0">
              {formatMonthDisplay(selectedMonth)}
            </h2>
          </div>

          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-light text-dark border px-3 py-2 fs-6 fw-semibold">
              Month: <span className="text-primary font-monospace">{selectedMonth}</span>
            </span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <div className="text-muted">Loading financial figures for {formatMonthDisplay(selectedMonth)}...</div>
        </div>
      ) : (
        <>
          {/* Main 6 Key Financial Numbers Grid */}
          <div className="row g-3 g-md-4 mb-4">
            
            {/* 1. Expected Maintenance */}
            <div className="col-12 col-sm-6 col-lg-4">
              <div className="card h-100 border-0 shadow-sm rounded-4 p-4 bg-white">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <span className="text-muted fw-semibold small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                    Expected Maintenance
                  </span>
                  <div className="p-2.5 rounded-3 bg-primary-subtle text-primary">
                    <Building2 size={22} />
                  </div>
                </div>
                <div className="fs-2 fw-bold text-dark mb-1">
                  {currency}{summary.expectedMaintenance.toLocaleString('en-IN')}
                </div>
                <div className="text-muted small">
                  Total for all {summary.totalFlats} flats
                </div>
              </div>
            </div>

            {/* 2. Total Collected */}
            <div className="col-12 col-sm-6 col-lg-4">
              <div className="card h-100 border-0 shadow-sm rounded-4 p-4 bg-white border-start border-success border-4">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <span className="text-muted fw-semibold small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                    Total Collected
                  </span>
                  <div className="p-2.5 rounded-3 bg-success-subtle text-success">
                    <CheckCircle2 size={22} />
                  </div>
                </div>
                <div className="fs-2 fw-bold text-success mb-1">
                  {currency}{summary.totalCollected.toLocaleString('en-IN')}
                </div>
                <div className="text-muted small">
                  {summary.collectionPercentage}% collected from {summary.paidCount} flats
                </div>
              </div>
            </div>

            {/* 3. Total Pending */}
            <div className="col-12 col-sm-6 col-lg-4">
              <div className="card h-100 border-0 shadow-sm rounded-4 p-4 bg-white border-start border-danger border-4">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <span className="text-muted fw-semibold small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                    Total Pending
                  </span>
                  <div className="p-2.5 rounded-3 bg-danger-subtle text-danger">
                    <Clock size={22} />
                  </div>
                </div>
                <div className="fs-2 fw-bold text-danger mb-1">
                  {currency}{summary.totalPending.toLocaleString('en-IN')}
                </div>
                <div className="text-muted small">
                  {summary.pendingCount} {summary.pendingCount === 1 ? 'flat' : 'flats'} pending payment
                </div>
              </div>
            </div>

            {/* 4. Paid Flats / Total Flats */}
            <div className="col-12 col-sm-6 col-lg-4">
              <div className="card h-100 border-0 shadow-sm rounded-4 p-4 bg-white">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <span className="text-muted fw-semibold small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                    Paid Flats / Total Flats
                  </span>
                  <div className="p-2.5 rounded-3 bg-info-subtle text-info">
                    <Users size={22} />
                  </div>
                </div>
                <div className="fs-2 fw-bold text-dark mb-1">
                  {summary.paidCount} <span className="fs-5 text-muted fw-normal">/ {summary.totalFlats}</span>
                </div>
                <div className="text-muted small">
                  {summary.pendingCount} flats pending payment
                </div>
              </div>
            </div>

            {/* 5. Total Expenses */}
            <div className="col-12 col-sm-6 col-lg-4">
              <div className="card h-100 border-0 shadow-sm rounded-4 p-4 bg-white border-start border-warning border-4">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <span className="text-muted fw-semibold small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                    Total Expenses
                  </span>
                  <div className="p-2.5 rounded-3 bg-warning-subtle text-warning-emphasis">
                    <Receipt size={22} />
                  </div>
                </div>
                <div className="fs-2 fw-bold text-dark mb-1">
                  {currency}{totalExpenses.toLocaleString('en-IN')}
                </div>
                <div className="text-muted small">
                  Actual expenses for {formatMonthDisplay(selectedMonth)}
                </div>
              </div>
            </div>

            {/* 6. Remaining / Savings */}
            <div className="col-12 col-sm-6 col-lg-4">
              <div className={`card h-100 border-0 shadow-sm rounded-4 p-4 bg-white border-start ${remainingSavings >= 0 ? 'border-primary' : 'border-danger'} border-4`}>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <span className="text-muted fw-semibold small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                    Remaining / Savings
                  </span>
                  <div className={`p-2.5 rounded-3 ${remainingSavings >= 0 ? 'bg-primary-subtle text-primary' : 'bg-danger-subtle text-danger'}`}>
                    <TrendingUp size={22} />
                  </div>
                </div>
                <div className={`fs-2 fw-bold ${remainingSavings >= 0 ? 'text-primary' : 'text-danger'} mb-1`}>
                  {currency}{remainingSavings.toLocaleString('en-IN')}
                </div>
                <div className="text-muted small">
                  Collected ({currency}{summary.totalCollected.toLocaleString('en-IN')}) − Expenses ({currency}{totalExpenses.toLocaleString('en-IN')})
                </div>
              </div>
            </div>

          </div>

          {/* Quick Action Navigation Cards */}
          <div className="mb-4">
            <h5 className="fw-bold text-dark mb-3">Quick Navigation</h5>
            <div className="row g-3">
              
              {/* 1. Maintenance */}
              <div className="col-12 col-md-4">
                <div 
                  className="card h-100 border-0 shadow-sm rounded-4 p-4 bg-white cursor-pointer hover-shadow transition-all"
                  onClick={() => setActiveView('maintenance')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="d-flex align-items-center gap-3">
                      <div className="p-3 rounded-3 bg-primary text-white">
                        <Wallet size={24} />
                      </div>
                      <div>
                        <h5 className="fw-bold text-dark mb-0">Maintenance</h5>
                        <small className="text-muted">Update flat payments</small>
                      </div>
                    </div>
                    <ArrowRight size={20} className="text-primary" />
                  </div>
                  <p className="text-secondary small mb-3">
                    View flats, mark Paid or Pending from register, and save updates with one click.
                  </p>
                  <button className="btn btn-primary btn-sm w-100 fw-semibold rounded-3 py-2">
                    Open Maintenance &rarr;
                  </button>
                </div>
              </div>

              {/* 2. Expenses */}
              <div className="col-12 col-md-4">
                <div 
                  className="card h-100 border-0 shadow-sm rounded-4 p-4 bg-white cursor-pointer hover-shadow transition-all"
                  onClick={() => setActiveView('expenses')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="d-flex align-items-center gap-3">
                      <div className="p-3 rounded-3 bg-warning text-dark">
                        <Receipt size={24} />
                      </div>
                      <div>
                        <h5 className="fw-bold text-dark mb-0">Expenses</h5>
                        <small className="text-muted">Track monthly expenses</small>
                      </div>
                    </div>
                    <ArrowRight size={20} className="text-dark" />
                  </div>
                  <p className="text-secondary small mb-3">
                    Add, edit, or delete monthly expenses like salaries, repairs, lift AMC, electricity bills.
                  </p>
                  <button className="btn btn-outline-dark btn-sm w-100 fw-semibold rounded-3 py-2">
                    Open Expenses &rarr;
                  </button>
                </div>
              </div>

              {/* 3. Reports */}
              <div className="col-12 col-md-4">
                <div 
                  className="card h-100 border-0 shadow-sm rounded-4 p-4 bg-white cursor-pointer hover-shadow transition-all"
                  onClick={() => setActiveView('reports')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="d-flex align-items-center gap-3">
                      <div className="p-3 rounded-3 bg-success text-white">
                        <FileBarChart size={24} />
                      </div>
                      <div>
                        <h5 className="fw-bold text-dark mb-0">Reports</h5>
                        <small className="text-muted">Excel & PDF export</small>
                      </div>
                    </div>
                    <ArrowRight size={20} className="text-success" />
                  </div>
                  <p className="text-secondary small mb-3">
                    View monthly financial breakdown and download Excel workbook or print PDF.
                  </p>
                  <button className="btn btn-outline-success btn-sm w-100 fw-semibold rounded-3 py-2">
                    Open Reports &rarr;
                  </button>
                </div>
              </div>

            </div>
          </div>
        </>
      )}

    </div>
  );
};
