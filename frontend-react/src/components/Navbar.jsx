import React from 'react';
import { LogOut, Menu } from 'lucide-react';
import useAuth from '../hooks/useAuth';
import useSidebar from '../hooks/useSidebar';
import Badge from './Badge';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const { toggleMobileSidebar } = useSidebar();
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={toggleMobileSidebar}
          aria-label="Open navigation menu"
          title="Open menu"
        >
          <Menu size={22} strokeWidth={2} />
        </button>
        <div className="topbar-date-display">
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Today is</span>
          <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{today}</div>
        </div>
      </div>

      <div className="topbar-right">
        {user && (
          <div className="topbar-user-badge" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Badge status={user.role}>{user.role}</Badge>
            <div className="topbar-user-info" style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                {user.fullName || user.username}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                @{user.username}
              </div>
            </div>
          </div>
        )}

        <button onClick={logout} className="btn-logout" title="Sign out of system">
          <LogOut size={16} strokeWidth={2} />
          <span className="btn-logout-label">Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;
