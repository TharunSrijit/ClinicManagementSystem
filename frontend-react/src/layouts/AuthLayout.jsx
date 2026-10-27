import React from 'react';
import { Outlet } from 'react-router-dom';
import { Hospital } from 'lucide-react';

export const AuthLayout = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--app-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              border: '1px solid var(--border)',
              marginBottom: '14px'
            }}
          >
            <Hospital size={30} strokeWidth={2} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
            MedCore Clinic
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>
            Comprehensive Healthcare Management System
          </p>
        </div>

        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
