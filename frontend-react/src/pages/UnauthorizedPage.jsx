import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import useAuth from '../hooks/useAuth';

export const UnauthorizedPage = () => {
  const { user, logout } = useAuth();

  return (
    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--danger)' }}>
        <ShieldAlert size={48} strokeWidth={1.5} />
      </div>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
        Access Restricted
      </h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: '450px', margin: '12px auto 28px' }}>
        Your account role ({user?.role || 'Guest'}) does not have permission to view this section of the clinic system.
      </p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <Link to="/" className="btn btn-primary">
          Return to Dashboard
        </Link>
        <button onClick={logout} className="btn btn-outline">
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
