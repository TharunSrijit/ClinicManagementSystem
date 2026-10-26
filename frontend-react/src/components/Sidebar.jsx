import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { ROLES } from '../utils/constants';

const NAV_ITEMS = {
  [ROLES.DOCTOR]: [
    { label: 'Dashboard', path: '/doctor', icon: '📊' },
    { label: 'My Appointments', path: '/doctor/appointments', icon: '📅' },
    { label: "Today's Queue", path: '/doctor/queue', icon: '👥' },
    { label: 'Patients', path: '/doctor/patients', icon: '👤' },
    { label: 'Consultations', path: '/doctor/consultations', icon: '🩺' },
    { label: 'Prescriptions', path: '/doctor/prescriptions', icon: '📋' },
    { label: 'Lab Orders', path: '/doctor/lab-orders', icon: '🧪' },
    { label: 'Reference Meds', path: '/doctor/medicines', icon: '💊' }
  ],
  [ROLES.RECEPTIONIST]: [
    { label: 'Dashboard', path: '/receptionist', icon: '📊' },
    { label: 'Appointments', path: '/receptionist/appointments', icon: '📅' },
    { label: 'Book Appointment', path: '/receptionist/appointments/book', icon: '➕' },
    { label: 'Token Queue', path: '/receptionist/tokens', icon: '🎫' },
    { label: 'Patients', path: '/receptionist/patients', icon: '👥' },
    { label: 'Register Patient', path: '/receptionist/patients/register', icon: '📝' },
    { label: 'Billing & Invoices', path: '/receptionist/billing', icon: '🧾' }
  ],
  [ROLES.ADMIN]: [
    { label: 'System Overview', path: '/admin', icon: '📊' },
    { label: 'Users & Roles', path: '/admin/users', icon: '👥' },
    { label: 'Doctors', path: '/admin/doctors', icon: '👨‍⚕️' },
    { label: 'Staff Members', path: '/admin/staff', icon: '👔' },
    { label: 'Medicines Master', path: '/admin/medicines', icon: '💊' },
    { label: 'Lab Tests Master', path: '/admin/lab-tests', icon: '🔬' }
  ],
  [ROLES.LAB_TECHNICIAN]: [
    { label: 'Dashboard', path: '/lab', icon: '📊' },
    { label: 'Lab Test Orders', path: '/lab/orders', icon: '🧪' },
    { label: 'Test Results', path: '/lab/results', icon: '📝' },
    { label: 'Lab Billing', path: '/lab/billing', icon: '💳' }
  ],
  [ROLES.PHARMACIST]: [
    { label: 'Dashboard', path: '/pharmacy', icon: '📊' },
    { label: 'Prescriptions Queue', path: '/pharmacy/prescriptions', icon: '📋' },
    { label: 'Dispense History', path: '/pharmacy/dispenses', icon: '💊' },
    { label: 'Medicine Stock', path: '/pharmacy/stock', icon: '📦' },
    { label: 'Pharmacy Billing', path: '/pharmacy/billing', icon: '🧾' }
  ]
};

export const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role;
  const items = NAV_ITEMS[role] || [];

  const currentPath = location.pathname.replace(/\/+$/, '') || '/';

  // 1. Exact match takes highest priority
  let activeItem = items.find((item) => item.path === currentPath);

  // 2. If no exact match (e.g. nested /patients/:id), match the longest prefix
  if (!activeItem) {
    const prefixMatches = items.filter(
      (item) => currentPath.startsWith(item.path + '/')
    );
    if (prefixMatches.length > 0) {
      activeItem = prefixMatches.reduce((longest, curr) =>
        curr.path.length > longest.path.length ? curr : longest
      );
    }
  }

  // 3. Handle known route aliases
  if (!activeItem && currentPath === '/receptionist/queue') {
    activeItem = items.find((item) => item.path === '/receptionist/tokens');
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand-icon">🏥</div>
        <div>
          <div className="sidebar-brand-title">MedCore CMS</div>
          <div className="sidebar-brand-subtitle">Clinic Management</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => {
          const isActive = activeItem?.path === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${isActive ? 'active' : ''}`}
            >
              <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile-badge">
          <div className="user-avatar">
            {(user?.fullName || user?.username || 'U')[0].toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div className="user-info-name" style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user?.fullName || user?.username}
            </div>
            <div className="user-info-role">{user?.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
