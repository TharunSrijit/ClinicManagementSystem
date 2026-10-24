import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';

export const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'RECEPTIONIST',
    first_name: '',
    last_name: ''
  });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load users:', err);
      showFeedback('Could not load user accounts.', 'danger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminService.createUser(form);
      showFeedback(`User account '${form.username}' provisioned successfully!`);
      setIsModalOpen(false);
      setForm({
        username: '',
        email: '',
        password: '',
        role: 'RECEPTIONIST',
        first_name: '',
        last_name: ''
      });
      await loadUsers();
    } catch (err) {
      console.error('Failed to create user:', err);
      showFeedback(err.message || 'User creation failed.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter === 'ALL') return true;
    return u.role === roleFilter;
  });

  const columns = [
    {
      header: 'ID',
      key: 'id',
      render: (row) => <span style={{ fontWeight: 600 }}>#{row.id}</span>
    },
    {
      header: 'Username',
      key: 'username',
      render: (row) => <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{row.username}</span>
    },
    {
      header: 'Full Name',
      key: 'first_name',
      render: (row) => <span>{row.first_name || row.last_name ? `${row.first_name || ''} ${row.last_name || ''}`.trim() : '—'}</span>
    },
    {
      header: 'Role',
      key: 'role',
      render: (row) => <Badge status={row.role} />
    },
    {
      header: 'Email Address',
      key: 'email',
      render: (row) => <span>{row.email || '—'}</span>
    },
    {
      header: 'Status',
      key: 'is_active',
      render: (row) => (
        <span style={{ color: row.is_active ? 'var(--success)' : 'var(--danger)', fontWeight: 600, fontSize: '0.82rem' }}>
          {row.is_active ? '● Active' : '○ Inactive'}
        </span>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Users & Role Access Management</h1>
          <p className="page-subtitle">Configure clinic system access credentials and security roles.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          + Provision New User
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      {/* Filter Toolbar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div className="filter-toolbar" style={{ margin: 0 }}>
          <div className="filter-group">
            <div>
              <label className="form-label">Filter by Role</label>
              <select
                className="form-select"
                style={{ width: '200px' }}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="ALL">All Roles ({users.length})</option>
                <option value="ADMIN">Administrators</option>
                <option value="DOCTOR">Doctors</option>
                <option value="RECEPTIONIST">Receptionists</option>
                <option value="LAB_TECHNICIAN">Lab Technicians</option>
                <option value="PHARMACIST">Pharmacists</option>
              </select>
            </div>
          </div>

          <button className="btn btn-outline btn-sm" onClick={loadUsers}>
            🔄 Refresh Directory
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredUsers}
        loading={loading}
        emptyMessage="No users found for this role."
      />

      {/* Provision User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Provision New Clinic User"
      >
        <form onSubmit={handleCreateUser}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Username *</label>
              <input
                type="text"
                className="form-control"
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="e.g. dr_sharma"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Role *</label>
              <select
                className="form-select"
                required
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="DOCTOR">Doctor</option>
                <option value="RECEPTIONIST">Receptionist</option>
                <option value="LAB_TECHNICIAN">Lab Technician</option>
                <option value="PHARMACIST">Pharmacist</option>
                <option value="ADMIN">System Administrator</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input
                type="text"
                className="form-control"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                placeholder="e.g. Rajesh"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input
                type="text"
                className="form-control"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                placeholder="e.g. Sharma"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input
              type="email"
              className="form-control"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. rajesh@clinic.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Initial Password *</label>
            <input
              type="password"
              className="form-control"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Enter secure password"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create User Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminUsersPage;
