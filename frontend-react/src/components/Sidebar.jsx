import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Hospital,
  LayoutDashboard,
  CalendarDays,
  ListOrdered,
  UsersRound,
  ClipboardList,
  FileText,
  TestTube,
  Pill,
  CalendarPlus,
  UserRoundPlus,
  ReceiptText,
  Stethoscope,
  UserRoundCog,
  Microscope,
  FlaskConical,
  FileChartColumn,
  Receipt,
  History,
  Package,
  Award,
  PanelLeftClose,
  PanelLeftOpen,
  X
} from 'lucide-react';
import useAuth from '../hooks/useAuth';
import useSidebar from '../hooks/useSidebar';
import { ROLES } from '../utils/constants';

const NAV_ITEMS = {
  [ROLES.DOCTOR]: [
    { label: 'Dashboard', path: '/doctor', icon: LayoutDashboard },
    { label: 'My Appointments', path: '/doctor/appointments', icon: CalendarDays },
    { label: "Today's Queue", path: '/doctor/queue', icon: ListOrdered },
    { label: 'Patients', path: '/doctor/patients', icon: UsersRound },
    { label: 'Consultations', path: '/doctor/consultations', icon: ClipboardList },
    { label: 'Prescriptions', path: '/doctor/prescriptions', icon: FileText },
    { label: 'Lab Orders', path: '/doctor/lab-orders', icon: TestTube },
    { label: 'Reference Meds', path: '/doctor/medicines', icon: Pill }
  ],
  [ROLES.RECEPTIONIST]: [
    { label: 'Dashboard', path: '/receptionist', icon: LayoutDashboard },
    { label: 'Appointments', path: '/receptionist/appointments', icon: CalendarDays },
    { label: 'Book Appointment', path: '/receptionist/appointments/book', icon: CalendarPlus },
    { label: 'Token Queue', path: '/receptionist/tokens', icon: ListOrdered },
    { label: 'Patients', path: '/receptionist/patients', icon: UsersRound },
    { label: 'Register Patient', path: '/receptionist/patients/register', icon: UserRoundPlus },
    { label: 'Billing & Invoices', path: '/receptionist/billing', icon: ReceiptText }
  ],
  [ROLES.ADMIN]: [
    { label: 'System Overview', path: '/admin', icon: LayoutDashboard },
    { label: 'Users & Roles', path: '/admin/users', icon: UsersRound },
    { label: 'Doctors', path: '/admin/doctors', icon: Stethoscope },
    { label: 'Specializations', path: '/admin/specializations', icon: Award },
    { label: 'Staff Members', path: '/admin/staff', icon: UserRoundCog },
    { label: 'Medicines Master', path: '/admin/medicines', icon: Pill },
    { label: 'Lab Tests Master', path: '/admin/lab-tests', icon: Microscope }
  ],
  [ROLES.LAB_TECHNICIAN]: [
    { label: 'Dashboard', path: '/lab', icon: LayoutDashboard },
    { label: 'Lab Test Orders', path: '/lab/orders', icon: TestTube },
    { label: 'All Lab Tests', path: '/lab/all-tests', icon: FlaskConical },
    { label: 'Test Results', path: '/lab/results', icon: FileChartColumn },
    { label: 'Lab Billing', path: '/lab/billing', icon: Receipt }
  ],
  [ROLES.PHARMACIST]: [
    { label: 'Dashboard', path: '/pharmacy', icon: LayoutDashboard },
    { label: 'Prescriptions Queue', path: '/pharmacy/prescriptions', icon: ClipboardList },
    { label: 'Dispense History', path: '/pharmacy/dispenses', icon: History },
    { label: 'Medicine Stock', path: '/pharmacy/stock', icon: Package },
    { label: 'Pharmacy Billing', path: '/pharmacy/billing', icon: ReceiptText }
  ]
};

export const Sidebar = () => {
  const { user } = useAuth();
  const { isCollapsed, toggleCollapsed, isMobileOpen, closeMobileSidebar } = useSidebar();
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
    <>
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}
      <aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
        aria-label="Main Navigation"
      >
        <div className="sidebar-header">
          <div className="sidebar-brand-group">
            <div className="sidebar-brand-icon" title="MedCore CMS">
              <Hospital size={22} strokeWidth={2} color="var(--primary)" />
            </div>
            {!isCollapsed && (
              <div className="sidebar-brand-text">
                <div className="sidebar-brand-title">MedCore CMS</div>
                <div className="sidebar-brand-subtitle">Clinic Management</div>
              </div>
            )}
          </div>

          <div className="sidebar-header-actions">
            {/* Desktop collapse/expand toggle */}
            <button
              type="button"
              className="sidebar-toggle-btn desktop-only"
              onClick={toggleCollapsed}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!isCollapsed}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <PanelLeftOpen size={18} strokeWidth={2} />
              ) : (
                <PanelLeftClose size={18} strokeWidth={2} />
              )}
            </button>

            {/* Mobile drawer close button */}
            <button
              type="button"
              className="sidebar-close-btn mobile-only"
              onClick={closeMobileSidebar}
              aria-label="Close navigation menu"
              title="Close menu"
            >
              <X size={20} strokeWidth={2} />
            </button>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Sidebar Sections">
          {items.map((item) => {
            const isActive = activeItem?.path === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${isActive ? 'active' : ''}`}
                title={isCollapsed ? item.label : undefined}
                onClick={closeMobileSidebar}
                aria-current={isActive ? 'page' : undefined}
              >
                {Icon && <Icon size={20} strokeWidth={1.9} style={{ flexShrink: 0 }} />}
                {!isCollapsed && <span className="nav-label">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div
            className="user-profile-badge"
            title={isCollapsed ? `${user?.fullName || user?.username} (${user?.role})` : undefined}
          >
            <div className="user-avatar">
              {(user?.fullName || user?.username || 'U')[0].toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="user-info-text" style={{ overflow: 'hidden' }}>
                <div
                  className="user-info-name"
                  style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}
                >
                  {user?.fullName || user?.username}
                </div>
                <div className="user-info-role">{user?.role}</div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
