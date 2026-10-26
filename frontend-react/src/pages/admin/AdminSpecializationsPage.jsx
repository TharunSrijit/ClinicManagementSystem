import React, { useState, useEffect, useCallback, useMemo } from 'react';
import adminService from '../../services/adminService';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';

export const AdminSpecializationsPage = () => {
  const [specializations, setSpecializations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState(null);
  const [specForm, setSpecForm] = useState({ name: '', description: '', is_active: true });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadSpecializations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getSpecializations();
      setSpecializations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load specializations:', err);
      showFeedback('Could not fetch doctor specializations.', 'danger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSpecializations();
  }, [loadSpecializations]);

  const handleOpenAddModal = () => {
    setEditingSpec(null);
    setSpecForm({ name: '', description: '', is_active: true });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (spec) => {
    setEditingSpec(spec);
    setSpecForm({
      name: spec.name,
      description: spec.description || '',
      is_active: spec.is_active
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (!submitting) {
      setIsModalOpen(false);
      setEditingSpec(null);
      setFormError('');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const trimmedName = specForm.name.trim();

    if (!trimmedName) {
      setFormError('Specialization name cannot be empty.');
      return;
    }

    if (trimmedName.length < 2) {
      setFormError('Specialization name must be at least 2 characters.');
      return;
    }

    // Client-side duplicate check (ignoring self if editing)
    const isDuplicate = specializations.some(
      (s) =>
        (!editingSpec || s.id !== editingSpec.id) &&
        s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      setFormError(`A specialization named "${trimmedName}" already exists.`);
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      if (editingSpec) {
        await adminService.updateSpecialization(editingSpec.id, {
          name: trimmedName,
          description: specForm.description?.trim() || '',
          is_active: specForm.is_active
        });
        showFeedback(`Specialization "${trimmedName}" updated successfully.`);
      } else {
        await adminService.createSpecialization({
          name: trimmedName,
          description: specForm.description?.trim() || '',
          is_active: true
        });
        showFeedback(`Specialization "${trimmedName}" added successfully.`);
      }
      setIsModalOpen(false);
      await loadSpecializations();
    } catch (err) {
      console.error('Save specialization error:', err);
      const serverMsg =
        err.response?.data?.name?.[0] ||
        err.response?.data?.detail ||
        err.response?.data?.error ||
        'Failed to save specialization.';
      setFormError(serverMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (spec) => {
    setActionId(spec.id);
    try {
      const nextStatus = !spec.is_active;
      await adminService.updateSpecialization(spec.id, { is_active: nextStatus });
      showFeedback(
        `Specialization "${spec.name}" marked as ${nextStatus ? 'Active' : 'Inactive'}.`
      );
      await loadSpecializations();
    } catch (err) {
      console.error('Toggle status error:', err);
      showFeedback('Could not update specialization status.', 'danger');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (spec) => {
    if (spec.doctors_count > 0) {
      const confirmed = window.confirm(
        `"${spec.name}" is currently referenced by ${spec.doctors_count} doctor(s). ` +
        `To protect doctor records, it will be deactivated rather than deleted. Proceed?`
      );
      if (!confirmed) return;
    } else {
      const confirmed = window.confirm(
        `Are you sure you want to delete specialization "${spec.name}"?`
      );
      if (!confirmed) return;
    }

    setActionId(spec.id);
    try {
      const res = await adminService.deleteSpecialization(spec.id);
      if (res?.message) {
        showFeedback(res.message);
      } else {
        showFeedback(`Specialization "${spec.name}" removed.`);
      }
      await loadSpecializations();
    } catch (err) {
      console.error('Delete specialization error:', err);
      showFeedback('Could not delete specialization.', 'danger');
    } finally {
      setActionId(null);
    }
  };

  const filteredSpecializations = useMemo(() => {
    if (!searchTerm.trim()) return specializations;
    const term = searchTerm.toLowerCase();
    return specializations.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.description && s.description.toLowerCase().includes(term))
    );
  }, [specializations, searchTerm]);

  const stats = useMemo(() => {
    const total = specializations.length;
    const active = specializations.filter((s) => s.is_active).length;
    const inactive = total - active;
    const totalDoctors = specializations.reduce((acc, s) => acc + (s.doctors_count || 0), 0);
    return { total, active, inactive, totalDoctors };
  }, [specializations]);

  const columns = [
    {
      header: 'Specialization Name',
      key: 'name',
      render: (row) => (
        <div>
          <span style={{ fontWeight: 600, color: 'var(--text-main, #1e293b)' }}>
            {row.name}
          </span>
          {row.description && (
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
              {row.description}
            </p>
          )}
        </div>
      )
    },
    {
      header: 'Doctors Assigned',
      key: 'doctors_count',
      render: (row) => (
        <span
          className="badge"
          style={{
            backgroundColor: row.doctors_count > 0 ? 'rgba(37, 99, 235, 0.1)' : 'rgba(148, 163, 184, 0.1)',
            color: row.doctors_count > 0 ? 'var(--primary, #2563eb)' : '#64748b',
            fontWeight: 600,
            padding: '4px 8px',
            borderRadius: '9999px',
            fontSize: '0.8rem'
          }}
        >
          {row.doctors_count} {row.doctors_count === 1 ? 'Doctor' : 'Doctors'}
        </span>
      )
    },
    {
      header: 'Status',
      key: 'is_active',
      render: (row) => (
        <span
          style={{
            color: row.is_active ? 'var(--success, #16a34a)' : 'var(--danger, #dc2626)',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: row.is_active ? 'var(--success, #16a34a)' : 'var(--danger, #dc2626)'
            }}
          />
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      header: 'Actions',
      key: 'actions',
      headerStyle: { minWidth: '240px' },
      render: (row) => (
        <div
          style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => handleOpenEditModal(row)}
            disabled={actionId === row.id}
          >
            Rename / Edit
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => handleToggleStatus(row)}
            disabled={actionId === row.id}
          >
            {row.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ color: 'var(--danger, #dc2626)', borderColor: 'rgba(220, 38, 38, 0.3)' }}
            onClick={() => handleDelete(row)}
            disabled={actionId === row.id}
          >
            Delete
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="admin-specializations-page" style={{ padding: '24px 0' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
            Doctor Specializations
          </h1>
          <p style={{ color: 'var(--text-muted, #64748b)', margin: '4px 0 0' }}>
            Manage clinical specializations, active statuses, and view assigned doctors.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleOpenAddModal}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          + Add Specialization
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback.message && (
        <div
          className={`alert alert-${feedback.type}`}
          role="alert"
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            backgroundColor:
              feedback.type === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
            color: feedback.type === 'danger' ? '#b91c1c' : '#15803d',
            border: `1px solid ${
              feedback.type === 'danger' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'
            }`
          }}
        >
          {feedback.message}
        </div>
      )}

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        <div className="card" style={{ padding: '16px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
            Total Specializations
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '4px' }}>
            {stats.total}
          </div>
        </div>
        <div className="card" style={{ padding: '16px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
            Active Specializations
          </span>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              marginTop: '4px',
              color: 'var(--success, #16a34a)'
            }}
          >
            {stats.active}
          </div>
        </div>
        <div className="card" style={{ padding: '16px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
            Inactive
          </span>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              marginTop: '4px',
              color: 'var(--danger, #dc2626)'
            }}
          >
            {stats.inactive}
          </div>
        </div>
        <div className="card" style={{ padding: '16px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
            Total Doctor Assignments
          </span>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              marginTop: '4px',
              color: 'var(--primary, #2563eb)'
            }}
          >
            {stats.totalDoctors}
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div style={{ marginBottom: '16px', maxWidth: '400px' }}>
        <input
          type="search"
          className="form-control"
          placeholder="Search specializations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search specializations"
        />
      </div>

      {/* Specializations Table */}
      <div className="card" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          data={filteredSpecializations}
          loading={loading}
          emptyMessage="No specializations found."
        />
      </div>

      {/* Add / Edit Specialization Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingSpec ? 'Edit Specialization' : 'Add New Specialization'}
      >
        <form onSubmit={handleSave}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Specialization Name *</label>
            <input
              type="text"
              className={`form-control${formError ? ' is-invalid' : ''}`}
              value={specForm.name}
              onChange={(e) => {
                setSpecForm({ ...specForm, name: e.target.value });
                setFormError('');
              }}
              placeholder="e.g. Cardiology, Neurology"
              disabled={submitting}
              autoFocus
            />
            {formError && (
              <small
                className="field-error"
                role="alert"
                style={{ color: 'var(--danger, #dc2626)', marginTop: '4px', display: 'block' }}
              >
                {formError}
              </small>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Description (Optional)</label>
            <textarea
              className="form-control"
              rows={3}
              value={specForm.description}
              onChange={(e) => setSpecForm({ ...specForm, description: e.target.value })}
              placeholder="Brief description of the specialization or clinical scope..."
              disabled={submitting}
            />
          </div>

          {editingSpec && (
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={specForm.is_active}
                  onChange={(e) => setSpecForm({ ...specForm, is_active: e.target.checked })}
                  disabled={submitting}
                />
                <span style={{ fontWeight: 500 }}>Active Specialization</span>
              </label>
              <small style={{ color: 'var(--text-muted, #64748b)', display: 'block', marginTop: '2px' }}>
                Inactive specializations will be hidden from doctor creation dropdowns.
              </small>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '24px'
            }}
          >
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleCloseModal}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !specForm.name.trim()}
            >
              {submitting
                ? 'Saving...'
                : editingSpec
                ? 'Save Changes'
                : 'Add Specialization'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminSpecializationsPage;
