import React from 'react';
import { useApartment } from '../../context/ApartmentContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toast, hideToast } = useApartment();

  if (!toast.show) return null;

  const iconMap = {
    success: <CheckCircle2 size={18} className="text-success" />,
    danger: <AlertCircle size={18} className="text-danger" />,
    warning: <AlertTriangle size={18} className="text-warning" />,
    info: <Info size={18} className="text-primary" />
  };

  const bgMap = {
    success: 'border-success-subtle bg-white',
    danger: 'border-danger-subtle bg-white',
    warning: 'border-warning-subtle bg-white',
    info: 'border-primary-subtle bg-white'
  };

  return (
    <div 
      className="position-fixed bottom-0 end-0 p-3 z-3"
      style={{ maxWidth: '400px' }}
    >
      <div 
        className={`card shadow-lg border ${bgMap[toast.type]} rounded-3 animate-fade-in`}
        role="alert" 
        aria-live="assertive" 
        aria-atomic="true"
      >
        <div className="card-body py-2.5 px-3 d-flex align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-2.5">
            {iconMap[toast.type]}
            <span className="text-dark small fw-medium">{toast.message}</span>
          </div>
          <button 
            type="button" 
            className="btn-close btn-close-sm small" 
            onClick={hideToast}
            aria-label="Close"
          ></button>
        </div>
      </div>
    </div>
  );
};
