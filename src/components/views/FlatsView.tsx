import React, { useState, useEffect, useRef } from 'react';
import { useApartment } from '../../context/ApartmentContext';
import { apiFlats } from '../../services/api';
import { Flat } from '../../types';
import { 
  Plus, 
  Upload, 
  Search, 
  Edit, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Download,
  Building,
  RefreshCw,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const FlatsView: React.FC = () => {
  const { settings, triggerRefresh, showToast } = useApartment();
  const currency = settings.currencySymbol || '₹';

  const [flats, setFlats] = useState<Flat[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  // Add / Edit Modal state
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingFlat, setEditingFlat] = useState<Flat | null>(null);
  const [formData, setFormData] = useState({
    flatNumber: '',
    residentName: '',
    customMaintenanceAmount: '',
    status: 'Active' as 'Active' | 'Inactive'
  });
  const [formError, setFormError] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Import Modal state
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedImportFlats, setParsedImportFlats] = useState<any[]>([]);
  const [importValidationErrors, setImportValidationErrors] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'replace_all' | 'upsert'>('replace_all');
  const [isImporting, setIsImporting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFlats = async () => {
    try {
      setIsLoading(true);
      const res = await apiFlats.getAll();
      if (res.flats) {
        setFlats(res.flats);
      }
    } catch (err: any) {
      console.error('Error loading flats:', err);
      showToast(err.message || 'Failed to load flats', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFlats();
  }, []);

  // Filter flats based on search and status
  const filteredFlats = flats.filter(flat => {
    if (statusFilter !== 'All' && (flat.status || 'Active') !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchFlat = (flat.flatNumber || '').toLowerCase().includes(q);
      const matchName = (flat.residentName || '').toLowerCase().includes(q);
      if (!matchFlat && !matchName) return false;
    }
    return true;
  });

  // Open Add Flat Modal
  const handleOpenAddModal = () => {
    setEditingFlat(null);
    setFormData({
      flatNumber: '',
      residentName: '',
      customMaintenanceAmount: String(settings.defaultMonthlyMaintenance || 1500),
      status: 'Active'
    });
    setFormError('');
    setShowModal(true);
  };

  // Open Edit Flat Modal
  const handleOpenEditModal = (flat: Flat) => {
    setEditingFlat(flat);
    setFormData({
      flatNumber: flat.flatNumber || '',
      residentName: flat.residentName || '',
      customMaintenanceAmount: flat.customMaintenanceAmount !== null && flat.customMaintenanceAmount !== undefined
        ? String(flat.customMaintenanceAmount)
        : String(settings.defaultMonthlyMaintenance || 1500),
      status: flat.status === 'Inactive' ? 'Inactive' : 'Active'
    });
    setFormError('');
    setShowModal(true);
  };

  // Save Add / Edit
  const handleSaveFlat = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.flatNumber.trim()) {
      setFormError('Flat Number is required.');
      return;
    }
    if (!formData.residentName.trim()) {
      setFormError('Resident Name is required.');
      return;
    }

    const maintAmt = formData.customMaintenanceAmount.trim() !== ''
      ? Number(formData.customMaintenanceAmount)
      : null;

    if (maintAmt !== null && (isNaN(maintAmt) || maintAmt < 0)) {
      setFormError('Maintenance Amount must be a valid non-negative number.');
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        flatNumber: formData.flatNumber.trim(),
        residentName: formData.residentName.trim(),
        customMaintenanceAmount: maintAmt,
        status: formData.status
      };

      if (editingFlat) {
        const id = editingFlat._id || editingFlat.id;
        if (!id) throw new Error('Flat ID missing');
        const res = await apiFlats.update(id, payload);
        showToast(res.message || `Flat ${res.flat.flatNumber} updated successfully`, 'success');
      } else {
        const res = await apiFlats.create(payload);
        showToast(res.message || `Flat ${res.flat.flatNumber} added successfully`, 'success');
      }

      setShowModal(false);
      await loadFlats();
      triggerRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save flat.');
    } finally {
      setIsSaving(false);
    }
  };

  // Process Excel / CSV File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setImportFile(file);
    parseFile(file);
  };

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON array of objects
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawJson.length === 0) {
          setImportValidationErrors(['The uploaded sheet contains no data rows.']);
          setParsedImportFlats([]);
          return;
        }

        const errors: string[] = [];
        const validFlats: any[] = [];
        const seenNumbers = new Set<string>();

        rawJson.forEach((row: any, idx: number) => {
          const rowNum = idx + 2; // +1 for header, +1 for 1-based index
          
          // Match keys flexibly (case insensitive, trim spaces)
          const keys = Object.keys(row);
          const findKey = (candidates: string[]) => {
            const lower = candidates.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''));
            for (const k of keys) {
              const cleaned = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (lower.includes(cleaned)) return row[k];
            }
            return undefined;
          };

          const rawFlatNo = findKey(['flat number', 'flat no', 'flat', 'unit', 'door no', 'flat_number', 'flat#']);
          const rawName = findKey(['resident name', 'resident', 'name', 'owner', 'tenant', 'occupant', 'resident_name']);
          const rawAmount = findKey(['maintenance amount', 'maintenance', 'amount', 'monthly maintenance', 'fee', 'charge', 'rate', 'custom_maintenance_amount']);
          const rawStatus = findKey(['status', 'active', 'state']);

          const flatNumber = rawFlatNo !== undefined ? String(rawFlatNo).trim() : '';
          const residentName = rawName !== undefined ? String(rawName).trim() : '';

          if (!flatNumber) {
            errors.push(`Row ${rowNum}: Missing "Flat Number".`);
            return;
          }
          if (!residentName) {
            errors.push(`Row ${rowNum} (Flat ${flatNumber}): Missing "Resident Name".`);
            return;
          }

          const flatKey = flatNumber.toLowerCase();
          if (seenNumbers.has(flatKey)) {
            errors.push(`Row ${rowNum}: Duplicate Flat Number "${flatNumber}" in file.`);
            return;
          }
          seenNumbers.add(flatKey);

          let maintAmt: number | null = null;
          if (rawAmount !== undefined && String(rawAmount).trim() !== '') {
            const cleanAmt = String(rawAmount).replace(/[^0-9.-]+/g, '');
            const parsed = Number(cleanAmt);
            if (isNaN(parsed) || parsed < 0) {
              errors.push(`Row ${rowNum} (Flat ${flatNumber}): Invalid Maintenance Amount "${rawAmount}".`);
              return;
            }
            maintAmt = parsed;
          }

          validFlats.push({
            flatNumber,
            residentName,
            customMaintenanceAmount: maintAmt,
            status: String(rawStatus || '').toLowerCase().includes('inact') ? 'Inactive' : 'Active'
          });
        });

        setImportValidationErrors(errors);
        setParsedImportFlats(validFlats);
      } catch (err: any) {
        setImportValidationErrors([`File parse error: ${err.message || 'Invalid format'}`]);
        setParsedImportFlats([]);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Submit Bulk Import
  const handleExecuteImport = async () => {
    if (parsedImportFlats.length === 0 || importValidationErrors.length > 0) {
      return;
    }

    try {
      setIsImporting(true);
      const res = await apiFlats.bulkImport(parsedImportFlats, importMode);
      showToast(res.message || `Successfully imported ${res.importedCount} flats`, 'success');
      
      setShowImportModal(false);
      setImportFile(null);
      setParsedImportFlats([]);
      setImportValidationErrors([]);
      if (fileInputRef.current) fileInputRef.current.value = '';

      await loadFlats();
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'Import failed', 'danger');
      if (err.errors && Array.isArray(err.errors)) {
        setImportValidationErrors(err.errors);
      }
    } finally {
      setIsImporting(false);
    }
  };

  // Download Sample Excel Template
  const handleDownloadTemplate = () => {
    const sampleData = [
      { 'Flat Number': '101', 'Resident Name': 'Ravi Kumar', 'Maintenance Amount': 1500, 'Status': 'Active' },
      { 'Flat Number': '102', 'Resident Name': 'Suresh Kumar', 'Maintenance Amount': 1500, 'Status': 'Active' },
      { 'Flat Number': '103', 'Resident Name': 'Anil Kumar', 'Maintenance Amount': 1500, 'Status': 'Active' },
      { 'Flat Number': '104', 'Resident Name': 'Venkatesh Rao', 'Maintenance Amount': 1500, 'Status': 'Active' },
      { 'Flat Number': '201', 'Resident Name': 'Priya Sharma', 'Maintenance Amount': 1500, 'Status': 'Active' }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    worksheet['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 12 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Flats');
    XLSX.writeFile(workbook, 'Apartment_Flats_Import_Template.xlsx');
  };

  return (
    <div className="container-fluid p-3 p-md-4 max-w-6xl mx-auto">
      
      {/* Header bar with Action buttons */}
      <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white mb-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
          <div>
            <div className="text-uppercase text-primary fw-bold small mb-1" style={{ letterSpacing: '0.05em' }}>
              Master Records
            </div>
            <h2 className="fw-bold text-dark mb-0">Flats Management</h2>
            <p className="text-muted small mb-0 mt-1">
              Manage apartment flats, resident names, and default maintenance amounts ({flats.length} total units).
            </p>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-primary d-flex align-items-center gap-2 px-3 py-2 rounded-3 fw-semibold shadow-sm"
              onClick={handleOpenAddModal}
            >
              <Plus size={18} />
              <span>+ ADD FLAT</span>
            </button>

            <button
              type="button"
              className="btn btn-outline-success d-flex align-items-center gap-2 px-3 py-2 rounded-3 fw-semibold shadow-2xs"
              onClick={() => {
                setShowImportModal(true);
                setImportValidationErrors([]);
                setParsedImportFlats([]);
                setImportFile(null);
              }}
            >
              <FileSpreadsheet size={18} />
              <span>IMPORT EXCEL</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card border-0 shadow-sm rounded-4 p-3 bg-white mb-4">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-6">
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0 text-muted">
                <Search size={18} />
              </span>
              <input
                type="text"
                className="form-control bg-light border-start-0"
                placeholder="Search by flat number or resident name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button 
                  className="btn btn-light border-start-0" 
                  type="button" 
                  onClick={() => setSearchQuery('')}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="col-12 col-md-6 d-flex justify-content-md-end align-items-center gap-2">
            <span className="text-muted small fw-medium">Status:</span>
            <div className="btn-group" role="group">
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'All' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setStatusFilter('All')}
              >
                All ({flats.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'Active' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setStatusFilter('Active')}
              >
                Active ({flats.filter(f => (f.status || 'Active') === 'Active').length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'Inactive' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setStatusFilter('Inactive')}
              >
                Inactive ({flats.filter(f => f.status === 'Inactive').length})
              </button>
            </div>

            <button
              className="btn btn-outline-secondary btn-sm p-2 rounded-3 ms-1"
              title="Refresh Flats"
              onClick={loadFlats}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Flats Table */}
      <div className="card border-0 shadow-sm rounded-4 bg-white overflow-hidden mb-4">
        {isLoading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <div className="text-muted">Loading apartment flats master list...</div>
          </div>
        ) : filteredFlats.length === 0 ? (
          <div className="text-center py-5 px-3">
            <div className="p-3 bg-light rounded-circle d-inline-flex mb-3 text-muted">
              <Building size={32} />
            </div>
            <h5 className="fw-bold text-dark">No flats found</h5>
            <p className="text-muted small mb-3">
              {searchQuery || statusFilter !== 'All' 
                ? 'No flats match your filter criteria. Try clearing search filters.' 
                : 'No flats added yet. Click "+ ADD FLAT" or "IMPORT EXCEL" to setup your apartment flats.'}
            </p>
            {(!searchQuery && statusFilter === 'All') && (
              <button className="btn btn-primary btn-sm px-3 py-2 rounded-3" onClick={handleOpenAddModal}>
                + Add First Flat
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr className="text-muted small text-uppercase" style={{ letterSpacing: '0.04em' }}>
                  <th className="ps-4 py-3" style={{ width: '20%' }}>Flat Number</th>
                  <th className="py-3" style={{ width: '40%' }}>Resident Name</th>
                  <th className="py-3" style={{ width: '20%' }}>Maintenance Amount</th>
                  <th className="py-3" style={{ width: '10%' }}>Status</th>
                  <th className="pe-4 py-3 text-end" style={{ width: '10%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFlats.map((flat) => {
                  const id = flat._id || flat.id || '';
                  const maintAmount = flat.customMaintenanceAmount !== null && flat.customMaintenanceAmount !== undefined
                    ? flat.customMaintenanceAmount
                    : (settings.defaultMonthlyMaintenance || 1500);
                  const isActive = (flat.status || 'Active') === 'Active';

                  return (
                    <tr key={id}>
                      <td className="ps-4 py-3">
                        <span className="badge bg-light text-primary border font-monospace fs-6 fw-bold px-2.5 py-1 rounded-2">
                          {flat.flatNumber}
                        </span>
                      </td>

                      <td className="py-3">
                        <div className="fw-bold text-dark">{flat.residentName}</div>
                      </td>

                      <td className="py-3">
                        <span className="fw-semibold text-dark">
                          {currency}{Number(maintAmount).toLocaleString('en-IN')}
                        </span>
                        <span className="text-muted small"> / month</span>
                      </td>

                      <td className="py-3">
                        <span className={`badge ${isActive ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-secondary-subtle text-secondary border'}`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="pe-4 py-3 text-end">
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm px-2.5 py-1 rounded-2 d-inline-flex align-items-center gap-1"
                          onClick={() => handleOpenEditModal(flat)}
                          title="Edit Flat Details"
                        >
                          <Edit size={14} />
                          <span>EDIT</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD / EDIT FLAT MODAL */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              
              <div className="modal-header border-bottom px-4 py-3">
                <h5 className="modal-title fw-bold text-dark">
                  {editingFlat ? 'EDIT FLAT' : 'ADD FLAT'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                  aria-label="Close"
                />
              </div>

              <form onSubmit={handleSaveFlat}>
                <div className="modal-body p-4">
                  
                  {formError && (
                    <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3 rounded-3">
                      <AlertCircle size={18} className="flex-shrink-0" />
                      <div>{formError}</div>
                    </div>
                  )}

                  {/* 1. Flat Number */}
                  <div className="mb-3">
                    <label className="form-label text-muted small fw-semibold text-uppercase">
                      Flat Number <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control rounded-3"
                      placeholder="e.g. 101, 102, 201..."
                      value={formData.flatNumber}
                      onChange={(e) => setFormData({ ...formData, flatNumber: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>

                  {/* 2. Resident Name */}
                  <div className="mb-3">
                    <label className="form-label text-muted small fw-semibold text-uppercase">
                      Resident Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control rounded-3"
                      placeholder="e.g. Ravi Kumar"
                      value={formData.residentName}
                      onChange={(e) => setFormData({ ...formData, residentName: e.target.value })}
                      required
                    />
                  </div>

                  {/* 3. Maintenance Amount */}
                  <div className="mb-3">
                    <label className="form-label text-muted small fw-semibold text-uppercase">
                      Maintenance Amount ({currency})
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light">{currency}</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="form-control rounded-end-3"
                        placeholder={String(settings.defaultMonthlyMaintenance || 1500)}
                        value={formData.customMaintenanceAmount}
                        onChange={(e) => setFormData({ ...formData, customMaintenanceAmount: e.target.value })}
                      />
                    </div>
                    <small className="text-muted">Monthly maintenance charge for this flat unit.</small>
                  </div>

                  {/* 4. Status (Active / Inactive) */}
                  <div className="mb-3">
                    <label className="form-label text-muted small fw-semibold text-uppercase">
                      Status
                    </label>
                    <select
                      className="form-select rounded-3"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })}
                    >
                      <option value="Active">Active (Included in monthly billing)</option>
                      <option value="Inactive">Inactive (Archived / Not currently in society)</option>
                    </select>
                  </div>

                </div>

                <div className="modal-footer border-top px-4 py-3 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-light rounded-3 px-4 fw-semibold"
                    onClick={() => setShowModal(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary rounded-3 px-4 fw-semibold d-flex align-items-center gap-2"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{editingFlat ? 'UPDATE' : 'SAVE'}</span>
                    )}
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      )}

      {/* IMPORT EXCEL MODAL */}
      {showImportModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              
              <div className="modal-header border-bottom px-4 py-3">
                <div className="d-flex align-items-center gap-2">
                  <FileSpreadsheet className="text-success" size={22} />
                  <h5 className="modal-title fw-bold text-dark">
                    IMPORT FLATS FROM EXCEL / CSV
                  </h5>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowImportModal(false)}
                  aria-label="Close"
                />
              </div>

              <div className="modal-body p-4">
                
                {/* Instructions Box */}
                <div className="bg-light p-3 rounded-3 border mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="fw-bold small text-dark text-uppercase">
                      Required Columns in Excel / CSV:
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm px-2.5 py-1 rounded-2 d-inline-flex align-items-center gap-1"
                      onClick={handleDownloadTemplate}
                    >
                      <Download size={14} />
                      <span>Download Sample Template</span>
                    </button>
                  </div>
                  
                  <div className="table-responsive bg-white rounded-2 border">
                    <table className="table table-sm table-bordered mb-0 text-center small">
                      <thead className="table-light font-monospace">
                        <tr>
                          <th className="py-1">Flat Number</th>
                          <th className="py-1">Resident Name</th>
                          <th className="py-1">Maintenance Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>101</td>
                          <td>Ravi Kumar</td>
                          <td>1500</td>
                        </tr>
                        <tr>
                          <td>102</td>
                          <td>Suresh Kumar</td>
                          <td>1500</td>
                        </tr>
                        <tr>
                          <td>103</td>
                          <td>Anil Kumar</td>
                          <td>1500</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="text-muted small mt-2">
                    • Can import all 57 flats at once.<br />
                    • Does not delete existing monthly maintenance payments or historical records.<br />
                    • Automatically refreshes the Maintenance register after import.
                  </div>
                </div>

                {/* File Upload Input */}
                <div className="mb-3">
                  <label className="form-label text-muted small fw-semibold text-uppercase">
                    Select Excel (.xlsx, .xls) or CSV File
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="form-control rounded-3"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileChange}
                  />
                </div>

                {/* Import Mode Selection */}
                <div className="mb-3">
                  <label className="form-label text-muted small fw-semibold text-uppercase">
                    Import Mode
                  </label>
                  <div className="d-flex gap-4">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="importMode"
                        id="modeReplace"
                        checked={importMode === 'replace_all'}
                        onChange={() => setImportMode('replace_all')}
                      />
                      <label className="form-check-label small" htmlFor="modeReplace">
                        <strong>Replace Demo Flats:</strong> Set flats master list strictly to the uploaded file (Recommended to replace demo data)
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="importMode"
                        id="modeUpsert"
                        checked={importMode === 'upsert'}
                        onChange={() => setImportMode('upsert')}
                      />
                      <label className="form-check-label small" htmlFor="modeUpsert">
                        <strong>Append / Update:</strong> Add new flats and update matching flat numbers without removing other flats
                      </label>
                    </div>
                  </div>
                </div>

                {/* Validation Errors */}
                {importValidationErrors.length > 0 && (
                  <div className="alert alert-danger p-3 rounded-3 mb-3">
                    <div className="d-flex align-items-center gap-2 fw-bold text-danger mb-2">
                      <AlertCircle size={18} />
                      <span>Validation Errors ({importValidationErrors.length}):</span>
                    </div>
                    <ul className="mb-0 small ps-3">
                      {importValidationErrors.slice(0, 8).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {importValidationErrors.length > 8 && (
                        <li>...and {importValidationErrors.length - 8} more errors</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Preview Parsed Data */}
                {parsedImportFlats.length > 0 && importValidationErrors.length === 0 && (
                  <div className="alert alert-success p-3 rounded-3 mb-0">
                    <div className="d-flex align-items-center gap-2 fw-bold text-success mb-2">
                      <CheckCircle2 size={18} />
                      <span>Ready to Import: {parsedImportFlats.length} flats validated successfully</span>
                    </div>
                    
                    <div className="table-responsive bg-white rounded-2 border" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      <table className="table table-sm table-striped mb-0 small">
                        <thead className="table-light sticky-top">
                          <tr>
                            <th className="ps-2">#</th>
                            <th>Flat</th>
                            <th>Resident Name</th>
                            <th>Maintenance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedImportFlats.slice(0, 10).map((f, i) => (
                            <tr key={i}>
                              <td className="ps-2 text-muted">{i + 1}</td>
                              <td className="fw-bold text-primary">{f.flatNumber}</td>
                              <td>{f.residentName}</td>
                              <td>{currency}{f.customMaintenanceAmount || settings.defaultMonthlyMaintenance || 1500}</td>
                            </tr>
                          ))}
                          {parsedImportFlats.length > 10 && (
                            <tr>
                              <td colSpan={4} className="text-center text-muted fst-italic py-1">
                                + {parsedImportFlats.length - 10} more flats will be imported
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>

              <div className="modal-footer border-top px-4 py-3 d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-light rounded-3 px-4 fw-semibold"
                  onClick={() => setShowImportModal(false)}
                  disabled={isImporting}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn-success rounded-3 px-4 fw-semibold d-flex align-items-center gap-2"
                  onClick={handleExecuteImport}
                  disabled={isImporting || parsedImportFlats.length === 0 || importValidationErrors.length > 0}
                >
                  {isImporting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" />
                      <span>Importing {parsedImportFlats.length} Flats...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      <span>IMPORT {parsedImportFlats.length > 0 ? `${parsedImportFlats.length} FLATS` : ''}</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
