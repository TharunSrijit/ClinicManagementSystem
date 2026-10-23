import React from 'react';
import { NavLink } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { ROLES } from '../utils/constants';

const NAV_ITEMS = {
  [ROLES.DOCTOR]: [
    { label: 'Appointments', path: '/doctor', icon: '📅' },
    { label: 'Patient Queue', path: '/doctor/queue', icon: '👥' },
    { label: 'Consultations', path: '/doctor/consultations', icon: '🩺' },
    { label: 'Lab Orders', path: '/doctor/lab-orders', icon: '🧪' },
    { label: 'Reference Meds', path: '/doctor/medicines', icon: '💊' }
  ],
  [ROLES.RECEPTIONIST]: [
    { label: 'Appointments', path: '/receptionist', icon: '📅' },
    { label: 'Token Queue', path: '/receptionist/tokens', icon: '🎫' },
    { label: 'Patients', path: '/receptionist/patients', icon: '👤' },
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
    { label: 'Lab Test Orders', path: '/lab', icon: '🧪' },
    { label: 'Test Results', path: '/lab/results', icon: '📝' },
    { label: 'Lab Billing', path: '/lab/billing', icon: '💳' }
  ],
  [ROLES.PHARMACIST]: [
    { label: 'Prescriptions Queue', path: '/pharmacy', icon: '📋' },
    { label: 'Dispense History', path: '/pharmacy/dispenses', icon: '💊' },
    { label: 'Medicine Stock', path: '/pharmacy/stock', icon: '📦' }
  ]
};

export const Sidebar = () => {
  const { user } = useAuth();
  const role = user?.role;
  const items = NAV_ITEMS[role] || [];

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
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path.split('/').length <= 2}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
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
