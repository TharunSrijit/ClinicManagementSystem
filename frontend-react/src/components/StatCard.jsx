import React from 'react';

export const StatCard = ({ title, value, subtitle, icon, trend, color = 'primary' }) => {
  const Icon = icon;

  return (
    <div className={`card stat-card stat-card-${color}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {title}
          </span>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '6px', lineHeight: 1.2 }}>
            {value != null ? value : '-'}
          </div>
          {subtitle && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {subtitle}
            </div>
          )}
        </div>
        {Icon && (
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)',
            flexShrink: 0
          }}>
            <Icon size={22} strokeWidth={1.9} aria-hidden="true" />
          </div>
        )}
      </div>
      {trend && (
        <div style={{ marginTop: '12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {typeof trend === 'object' ? (
            <span style={{ color: trend.isPositive ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
              {trend.isPositive ? '↑' : '↓'} {trend.text}
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
              {trend}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StatCard;
