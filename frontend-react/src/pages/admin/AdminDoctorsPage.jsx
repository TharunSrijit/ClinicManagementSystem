import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';

export const AdminDoctorsPage = () => {
  const [doctors, setDoctors] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const [form, setForm] = useState({
    user: '',
    specialization: 'General Medicine',
    qualification: 'MBBS, MD',
    registration_number: '',
    consultation_fee: 500,
    available_from: '09:00:00',
    available_to: '17:00:00',
    slot_minutes: 15
  });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const [docsData, usersData] = await Promise.all([
        adminService.getDoctors(),
        adminService.getUsers().catch(() => [])
      ]);
      setDoctors(Array.isArray(docsData) ? docsData : []);
      // Filter for users with role DOCTOR that don't have a profile yet if possible
      setUsers(Array.isArray(usersData) ? usersData.filter(u => u.role === 'DOCTOR') : []);
    } catch (err) {
      console.error('Failed to load doctors:', err);
      showFeedback('Could not load doctor profiles.', 'danger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminService.createDoctor({
        user: Number(form.user),
        specialization: form.specialization,
        qualification: form.qualification,
        registration_number: form.registration_number,
        consultation_fee: Number(form.consultation_fee),
        available_from: form.available_from,
        available_to: form.available_to,
        slot_minutes: Number(form.slot_minutes)
      });
      showFeedback('Doctor profile registered successfully!');
      setIsModalOpen(false);
      await loadDoctors();
    } catch (err) {
      console.error('Failed to create doctor profile:', err);
      showFeedback(err.message || 'Doctor profile creation failed.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Doctor ID',
      key: 'doctor_id',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
          {row.doctor_id || `#${row.id}`}
        </span>
      )
    },
    {
      header: 'Doctor Name',
      key: 'full_name',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.full_name || `Dr. #${row.id}`}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{row.email || '—'}</div>
        </div>
      )
    },
    {
      header: 'Specialization & Degree',
      key: 'specialization',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.specialization}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{row.qualification}</div>
        </div>
      )
    },
    {
      header: 'Medical Reg #',
      key: 'registration_number',
      render: (row) => <span>{row.registration_number || '—'}</span>
    },
    {
      header: 'Consultation Fee',
      key: 'consultation_fee',
      render: (row) => (
        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
          ₹{Number(row.consultation_fee || 0).toFixed(2)}
        </span>
      )
    },
    {
      header: 'Practice Hours',
      key: 'available_from',
      render: (row) => (
        <span style={{ fontSize: '0.85rem' }}>
          {row.available_from?.slice(0, 5)} - {row.available_to?.slice(0, 5)} ({row.slot_minutes}m slots)
        </span>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Doctor Registry & Credentials</h1>
          <p className="page-subtitle">Configure doctor specialties, medical board registration, and consultation fees.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          + Register Doctor Profile
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      <DataTable
        columns={columns}
        data={doctors}
        loading={loading}
        emptyMessage="No doctors registered in the system."
      />

      {/* Register Doctor Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register Doctor Practice Profile"
      >
        <form onSubmit={handleCreateDoctor}>
          <div className="form-group">
            <label className="form-label">Associated User Account *</label>
            <select
              className="form-select"
              required
              value={form.user}
              onChange={(e) => setForm({ ...form, user: e.target.value })}
            >
              <option value="">-- Select Doctor User Account --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.first_name || ''} {u.last_name || ''} - {u.email})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Specialization *</label>
              <input
                type="text"
                className="form-control"
                required
                value={form.specialization}
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                placeholder="e.g. Cardiology, Pediatrics"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Qualification *</label>
              <input
                type="text"
                className="form-control"
                required
                value={form.qualification}
                onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                placeholder="e.g. MBBS, MD, DNB"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Medical Registration # *</label>
              <input
                type="text"
                className="form-control"
                required
                value={form.registration_number}
                onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
                placeholder="e.g. MCI-2023-8874"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Consultation Fee (₹) *</label>
              <input
                type="number"
                min="0"
                className="form-control"
                required
                value={form.consultation_fee}
                onChange={(e) => setForm({ ...form, consultation_fee: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Available From</label>
              <input
                type="time"
                step="1"
                className="form-control"
                value={form.available_from}
                onChange={(e) => setForm({ ...form, available_from: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Available To</label>
              <input
                type="time"
                step="1"
                className="form-control"
                value={form.available_to}
                onChange={(e) => setForm({ ...form, available_to: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Slot Duration (Min)</label>
              <input
                type="number"
                min="5"
                max="60"
                className="form-control"
                value={form.slot_minutes}
                onChange={(e) => setForm({ ...form, slot_minutes: e.target.value })}
              />
            </div>
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
              {submitting ? 'Registering...' : 'Register Doctor Profile'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminDoctorsPage;
