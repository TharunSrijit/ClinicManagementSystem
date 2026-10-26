import React from 'react';
import { LogOut } from 'lucide-react';
import useAuth from '../hooks/useAuth';
import Badge from './Badge';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Today is</span>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>{today}</div>
        </div>
      </div>

      <div className="topbar-right">
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Badge status={user.role}>{user.role}</Badge>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                {user.fullName || user.username}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                @{user.username}
              </div>
            </div>
          </div>
        )}

        <button onClick={logout} className="btn-logout" title="Sign out of system">
          <LogOut size={16} strokeWidth={2} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;
