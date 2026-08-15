import React, { useState, useEffect, useMemo } from 'react';
import { useApartment } from '../../context/ApartmentContext';
import { apiMaintenance } from '../../services/api';
import { MaintenanceRecord, MaintenanceSummary } from '../../types';
import { 
  CheckCircle2, 
  Clock, 
  Search, 
  Save, 
  Building2, 
  RefreshCw,
  AlertTriangle,
  Calendar
} from 'lucide-react';

export const MaintenanceView: React.FC = () => {
  const { selectedMonth, setSelectedMonth, formatMonthDisplay, availableMonths, settings, triggerRefresh, showToast } = useApartment();
  
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [summary, setSummary] = useState<MaintenanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // Local pending changes: recordId -> 'Paid' | 'Pending'
  const [localStatuses, setLocalStatuses] = useState<Record<string, 'Paid' | 'Pending'>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'All' | 'Paid' | 'Pending'>('All');

  const loadRecords = async () => {
    try {
      setIsLoading(true);
      const res = await apiMaintenance.getMonthRecords(selectedMonth);
      setRecords(res.records || []);
      setSummary(res.summary);
      
      // Initialize local status state
      const initialMap: Record<string, 'Paid' | 'Pending'> = {};
      (res.records || []).forEach(r => {
        const id = String(r._id || r.id);
        initialMap[id] = r.status;
      });
      setLocalStatuses(initialMap);
    } catch (err: any) {
      showToast(err.message || 'Error loading maintenance records', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [selectedMonth]);

  // Handle status toggle locally (no API call until UPDATE PAYMENTS is clicked)
  const handleStatusChange = (recordId: string, newStatus: 'Paid' | 'Pending') => {
    setLocalStatuses(prev => ({
      ...prev,
      [recordId]: newStatus
    }));
  };

  // Determine which records have unsaved modifications
  const unsavedCount = useMemo(() => {
    let count = 0;
    records.forEach(r => {
      const id = String(r._id || r.id);
      if (localStatuses[id] && localStatuses[id] !== r.status) {
        count++;
      }
    });
    return count;
  }, [records, localStatuses]);

  // Compute live preview numbers based on local state
  const liveStats = useMemo(() => {
    let expected = 0;
    let collected = 0;
    let paidCount = 0;
    let pendingCount = 0;

    records.forEach(r => {
      const id = String(r._id || r.id);
      const status = localStatuses[id] || r.status;
      const amt = Number(r.amount) || 0;
      expected += amt;
      if (status === 'Paid') {
        collected += amt;
        paidCount++;
      } else {
        pendingCount++;
      }
    });

    const pending = expected - collected;
    return {
      total: records.length,
      expected,
      collected,
      pending,
      paidCount,
      pendingCount
    };
  }, [records, localStatuses]);

  // Filtered records for display
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const id = String(r._id || r.id);
      const currentStatus = localStatuses[id] || r.status;

      if (filterTab === 'Paid' && currentStatus !== 'Paid') return false;
      if (filterTab === 'Pending' && currentStatus !== 'Pending') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchFlat = (r.flatNumber || '').toLowerCase().includes(q);
        const matchName = (r.residentName || '').toLowerCase().includes(q);
        if (!matchFlat && !matchName) return false;
      }

      return true;
    });
  }, [records, localStatuses, filterTab, searchQuery]);

  // Submit all changed payment statuses in one batch
  const handleUpdatePayments = async () => {
    const updates: Array<{ id: string; status: 'Paid' | 'Pending' }> = [];

    records.forEach(r => {
      const id = String(r._id || r.id);
      const newStatus = localStatuses[id];
      if (newStatus && newStatus !== r.status) {
        updates.push({
          id,
          status: newStatus
        });
      }
    });

    if (updates.length === 0) {
      showToast('No payment changes to save', 'info');
      return;
    }

    try {
      setIsSaving(true);
      const res = await apiMaintenance.batchSave(updates);
      showToast(`Successfully updated ${updates.length} flat payment records!`, 'success');
      
      // Refresh data
      await loadRecords();
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to update payments', 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  const currency = settings.currencySymbol || '₹';

  return (
    <div className="container-fluid p-3 p-md-4 max-w-6xl mx-auto pb-5">
      
      {/* Top Header: Title & Month Selection */}
      <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white mb-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <h3 className="fw-bold text-dark mb-1">
              Maintenance Register
            </h3>
            <p className="text-muted small mb-0">
              Select month, mark <strong>Paid</strong> or <strong>Pending</strong> according to the physical register, then click <strong>Update Payments</strong>.
            </p>
          </div>

          <div className="d-flex align-items-center gap-2">
            <div className="d-flex align-items-center gap-2 bg-light px-3 py-2 rounded-3 border">
              <Calendar size={18} className="text-primary" />
              <label htmlFor="month-select" className="small fw-semibold text-muted mb-0">
                Month:
              </label>
              <select
                id="month-select"
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
              className="btn btn-outline-secondary btn-sm p-2 rounded-3"
              onClick={loadRecords}
              title="Refresh"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="row g-3 mb-4">
        
        <div className="col-6 col-md-3">
          <div className="bg-white p-3 rounded-4 shadow-sm border-0 text-center">
            <div className="text-muted small fw-semibold text-uppercase">Expected</div>
            <div className="fs-4 fw-bold text-dark mt-1">
              {currency}{liveStats.expected.toLocaleString('en-IN')}
            </div>
            <div className="text-muted small">{liveStats.total} Flats</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="bg-white p-3 rounded-4 shadow-sm border-0 border-start border-success border-4 text-center">
            <div className="text-muted small fw-semibold text-uppercase text-success">Collected</div>
            <div className="fs-4 fw-bold text-success mt-1">
              {currency}{liveStats.collected.toLocaleString('en-IN')}
            </div>
            <div className="text-muted small">{liveStats.paidCount} Paid</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="bg-white p-3 rounded-4 shadow-sm border-0 border-start border-danger border-4 text-center">
            <div className="text-muted small fw-semibold text-uppercase text-danger">Pending</div>
            <div className="fs-4 fw-bold text-danger mt-1">
              {currency}{liveStats.pending.toLocaleString('en-IN')}
            </div>
            <div className="text-muted small">{liveStats.pendingCount} Pending</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="bg-white p-3 rounded-4 shadow-sm border-0 text-center">
            <div className="text-muted small fw-semibold text-uppercase">Status</div>
            <div className="fs-4 fw-bold text-dark mt-1">
              {liveStats.paidCount} <span className="fs-6 text-muted">/ {liveStats.total}</span>
            </div>
            <div className="text-muted small">
              {liveStats.expected > 0 ? Math.round((liveStats.collected / liveStats.expected) * 100) : 0}% Collected
            </div>
          </div>
        </div>

      </div>

      {/* Unsaved Changes Banner */}
      {unsavedCount > 0 && (
        <div className="alert alert-warning border-warning shadow-sm rounded-4 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3 mb-4 p-3 px-4">
          <div className="d-flex align-items-center gap-2">
            <AlertTriangle className="text-warning flex-shrink-0" size={24} />
            <div>
              <strong>{unsavedCount} Unsaved Changes!</strong> You have modified payment statuses. Click the button to save to the database.
            </div>
          </div>
          <button
            className="btn btn-warning fw-bold text-dark px-4 py-2 rounded-3 shadow-sm flex-shrink-0"
            onClick={handleUpdatePayments}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'UPDATE PAYMENTS'}
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Box */}
      <div className="card border-0 shadow-sm rounded-4 p-3 bg-white mb-3">
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3">
          
          {/* Quick View Tabs: All, Paid, Pending */}
          <div className="btn-group p-1 bg-light rounded-3" role="group">
            <button
              type="button"
              className={`btn btn-sm rounded-2 px-3 fw-semibold ${
                filterTab === 'All' ? 'btn-primary shadow-sm' : 'btn-light text-muted'
              }`}
              onClick={() => setFilterTab('All')}
            >
              All Flats ({liveStats.total})
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-2 px-3 fw-semibold ${
                filterTab === 'Paid' ? 'btn-success text-white shadow-sm' : 'btn-light text-muted'
              }`}
              onClick={() => setFilterTab('Paid')}
            >
              Paid Flats ({liveStats.paidCount})
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-2 px-3 fw-semibold ${
                filterTab === 'Pending' ? 'btn-danger text-white shadow-sm' : 'btn-light text-muted'
              }`}
              onClick={() => setFilterTab('Pending')}
            >
              Pending Flats ({liveStats.pendingCount})
            </button>
          </div>

          {/* Search box */}
          <div className="position-relative" style={{ minWidth: '220px' }}>
            <Search className="position-absolute text-muted" size={16} style={{ top: '10px', left: '12px' }} />
            <input
              type="text"
              className="form-control form-control-sm ps-5 rounded-3"
              placeholder="Search flat or resident..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

        </div>
      </div>

      {/* Main Flat Table */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
        {isLoading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary mb-2" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <div className="text-muted">Loading flats...</div>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-5 text-muted">
            No flats matching the current filter.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr className="text-muted small text-uppercase" style={{ letterSpacing: '0.04em' }}>
                  <th className="ps-4 py-3" style={{ width: '25%' }}>Flat Number</th>
                  <th className="py-3" style={{ width: '35%' }}>Resident Name</th>
                  <th className="py-3" style={{ width: '20%' }}>Maintenance Amount</th>
                  <th className="pe-4 py-3 text-end" style={{ width: '20%' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => {
                  const id = String(record._id || record.id);
                  const currentStatus = localStatuses[id] || record.status;
                  const isModified = currentStatus !== record.status;

                  return (
                    <tr 
                      key={id}
                      className={isModified ? 'table-warning bg-opacity-25' : ''}
                    >
                      {/* Flat Number */}
                      <td className="ps-4 py-3">
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-bold text-dark fs-6">
                            {record.flatNumber}
                          </span>
                          {isModified && (
                            <span className="badge bg-warning text-dark small" style={{ fontSize: '0.65rem' }}>
                              Modified
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Resident Name */}
                      <td className="py-3">
                        <span className="text-dark fw-medium">
                          {record.residentName || 'Resident'}
                        </span>
                      </td>

                      {/* Maintenance Amount */}
                      <td className="py-3">
                        <span className="fw-bold text-dark">
                          {currency}{Number(record.amount || 1500).toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* Status Toggle (Paid / Pending) */}
                      <td className="pe-4 py-3 text-end">
                        <div className="btn-group btn-group-sm" role="group">
                          <button
                            type="button"
                            className={`btn px-3 py-1.5 fw-semibold ${
                              currentStatus === 'Paid'
                                ? 'btn-success text-white'
                                : 'btn-outline-secondary text-muted'
                            }`}
                            onClick={() => handleStatusChange(id, 'Paid')}
                          >
                            Paid
                          </button>
                          <button
                            type="button"
                            className={`btn px-3 py-1.5 fw-semibold ${
                              currentStatus === 'Pending'
                                ? 'btn-danger text-white'
                                : 'btn-outline-secondary text-muted'
                            }`}
                            onClick={() => handleStatusChange(id, 'Pending')}
                          >
                            Pending
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Primary UPDATE PAYMENTS Button at Bottom */}
      <div className="card border-0 shadow-sm rounded-4 p-4 bg-white text-center">
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-3">
          <div className="text-start">
            <div className="fw-bold text-dark fs-6">
              Ready to save register changes?
            </div>
            <div className="text-muted small">
              {unsavedCount > 0 
                ? `${unsavedCount} payment change(s) ready to be saved to the database.`
                : 'All payment statuses are up to date with the database.'}
            </div>
          </div>

          <button
            className={`btn px-5 py-3 rounded-3 fw-bold fs-6 shadow-sm d-flex align-items-center justify-content-center gap-2 ${
              unsavedCount > 0 ? 'btn-primary' : 'btn-outline-primary'
            }`}
            onClick={handleUpdatePayments}
            disabled={isSaving || unsavedCount === 0}
          >
            <Save size={20} />
            <span>{isSaving ? 'Saving Changes...' : 'UPDATE PAYMENTS'}</span>
          </button>
        </div>
      </div>

    </div>
  );
};
