import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  colorScheme?: 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'purple';
  badgeText?: string;
  badgeType?: 'success' | 'danger' | 'warning' | 'info' | 'secondary';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  colorScheme = 'primary',
  badgeText,
  badgeType = 'info',
  onClick
}) => {
  const colorMap = {
    primary: { bg: '#eff6ff', iconBg: '#dbeafe', iconColor: '#2563eb', border: '#bfdbfe' },
    success: { bg: '#f0fdf4', iconBg: '#dcfce7', iconColor: '#16a34a', border: '#bbf7d0' },
    danger: { bg: '#fef2f2', iconBg: '#fee2e2', iconColor: '#dc2626', border: '#fecaca' },
    warning: { bg: '#fffbeb', iconBg: '#fef3c7', iconColor: '#d97706', border: '#fde68a' },
    info: { bg: '#f0f9ff', iconBg: '#e0f2fe', iconColor: '#0284c7', border: '#bae6fd' },
    purple: { bg: '#faf5ff', iconBg: '#f3e8ff', iconColor: '#9333ea', border: '#e9d5ff' }
  };

  const scheme = colorMap[colorScheme] || colorMap.primary;

  return (
    <div 
      className={`card h-100 transition-all ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      style={{
        transition: 'transform 0.15s ease, box-shadow 0.15s ease'
      }}
    >
      <div className="card-body p-3 p-md-3.5 d-flex flex-column justify-content-between">
        <div className="d-flex align-items-start justify-content-between mb-2">
          <span className="text-muted fw-semibold small text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.04em' }}>
            {title}
          </span>
          <div 
            className="rounded-3 p-2 d-flex align-items-center justify-content-center"
            style={{ backgroundColor: scheme.iconBg }}
          >
            <Icon size={20} style={{ color: scheme.iconColor }} />
          </div>
        </div>

        <div className="my-1">
          <h3 className="fw-bold mb-0 text-dark tracking-tight" style={{ fontSize: '1.65rem' }}>
            {value}
          </h3>
        </div>

        <div className="d-flex align-items-center justify-content-between mt-2 pt-1 border-top border-light">
          {subtitle && (
            <span className="text-muted small" style={{ fontSize: '0.78rem' }}>
              {subtitle}
            </span>
          )}
          {badgeText && (
            <span 
              className={`badge bg-${badgeType}-subtle text-${badgeType} border border-${badgeType}-subtle rounded-pill ms-auto`}
              style={{ fontSize: '0.72rem' }}
            >
              {badgeText}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
