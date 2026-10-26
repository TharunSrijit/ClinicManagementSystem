import React from 'react';
import { Outlet } from 'react-router-dom';
import { Hospital } from 'lucide-react';

export const AuthLayout = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% 30%, #e0f2fe 0%, #f8fafc 80%)',
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
              borderRadius: '16px',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
              color: 'white',
              boxShadow: 'var(--shadow-md)',
              marginBottom: '14px'
            }}
          >
            <Hospital size={30} strokeWidth={2} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em', margin: 0 }}>
            MedCore Clinic
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '6px' }}>
            Comprehensive Healthcare Management System
          </p>
        </div>

        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
