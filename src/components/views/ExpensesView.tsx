import React, { useState, useEffect } from 'react';
import { useApartment } from '../../context/ApartmentContext';
import { apiExpenses } from '../../services/api';
import { MonthlyExpense } from '../../types';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Calendar, 
  RefreshCw,
  IndianRupee,
  Receipt,
  X,
  Check
} from 'lucide-react';

export const ExpensesView: React.FC = () => {
  const { selectedMonth, setSelectedMonth, formatMonthDisplay, availableMonths, settings, triggerRefresh, showToast } = useApartment();
  
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Modal / Form state
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<MonthlyExpense | null>(null);
  const [expenseName, setExpenseName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>('');

  const loadExpenses = async () => {
    try {
      setIsLoading(true);
      const res = await apiExpenses.getMonthExpenses(selectedMonth);
      setExpenses(res.allExpenses || []);
    } catch (err: any) {
      showToast(err.message || 'Error loading expenses', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [selectedMonth]);

  const openAddModal = () => {
    setEditingExpense(null);
    setExpenseName('');
    setAmount('');
    // Default date to today's date if within the selected month, or 1st of the month
    const today = new Date().toISOString().split('T')[0];
    setDate(today.startsWith(selectedMonth) ? today : `${selectedMonth}-01`);
    setShowModal(true);
  };

  const openEditModal = (expense: MonthlyExpense) => {
    setEditingExpense(expense);
    setExpenseName(expense.name);
    setAmount(String(expense.amount));
    if (expense.paymentDate) {
      setDate(new Date(expense.paymentDate).toISOString().split('T')[0]);
    } else {
      setDate('');
    }
    setShowModal(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!expenseName.trim()) {
      showToast('Please enter an expense name', 'warning');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid expense amount', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        month: selectedMonth,
        name: expenseName.trim(),
        amount: numAmount,
        paymentDate: date ? new Date(date).toISOString() : new Date().toISOString(),
        category: 'Maintenance',
        expenseType: 'One-Time' as const
      };

      if (editingExpense) {
        const id = String(editingExpense._id || editingExpense.id);
        await apiExpenses.updateMonthlyExpense(id, payload);
        showToast('Expense updated successfully', 'success');
      } else {
        await apiExpenses.createMonthlyExpense(payload);
        showToast('Expense added successfully', 'success');
      }

      setShowModal(false);
      await loadExpenses();
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to save expense', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      await apiExpenses.deleteMonthlyExpense(id);
      showToast('Expense deleted successfully', 'success');
      await loadExpenses();
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete expense', 'danger');
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const currency = settings.currencySymbol || '₹';

  return (
    <div className="container-fluid p-3 p-md-4 max-w-5xl mx-auto pb-5">
      
      {/* Top Header Card */}
      <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white mb-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <h3 className="fw-bold text-dark mb-1">
              {formatMonthDisplay(selectedMonth)} Expenses
            </h3>
            <p className="text-muted small mb-0">
              Track salaries, lift repair, common electricity, water, or any other apartment expenses.
            </p>
          </div>

          <div className="d-flex align-items-center gap-2">
            <div className="d-flex align-items-center gap-2 bg-light px-3 py-2 rounded-3 border">
              <Calendar size={18} className="text-primary" />
              <label htmlFor="month-select-expense" className="small fw-semibold text-muted mb-0">
                Month:
              </label>
              <select
                id="month-select-expense"
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
              className="btn btn-primary btn-sm px-3 py-2 rounded-3 fw-bold d-flex align-items-center gap-1.5 shadow-sm"
              onClick={openAddModal}
            >
              <Plus size={18} />
              <span>ADD EXPENSE</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
        {isLoading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary mb-2" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <div className="text-muted">Loading expenses for {formatMonthDisplay(selectedMonth)}...</div>
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-5 p-4">
            <div className="p-3 bg-light rounded-circle d-inline-block mb-3 text-muted">
              <Receipt size={36} />
            </div>
            <h5 className="fw-bold text-dark mb-1">No expenses recorded for this month</h5>
            <p className="text-muted small mb-3">
              Click the button below to add your first expense (e.g., Watchman Salary, Lift AMC, Sweeper).
            </p>
            <button 
              className="btn btn-primary px-4 py-2 rounded-3 fw-semibold shadow-sm"
              onClick={openAddModal}
            >
              + ADD EXPENSE
            </button>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr className="text-muted small text-uppercase" style={{ letterSpacing: '0.04em' }}>
                    <th className="ps-4 py-3" style={{ width: '20%' }}>Date</th>
                    <th className="py-3" style={{ width: '45%' }}>Expense Name</th>
                    <th className="py-3" style={{ width: '20%' }}>Amount</th>
                    <th className="pe-4 py-3 text-end" style={{ width: '15%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => {
                    const id = String(expense._id || expense.id);
                    const formattedDate = expense.paymentDate 
                      ? new Date(expense.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '-';

                    return (
                      <tr key={id}>
                        <td className="ps-4 py-3 text-muted small">
                          {formattedDate}
                        </td>
                        <td className="py-3">
                          <span className="fw-bold text-dark fs-6">
                            {expense.name}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="fw-bold text-danger fs-6">
                            {currency}{Number(expense.amount).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="pe-4 py-3 text-end">
                          <div className="d-flex align-items-center justify-content-end gap-1">
                            <button
                              className="btn btn-light btn-sm text-secondary p-1.5 rounded-2"
                              onClick={() => openEditModal(expense)}
                              title="Edit expense"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              className="btn btn-light btn-sm text-danger p-1.5 rounded-2"
                              onClick={() => handleDeleteExpense(id, expense.name)}
                              title="Delete expense"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Expenses Banner at Bottom */}
            <div className="p-4 bg-light border-top d-flex justify-content-between align-items-center">
              <div>
                <span className="text-uppercase fw-bold text-muted small" style={{ letterSpacing: '0.05em' }}>
                  TOTAL EXPENSES ({expenses.length} items)
                </span>
              </div>
              <div className="fs-3 fw-bold text-dark">
                {currency}{totalExpenses.toLocaleString('en-IN')}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Expense Modal */}
      {showModal && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center z-3"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }}
        >
          <div className="bg-white rounded-4 shadow-lg p-4 w-100" style={{ maxWidth: '440px' }}>
            
            <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
              <h5 className="fw-bold text-dark mb-0">
                {editingExpense ? 'Edit Expense' : 'Add New Expense'}
              </h5>
              <button 
                type="button" 
                className="btn btn-light btn-sm rounded-circle p-1"
                onClick={() => setShowModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense}>
              
              <div className="mb-3">
                <label className="form-label fw-semibold small text-dark">
                  Expense Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control form-control-lg rounded-3 fs-6"
                  placeholder="e.g. Watchman Salary, Lift Repair, Sweeper"
                  value={expenseName}
                  onChange={(e) => setExpenseName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold small text-dark">
                  Amount ({currency}) <span className="text-danger">*</span>
                </label>
                <div className="input-group input-group-lg">
                  <span className="input-group-text bg-light text-muted fw-bold">
                    {currency}
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    className="form-control rounded-end-3 fs-6 fw-bold"
                    placeholder="e.g. 5000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label fw-semibold small text-muted">
                  Date (Optional)
                </label>
                <input
                  type="date"
                  className="form-control rounded-3"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="d-flex gap-2 justify-content-end">
                <button
                  type="button"
                  className="btn btn-light px-4 rounded-3 fw-semibold"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary px-4 rounded-3 fw-bold shadow-sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : (editingExpense ? 'Save Changes' : 'ADD EXPENSE')}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
