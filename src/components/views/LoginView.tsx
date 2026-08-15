import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Building2, Lock, User, ShieldCheck, ArrowRight } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
const [username, setUsername] = useState('');
const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ username, password });
    } catch (err: any) {
      setError(err.message || 'Invalid admin credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-slate-100 p-3" style={{ backgroundColor: '#f1f5f9' }}>
      <div className="card border-0 shadow-lg rounded-4 overflow-hidden" style={{ maxWidth: '440px', width: '100%' }}>
        
        {/* Header Banner */}
        <div className="bg-primary text-white p-4 text-center">
          <div className="bg-white text-primary rounded-circle d-inline-flex p-3 mb-2 shadow-sm">
            <Building2 size={32} />
          </div>
          <h4 className="fw-bold mb-1">Apartment Management</h4>
          <p className="text-white-50 small mb-0">Administrator Portal & Financial Ledger</p>
        </div>

        {/* Login Form */}
        <div className="card-body p-4 p-md-4.5">
          <div className="d-flex align-items-center gap-2 mb-3 text-muted small">
            <ShieldCheck size={16} className="text-success" />
            <span>Secure Session-Based Admin Authentication</span>
          </div>

          {error && (
            <div className="alert alert-danger py-2 px-3 small rounded-3 mb-3 d-flex align-items-center gap-2">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small fw-semibold text-muted">Admin Username</label>
              <div className="input-group">
                <span className="input-group-text bg-light"><User size={16} className="text-muted" /></span>
               <input
             type="text"
            className="form-control"
             placeholder="Enter admin username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
              />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-semibold text-muted">Password</label>
              <div className="input-group">
                <span className="input-group-text bg-light"><Lock size={16} className="text-muted" /></span>
                <input
  type="password"
  className="form-control"
  placeholder="Enter password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  autoComplete="current-password"
  required
/>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100 py-2.5 rounded-3 fw-semibold d-flex align-items-center justify-content-center gap-2"
              disabled={isSubmitting}
            >
              <span>{isSubmitting ? 'Verifying...' : 'Login to Dashboard'}</span>
              <ArrowRight size={18} />
            </button>
          </form>

         

        </div>

      </div>
    </div>
  );
};
