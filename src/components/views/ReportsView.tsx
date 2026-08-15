import React, { useState, useEffect } from 'react';
import { useApartment } from '../../context/ApartmentContext';
import { apiReports, apiMaintenance, apiExpenses } from '../../services/api';
import { MonthlyReportData, MonthlyExpense, MaintenanceRecord } from '../../types';
import { 
  FileSpreadsheet, 
  Printer, 
  Calendar, 
  Wallet,
  Receipt,
  PiggyBank,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Building2
} from 'lucide-react';

function formatDate(dateInput: any): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (_) {
    return '-';
  }
}

export const ReportsView: React.FC = () => {
  const { selectedMonth, setSelectedMonth, formatMonthDisplay, availableMonths, settings, downloadExcel, showToast } = useApartment();
  
  const [report, setReport] = useState<MonthlyReportData | null>(null);
  const [allMaintenanceRecords, setAllMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadReport = async () => {
    try {
      setIsLoading(true);
      const [reportRes, maintRes, expRes] = await Promise.all([
        apiReports.getMonthReport(selectedMonth),
        apiMaintenance.getMonthRecords(selectedMonth),
        apiExpenses.getMonthExpenses(selectedMonth)
      ]);

      setReport(reportRes);
      
      // Use records from maintRes or reportRes and sort naturally by flat number
      const records = (maintRes.records && maintRes.records.length > 0)
        ? maintRes.records 
        : (reportRes.allMaintenanceRecords || []);
      
      const sortedRecords = [...records].sort((a, b) => 
        (a.flatNumber || '').localeCompare(b.flatNumber || '', undefined, { numeric: true })
      );
      setAllMaintenanceRecords(sortedRecords);

      // Expenses sorted earliest first
      const expList = expRes.allExpenses || reportRes.expenses || [];
      const sortedExp = [...expList].sort((a, b) => {
        const dateA = a.paymentDate || a.createdAt || '';
        const dateB = b.paymentDate || b.createdAt || '';
        return String(dateA).localeCompare(String(dateB));
      });
      setExpenses(sortedExp);
    } catch (err: any) {
      showToast(err.message || 'Error loading report data', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedMonth]);

  const summary = report?.financialSummary || {
    totalFlats: settings.totalFlats || allMaintenanceRecords.length || 57,
    expectedMaintenance: 0,
    collectedMaintenance: 0,
    pendingMaintenance: 0,
    collectionRate: 0,
    paidFlatsCount: 0,
    pendingFlatsCount: 0,
    totalExpenses: 0,
    remainingBalance: 0
  };

  const cumulative = report?.cumulativeSummary || {
    cutoffMonth: selectedMonth,
    cutoffMonthDisplay: formatMonthDisplay(selectedMonth),
    monthsIncluded: [selectedMonth],
    totalCollected: summary.collectedMaintenance,
    totalExpenses: summary.totalExpenses,
    cumulativeSavings: summary.remainingBalance
  };

  const totalExpenseAmount = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const currentMonthSavings = summary.collectedMaintenance - totalExpenseAmount;
  const currency = settings.currencySymbol || '₹';

  const handlePrintPDF = () => {
    window.focus();
    window.print();
  };

  return (
    <div className="container-fluid p-3 p-md-4 max-w-5xl mx-auto pb-5">
      
      {/* Top Header Card (Hidden in Print) */}
      <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white mb-4 d-print-none">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <h3 className="fw-bold text-dark mb-1">
              Monthly Financial Report
            </h3>
            <p className="text-muted small mb-0">
              Complete maintenance register, expense register, monthly savings & cumulative financial overview for <strong>{formatMonthDisplay(selectedMonth)}</strong>.
            </p>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2">
            <div className="d-flex align-items-center gap-2 bg-light px-3 py-2 rounded-3 border">
              <Calendar size={18} className="text-primary" />
              <label htmlFor="month-select-reports" className="small fw-semibold text-muted mb-0">
                Month:
              </label>
              <select
                id="month-select-reports"
                className="form-select form-select-sm border-0 bg-transparent fw-bold text-dark shadow-none p-0"
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

            <button 
              id="btn-export-excel-reports"
              className="btn btn-outline-success btn-sm px-3 py-2 rounded-3 fw-bold d-flex align-items-center gap-1.5 shadow-sm"
              onClick={() => downloadExcel(selectedMonth)}
            >
              <FileSpreadsheet size={18} />
              <span>EXPORT EXCEL</span>
            </button>

            <button 
              id="btn-export-pdf-reports"
              className="btn btn-primary btn-sm px-3 py-2 rounded-3 fw-bold d-flex align-items-center gap-1.5 shadow-sm"
              onClick={handlePrintPDF}
            >
              <Printer size={18} />
              <span>EXPORT PDF</span>
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary mb-2" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <div className="text-muted">Generating financial report for {formatMonthDisplay(selectedMonth)}...</div>
        </div>
      ) : (
        <div className="printable-report">
          
          {/* Main Report Container */}
          <div className="bg-white p-4 p-md-5 rounded-4 shadow-sm mb-4 border">
            
            {/* Header / Title */}
            <div className="text-center border-bottom pb-4 mb-4">
              <h2 className="fw-bold text-dark mb-1 text-uppercase" style={{ letterSpacing: '0.05em' }}>
                {settings.apartmentName || 'GREENVIEW HEIGHTS APARTMENTS'}
              </h2>
              <h4 className="fw-semibold text-secondary mb-1 text-uppercase">
                MONTHLY FINANCIAL & MAINTENANCE REPORT
              </h4>
              <h3 className="fw-bold text-primary mb-2 text-uppercase">
                {formatMonthDisplay(selectedMonth)}
              </h3>
              {settings.address && (
                <div className="text-muted small">
                  {settings.address}
                </div>
              )}
              <div className="text-muted small mt-1">
                Generated on: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>

            {/* =========================================================
                1. MONTHLY MAINTENANCE SUMMARY
               ========================================================= */}
            <div className="mb-5">
              <div className="d-flex align-items-center gap-2 mb-3">
                <Wallet className="text-primary" size={22} />
                <h5 className="fw-bold text-dark mb-0 text-uppercase" style={{ letterSpacing: '0.04em' }}>
                  1. Monthly Maintenance
                </h5>
              </div>

              <div className="row g-3">
                <div className="col-6 col-md-4 col-lg-2">
                  <div className="p-3 rounded-3 bg-light border text-center h-100">
                    <div className="text-muted small fw-semibold text-uppercase">Expected</div>
                    <div className="fs-5 fw-bold text-dark mt-1">
                      {currency}{summary.expectedMaintenance.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-4 col-lg-2">
                  <div className="p-3 rounded-3 bg-success-subtle border border-success-subtle text-center h-100">
                    <div className="text-success small fw-semibold text-uppercase">Collected</div>
                    <div className="fs-5 fw-bold text-success mt-1">
                      {currency}{summary.collectedMaintenance.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-4 col-lg-2">
                  <div className="p-3 rounded-3 bg-danger-subtle border border-danger-subtle text-center h-100">
                    <div className="text-danger small fw-semibold text-uppercase">Pending</div>
                    <div className="fs-5 fw-bold text-danger mt-1">
                      {currency}{summary.pendingMaintenance.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-4 col-lg-2">
                  <div className="p-3 rounded-3 bg-success-subtle border border-success-subtle text-center h-100">
                    <div className="text-success small fw-semibold text-uppercase">Paid Flats</div>
                    <div className="fs-5 fw-bold text-success mt-1">
                      {summary.paidFlatsCount}
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-4 col-lg-2">
                  <div className="p-3 rounded-3 bg-danger-subtle border border-danger-subtle text-center h-100">
                    <div className="text-danger small fw-semibold text-uppercase">Pending Flats</div>
                    <div className="fs-5 fw-bold text-danger mt-1">
                      {summary.pendingFlatsCount}
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-4 col-lg-2">
                  <div className="p-3 rounded-3 bg-light border text-center h-100">
                    <div className="text-muted small fw-semibold text-uppercase">Total Flats</div>
                    <div className="fs-5 fw-bold text-dark mt-1">
                      {summary.totalFlats}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* =========================================================
                2. MAINTENANCE REGISTER
               ========================================================= */}
            <div className="mb-5">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center gap-2">
                  <Building2 className="text-primary" size={22} />
                  <h5 className="fw-bold text-dark mb-0 text-uppercase" style={{ letterSpacing: '0.04em' }}>
                    2. Maintenance Register
                  </h5>
                </div>
                <div className="small text-muted">
                  Showing all {allMaintenanceRecords.length} units
                </div>
              </div>

              <div className="table-responsive border rounded-3 overflow-hidden">
                <table className="table table-sm table-striped table-hover mb-0">
                  <thead className="table-light">
                    <tr className="small text-muted text-uppercase">
                      <th className="ps-3 py-2" style={{ width: '8%' }}>S.No</th>
                      <th className="py-2" style={{ width: '18%' }}>Flat Number</th>
                      <th className="py-2" style={{ width: '32%' }}>Owner Name</th>
                      <th className="py-2 text-end" style={{ width: '18%' }}>Amount</th>
                      <th className="py-2 text-center" style={{ width: '12%' }}>Status</th>
                      <th className="pe-3 py-2 text-center" style={{ width: '12%' }}>Payment Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allMaintenanceRecords.map((r, idx) => {
                      const isPaid = r.status === 'Paid';
                      const paidDateStr = isPaid ? formatDate(r.paidDate || r.updatedAt) : '-';
                      return (
                        <tr key={String(r._id || r.id || idx)}>
                          <td className="ps-3 py-2 text-muted small">{idx + 1}</td>
                          <td className="py-2 fw-bold text-dark">{r.flatNumber}</td>
                          <td className="py-2 text-secondary">{r.residentName || 'Resident'}</td>
                          <td className="py-2 text-end fw-semibold text-dark">
                            {currency}{Number(r.amount || 1500).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 text-center">
                            {isPaid ? (
                              <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 fw-bold rounded-pill">
                                Paid
                              </span>
                            ) : (
                              <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 fw-bold rounded-pill">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="pe-3 py-2 text-center text-muted small">
                            {paidDateStr}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* =========================================================
                3. MONTHLY EXPENSES
               ========================================================= */}
            <div className="mb-5">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center gap-2">
                  <Receipt className="text-dark" size={22} />
                  <h5 className="fw-bold text-dark mb-0 text-uppercase" style={{ letterSpacing: '0.04em' }}>
                    3. Monthly Expenses
                  </h5>
                </div>
                <div className="fs-6 fw-bold text-dark">
                  Total Expenses: <span className="text-danger">{currency}{totalExpenseAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {expenses.length === 0 ? (
                <div className="p-3 bg-light rounded-3 text-muted text-center small border">
                  No expenses recorded for this month.
                </div>
              ) : (
                <div className="table-responsive border rounded-3 overflow-hidden">
                  <table className="table table-sm table-striped table-hover mb-0">
                    <thead className="table-light">
                      <tr className="small text-muted text-uppercase">
                        <th className="ps-3 py-2" style={{ width: '10%' }}>S.No</th>
                        <th className="py-2" style={{ width: '25%' }}>Date</th>
                        <th className="py-2" style={{ width: '45%' }}>Expense Name</th>
                        <th className="pe-3 py-2 text-end" style={{ width: '20%' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((e, idx) => (
                        <tr key={String(e._id || e.id || idx)}>
                          <td className="ps-3 py-2 text-muted small">{idx + 1}</td>
                          <td className="py-2 text-muted small">
                            {formatDate(e.paymentDate || e.createdAt)}
                          </td>
                          <td className="py-2 fw-semibold text-dark">{e.name}</td>
                          <td className="pe-3 py-2 text-end fw-bold text-danger">
                            {currency}{Number(e.amount).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="table-light border-top">
                      <tr>
                        <td className="ps-3 py-2 fw-bold text-dark" colSpan={3}>TOTAL EXPENSES</td>
                        <td className="pe-3 py-2 text-end fw-bold text-danger">
                          {currency}{totalExpenseAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* =========================================================
                4. CURRENT MONTH FINANCIAL SUMMARY
               ========================================================= */}
            <div className="mb-5">
              <div className="d-flex align-items-center gap-2 mb-3">
                <PiggyBank className="text-success" size={22} />
                <h5 className="fw-bold text-dark mb-0 text-uppercase" style={{ letterSpacing: '0.04em' }}>
                  4. Current Month Financial Summary
                </h5>
              </div>

              <div className="bg-light p-4 rounded-4 border">
                <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
                  <span className="text-secondary fw-semibold fs-6">Collected Maintenance</span>
                  <span className="fw-bold fs-5 text-success">
                    {currency}{summary.collectedMaintenance.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
                  <span className="text-secondary fw-semibold fs-6">Less: Total Expenses</span>
                  <span className="fw-bold fs-5 text-danger">
                    − {currency}{totalExpenseAmount.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="d-flex justify-content-between align-items-center pt-3 mt-1">
                  <div>
                    <span className="fs-5 fw-bold text-dark">Current Month Savings / Remaining:</span>
                    <div className="text-muted small">
                      (Collected Maintenance minus Total Expenses for {formatMonthDisplay(selectedMonth)})
                    </div>
                  </div>
                  <span className={`fs-2 fw-bold ${currentMonthSavings >= 0 ? 'text-success' : 'text-danger'}`}>
                    {currency}{currentMonthSavings.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* =========================================================
                5. CUMULATIVE FINANCIAL SUMMARY
               ========================================================= */}
            <div>
              <div className="d-flex align-items-center gap-2 mb-3">
                <TrendingUp className="text-primary" size={22} />
                <h5 className="fw-bold text-dark mb-0 text-uppercase" style={{ letterSpacing: '0.04em' }}>
                  5. Cumulative Financial Summary
                </h5>
              </div>

              <div className="p-4 rounded-4 border bg-white" style={{ borderColor: '#cbd5e1' }}>
                <div className="small text-muted mb-3">
                  Calculated across all completed months up to and including <strong>{formatMonthDisplay(selectedMonth)}</strong>.
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-4">
                    <div className="p-3 rounded-3 bg-light border h-100">
                      <div className="text-muted small fw-semibold text-uppercase">
                        Total Maintenance Collected
                      </div>
                      <div className="text-muted small">
                        (Up to {formatMonthDisplay(selectedMonth)})
                      </div>
                      <div className="fs-4 fw-bold text-success mt-2">
                        {currency}{cumulative.totalCollected.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-4">
                    <div className="p-3 rounded-3 bg-light border h-100">
                      <div className="text-muted small fw-semibold text-uppercase">
                        Total Expenses
                      </div>
                      <div className="text-muted small">
                        (Up to {formatMonthDisplay(selectedMonth)})
                      </div>
                      <div className="fs-4 fw-bold text-danger mt-2">
                        {currency}{cumulative.totalExpenses.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-4">
                    <div className={`p-3 rounded-3 border h-100 ${cumulative.cumulativeSavings >= 0 ? 'bg-success-subtle border-success-subtle' : 'bg-danger-subtle border-danger-subtle'}`}>
                      <div className="small fw-semibold text-uppercase text-dark">
                        TOTAL SAVINGS UP TO {formatMonthDisplay(selectedMonth).toUpperCase()}
                      </div>
                      <div className="text-muted small">
                        (Cumulative Maintenance − Expenses)
                      </div>
                      <div className={`fs-3 fw-bold mt-2 ${cumulative.cumulativeSavings >= 0 ? 'text-success' : 'text-danger'}`}>
                        {currency}{cumulative.cumulativeSavings.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Action Buttons in footer (Hidden in Print) */}
          <div className="d-flex justify-content-end gap-2 d-print-none">
            <button 
              id="btn-footer-export-excel"
              className="btn btn-outline-success px-4 py-2 rounded-3 fw-bold d-flex align-items-center gap-2"
              onClick={() => downloadExcel(selectedMonth)}
            >
              <FileSpreadsheet size={18} />
              <span>EXPORT EXCEL</span>
            </button>

            <button 
              id="btn-footer-export-pdf"
              className="btn btn-primary px-4 py-2 rounded-3 fw-bold d-flex align-items-center gap-2"
              onClick={handlePrintPDF}
            >
              <Printer size={18} />
              <span>EXPORT PDF</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
