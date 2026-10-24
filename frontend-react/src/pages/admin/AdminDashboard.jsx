import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { formatCurrency } from '../../utils/formatters';

export const AdminDashboard = () => {
  // Navigation Tabs: 'overview' | 'users' | 'doctors' | 'medicines' | 'labTests'
  const [activeTab, setActiveTab] = useState('overview');

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [labTests, setLabTests] = useState([]);
  const [loading, setLoading] = useState(true);

  // User Creation Modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: 'DemoPassword123!',
    role: 'RECEPTIONIST',
    first_name: '',
    last_name: '',
    phone: ''
  });
  const [submittingUser, setSubmittingUser] = useState(false);

  // Feedback Banner
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, usersData, docsData, medsData, testsData] = await Promise.all([
        adminService.getDashboardStats().catch(() => null),
        adminService.getUsers().catch(() => []),
        adminService.getDoctors().catch(() => []),
        adminService.getMedicines().catch(() => []),
        adminService.getLabTests().catch(() => [])
      ]);
      setStats(statsData);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setDoctors(Array.isArray(docsData) ? docsData : []);
      setMedicines(Array.isArray(medsData) ? medsData : []);
      setLabTests(Array.isArray(testsData) ? testsData : []);
    } catch (err) {
      console.error('Failed to load admin records:', err);
      showFeedback('Could not fetch administrator records from server.', 'danger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  // Handle User Account Creation
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSubmittingUser(true);
    try {
      await adminService.createUser(userForm);
      setIsUserModalOpen(false);
      showFeedback(`User account @${userForm.username} (${userForm.role}) created successfully!`);
      setUserForm({
        username: '',
        email: '',
        password: 'DemoPassword123!',
        role: 'RECEPTIONIST',
        first_name: '',
        last_name: '',
        phone: ''
      });
      await loadAdminData();
    } catch (err) {
      showFeedback(`User creation failed: ${err.message}`, 'danger');
    } finally {
      setSubmittingUser(false);
    }
  };

  const totalPatients = stats?.total_patients ?? 0;
  const totalDoctors = doctors.length || stats?.total_doctors || 0;
  const totalStaff = users.length;
  const pendingInvoices = (stats?.pending_consultation_invoices || 0) + (stats?.pending_lab_invoices || 0) + (stats?.pending_pharmacy_invoices || 0);

  const userColumns = [
    {
      header: 'ID',
      key: 'id',
      render: (u) => <span style={{ fontWeight: 600 }}>#{u.id}</span>
    },
    {
      header: 'Username',
      key: 'username',
      render: (u) => <strong>@{u.username}</strong>
    },
    {
      header: 'Full Name',
      key: 'name',
      render: (u) => u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || '-'
    },
    {
      header: 'Role Privilege',
      key: 'role',
      render: (u) => <Badge status={u.role}>{u.role}</Badge>
    },
    {
      header: 'Email / Contact',
      key: 'email',
      render: (u) => u.email || u.phone || '-'
    },
    {
      header: 'Account Status',
      key: 'is_active',
      render: (u) => (
        <Badge variant={u.is_active !== false ? 'success' : 'danger'}>
          {u.is_active !== false ? 'Active' : 'Inactive'}
        </Badge>
      )
    }
  ];

  const doctorColumns = [
    {
      header: 'Doctor ID',
      key: 'doctor_id',
      render: (d) => <span style={{ fontWeight: 600 }}>{d.doctor_id || `#${d.id}`}</span>
    },
    {
      header: 'Doctor Name',
      key: 'full_name',
      render: (d) => (
        <div>
          <div style={{ fontWeight: 600 }}>{d.full_name || d.name || `Dr. #${d.id}`}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{d.qualification || 'MBBS'}</div>
        </div>
      )
    },
    {
      header: 'Specialization',
      key: 'specialization',
      render: (d) => <Badge variant="primary">{d.specialization || 'General Physician'}</Badge>
    },
    {
      header: 'Consultation Fee',
      key: 'consultation_fee',
      render: (d) => <span style={{ fontWeight: 600 }}>{formatCurrency(d.consultation_fee || 500)}</span>
    },
    {
      header: 'Duty Hours',
      key: 'hours',
      render: (d) => `${d.available_from || '09:00'} – ${d.available_to || '17:00'} (${d.slot_minutes || 15}m slots)`
    }
  ];

  const medicineColumns = [
    {
      header: 'Code / ID',
      key: 'id',
      render: (m) => <span style={{ fontWeight: 600 }}>{m.medicine_code || `#${m.id}`}</span>
    },
    {
      header: 'Medicine Name',
      key: 'medicine_name',
      render: (m) => <strong>{m.medicine_name}</strong>
    },
    {
      header: 'Generic Name',
      key: 'generic_name',
      render: (m) => m.generic_name || '-'
    },
    {
      header: 'Category',
      key: 'category',
      render: (m) => <Badge variant="info">{m.category || 'Pharmaceutical'}</Badge>
    },
    {
      header: 'Unit Price',
      key: 'unit_price',
      render: (m) => formatCurrency(m.unit_price || 0)
    }
  ];

  const labTestColumns = [
    {
      header: 'Test Code',
      key: 'test_code',
      render: (t) => <span style={{ fontWeight: 600 }}>{t.test_code || `TEST-${t.id}`}</span>
    },
    {
      header: 'Test Name',
      key: 'test_name',
      render: (t) => <strong>{t.test_name}</strong>
    },
    {
      header: 'Sample Type',
      key: 'sample_type',
      render: (t) => t.sample_type || 'Blood'
    },
    {
      header: 'Standard Fee',
      key: 'price',
      render: (t) => formatCurrency(t.price || t.test_fee || 0)
    }
  ];

  return (
    <div>
      {/* Feedback Banner */}
      {feedback.message && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '20px',
            background: feedback.type === 'danger' ? 'var(--danger-light)' : 'var(--success-light)',
            color: feedback.type === 'danger' ? 'var(--danger)' : 'var(--success)',
            border: `1px solid ${feedback.type === 'danger' ? '#fecaca' : '#bbf7d0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback({ message: '', type: '' })} style={{ fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Clinic Administration & Governance</h1>
          <p className="page-subtitle">Central oversight of staff credentials, clinicians directory, master catalogs, and revenue telemetry.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setIsUserModalOpen(true)} className="btn btn-primary">
            👤 Create User
          </button>
          <button onClick={loadAdminData} className="btn btn-outline">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid-stats">
        <StatCard
          title="Staff & User Accounts"
          value={totalStaff}
          subtitle="System operators"
          icon="👥"
          color="info"
        />
        <StatCard
          title="On-Duty Doctors"
          value={totalDoctors}
          subtitle="Clinical specialists"
          icon="👨‍⚕️"
          color="primary"
        />
        <StatCard
          title="Registered Patients"
          value={totalPatients}
          subtitle="In clinic database"
          icon="🏥"
          color="success"
        />
        <StatCard
          title="Pending Invoices"
          value={pendingInvoices}
          subtitle={`Low stock items: ${stats?.low_stock_items ?? 0}`}
          icon="💰"
          color="warning"
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '24px', gap: '24px' }}>
        {[
          { key: 'overview', label: 'System Overview', icon: '📊' },
          { key: 'users', label: `Staff & Users (${users.length})`, icon: '👥' },
          { key: 'doctors', label: `Doctors Directory (${doctors.length})`, icon: '👨‍⚕️' },
          { key: 'medicines', label: `Medicine Master (${medicines.length})`, icon: '💊' },
          { key: 'labTests', label: `Lab Tests Master (${labTests.length})`, icon: '🔬' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '12px 6px',
              fontSize: '0.95rem',
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.key ? '3px solid var(--primary)' : '3px solid transparent',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '14px' }}>
              Staff Roles Breakdown
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Administrators', count: stats?.total_admins || users.filter(u => u.role === 'ADMIN').length, icon: '🛡️' },
                { label: 'Physicians / Doctors', count: stats?.total_doctors || users.filter(u => u.role === 'DOCTOR').length, icon: '🩺' },
                { label: 'Receptionists', count: stats?.total_receptionists || users.filter(u => u.role === 'RECEPTIONIST').length, icon: '📋' },
                { label: 'Lab Technicians', count: stats?.total_lab_technicians || users.filter(u => u.role === 'LAB_TECHNICIAN').length, icon: '🧪' },
                { label: 'Pharmacists', count: stats?.total_pharmacists || users.filter(u => u.role === 'PHARMACIST').length, icon: '💊' }
              ].map((roleItem, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-page)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>{roleItem.icon}</span>
                    <span style={{ fontWeight: 500 }}>{roleItem.label}</span>
                  </div>
                  <strong style={{ fontSize: '1.1rem' }}>{roleItem.count}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '14px' }}>
              Monthly Revenue Aggregation
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Consultation Department</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {formatCurrency(stats?.revenue_this_month?.consultation || 0)}
                </div>
              </div>

              <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Diagnostic Laboratory</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--info)' }}>
                  {formatCurrency(stats?.revenue_this_month?.lab || 0)}
                </div>
              </div>

              <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Pharmacy Dispenses</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)' }}>
                  {formatCurrency(stats?.revenue_this_month?.pharmacy || 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Users List */}
      {activeTab === 'users' && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '18px' }}>
            Registered System Accounts & Credentials
          </h2>
          <DataTable
            columns={userColumns}
            data={users}
            loading={loading}
            emptyMessage="No user accounts registered."
          />
        </div>
      )}

      {/* Tab 3: Doctors Directory */}
      {activeTab === 'doctors' && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '18px' }}>
            Healthcare Specialists & Duty Roster
          </h2>
          <DataTable
            columns={doctorColumns}
            data={doctors}
            loading={loading}
            emptyMessage="No doctors configured in system."
          />
        </div>
      )}

      {/* Tab 4: Medicines Master */}
      {activeTab === 'medicines' && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '18px' }}>
            Pharmaceutical Master Catalog
          </h2>
          <DataTable
            columns={medicineColumns}
            data={medicines}
            loading={loading}
            emptyMessage="No medicines registered in catalog."
          />
        </div>
      )}

      {/* Tab 5: Lab Tests Master */}
      {activeTab === 'labTests' && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '18px' }}>
            Diagnostic Pathology Test Catalog
          </h2>
          <DataTable
            columns={labTestColumns}
            data={labTests}
            loading={loading}
            emptyMessage="No lab tests registered in catalog."
          />
        </div>
      )}

      {/* User Creation Modal */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        title="Provision New Staff Account"
        maxWidth="540px"
      >
        <form onSubmit={handleCreateUser}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Username *</label>
              <input
                type="text"
                required
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                placeholder="e.g. nurse_mary"
                style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Account Role *</label>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'white' }}
              >
                <option value="RECEPTIONIST">Receptionist</option>
                <option value="DOCTOR">Doctor</option>
                <option value="LAB_TECHNICIAN">Lab Technician</option>
                <option value="PHARMACIST">Pharmacist</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>First Name</label>
              <input
                type="text"
                value={userForm.first_name}
                onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Last Name</label>
              <input
                type="text"
                value={userForm.last_name}
                onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Email Address</label>
              <input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Phone Number</label>
              <input
                type="tel"
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Initial Temporary Password *</label>
            <input
              type="password"
              required
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsUserModalOpen(false)}
              disabled={submittingUser}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submittingUser}
            >
              {submittingUser ? 'Provisioning...' : 'Provision User Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
