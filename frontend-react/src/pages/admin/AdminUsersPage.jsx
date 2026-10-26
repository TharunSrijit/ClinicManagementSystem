import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import useAuth from '../../hooks/useAuth';

export const AdminUsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('ALL');
  
  // Provision Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Edit Modal
  const [editingUser, setEditingUser] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    role: 'RECEPTIONIST',
    first_name: '',
    last_name: '',
    phone: '',
    password: ''
  });

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // In-flight action tracking
  const [actionId, setActionId] = useState(null);
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
    setTimeout(() => setFeedback({ message: '', type: '' }), 6000);
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

  const openEditUser = (user) => {
    setEditingUser(user);
    setEditForm({
      username: user.username || '',
      email: user.email || '',
      role: user.role || 'RECEPTIONIST',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      password: ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setSubmitting(true);
    try {
      const payload = {
        username: editForm.username.trim(),
        email: editForm.email.trim() || null,
        role: editForm.role,
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        phone: editForm.phone.trim() || null
      };
      if (editForm.password && editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }
      await adminService.updateUser(editingUser.id, payload);
      showFeedback(`Account '${payload.username}' updated successfully!`);
      setIsEditModalOpen(false);
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      console.error('Failed to update user:', err);
      showFeedback(err.message || 'Failed to update user account.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user) => {
    if (currentUser && currentUser.id === user.id && user.is_active) {
      showFeedback('Administrators cannot deactivate their own logged-in account.', 'danger');
      return;
    }
    setActionId(user.id);
    try {
      await adminService.setUserActive(user.id, !user.is_active);
      showFeedback(`User '${user.username}' ${user.is_active ? 'deactivated' : 'activated'} successfully.`);
      await loadUsers();
    } catch (err) {
      console.error('Failed to toggle active status:', err);
      showFeedback(err.message || 'Could not update user status.', 'danger');
    } finally {
      setActionId(null);
    }
  };

  const openDeleteModal = (user) => {
    setDeleteTarget(user);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await adminService.deleteUser(deleteTarget.id);
      showFeedback(`User account '${deleteTarget.username}' deleted permanently.`);
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      showFeedback(err.message || 'User deletion failed. Historical records prevent permanent deletion.', 'danger');
      setIsDeleteModalOpen(false);
    } finally {
      setDeleteLoading(false);
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
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          whiteSpace: 'nowrap',
          color: row.is_active ? 'var(--success)' : 'var(--danger)',
          fontWeight: 600,
          fontSize: '0.82rem'
        }}>
          <span aria-hidden="true">{row.is_active ? '●' : '○'}</span>
          <span>{row.is_active ? 'Active' : 'Inactive'}</span>
        </span>
      )
    },
    {
      header: 'Actions',
      key: 'actions',
      headerStyle: { minWidth: '260px' },
      render: (row) => (
        <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => openEditUser(row)}
            disabled={actionId === row.id}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => handleToggleActive(row)}
            disabled={actionId === row.id}
          >
            {actionId === row.id ? 'Saving...' : (row.is_active ? 'Deactivate' : 'Activate')}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => openDeleteModal(row)}
            disabled={actionId === row.id}
            style={{ color: 'var(--danger)', borderColor: 'var(--danger-light)' }}
          >
            Delete
          </button>
        </div>
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
        <div className={`alert alert-${feedback.type}`} style={{ marginBottom: '16px' }}>
          {feedback.message}
        </div>
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
            Refresh Directory
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
                pattern="[A-Za-z0-9]+"
                title="Username must contain letters and numbers only (no spaces or symbols)."
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="e.g. drsharma01"
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
                pattern={form.role === 'DOCTOR'
                  ? '([Dd][Rr]\\. ?)?[A-Za-z]+( [A-Za-z]+)*'
                  : '(?![Dd][Rr]\\b)[A-Za-z]+( [A-Za-z]+)*'}
                title={form.role === 'DOCTOR'
                  ? 'First name must be letters only. Doctors may start with Dr. (for example, Dr. Rajesh).'
                  : 'First name must contain letters only and must not be a title like Dr.'}
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                placeholder={form.role === 'DOCTOR' ? 'e.g. Dr. Rajesh' : 'e.g. Rajesh'}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input
                type="text"
                className="form-control"
                pattern="[A-Za-z ]+"
                title="Use letters and spaces only."
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

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingUser(null);
        }}
        title={`Edit User Account: ${editingUser?.username || ''}`}
      >
        <form onSubmit={handleUpdateUser}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Username *</label>
              <input
                type="text"
                className="form-control"
                required
                pattern="[A-Za-z0-9]+"
                title="Username must contain letters and numbers only (no spaces or symbols)."
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Role *</label>
              <select
                className="form-select"
                required
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
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
                pattern={editForm.role === 'DOCTOR'
                  ? '([Dd][Rr]\\. ?)?[A-Za-z]+( [A-Za-z]+)*'
                  : '(?![Dd][Rr]\\b)[A-Za-z]+( [A-Za-z]+)*'}
                title={editForm.role === 'DOCTOR'
                  ? 'First name must be letters only. Doctors may start with Dr. (for example, Dr. Rajesh).'
                  : 'First name must contain letters only and must not be a title like Dr.'}
                value={editForm.first_name}
                onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input
                type="text"
                className="form-control"
                pattern="[A-Za-z ]+"
                title="Use letters and spaces only."
                value={editForm.last_name}
                onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="e.g. user@clinic.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                className="form-control"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="10-digit mobile number"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reset Password (Optional)</label>
            <input
              type="password"
              className="form-control"
              value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              placeholder="Leave blank to keep existing password"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingUser(null);
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!deleteLoading) {
            setIsDeleteModalOpen(false);
            setDeleteTarget(null);
          }
        }}
        title="Confirm Account Deletion"
      >
        <div>
          <p style={{ marginBottom: '16px', color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.5' }}>
            Are you sure you want to permanently delete account{' '}
            <strong style={{ color: 'var(--danger)' }}>{deleteTarget?.username}</strong> ({deleteTarget?.role})?
          </p>
          <div style={{
            background: 'var(--warning-light)',
            color: '#854d0e',
            padding: '12px 16px',
            borderRadius: '6px',
            fontSize: '0.85rem',
            marginBottom: '20px',
            lineHeight: '1.4'
          }}>
            <strong>Important Safety Rule:</strong> If this user is referenced in clinical records (such as appointments, consultations, prescriptions, dispenses, or lab orders), permanent deletion is strictly blocked to preserve medical and billing history. In such cases, please deactivate the account instead.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeleteTarget(null);
              }}
              disabled={deleteLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleConfirmDelete}
              disabled={deleteLoading}
              style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}
            >
              {deleteLoading ? 'Deleting...' : 'Permanently Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminUsersPage;