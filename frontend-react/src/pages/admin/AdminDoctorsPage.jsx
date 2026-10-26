import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import adminService from '../../services/adminService';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';

const getTodayDate = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

export const AdminDoctorsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [doctors, setDoctors] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [actionDoctorId, setActionDoctorId] = useState(null);
  const [feedback, setFeedback] = useState({ message: '', type: '' });
  const [fieldErrors, setFieldErrors] = useState({});

  const createFormDefaults = {
    user: '',
    specialization: 'General Medicine',
    qualification: 'MBBS, MD',
    contact_number: '',
    date_of_joining: getTodayDate(),
    registration_number: '',
    consultation_fee: 500,
    available_from: '09:00:00',
    available_to: '17:00:00',
    available_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    slot_minutes: 15
  };
  const [form, setForm] = useState(createFormDefaults);

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDoctor(null);
    setForm(createFormDefaults);
    setFieldErrors({});
  };

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const [docsData, usersData] = await Promise.all([
        adminService.getDoctors(),
        adminService.getUsers().catch(() => [])
      ]);
      setDoctors(Array.isArray(docsData) ? docsData : []);
      const linkedUserIds = new Set(
        (Array.isArray(docsData) ? docsData : []).map(doctor => Number(doctor.user))
      );
      setUsers(
        Array.isArray(usersData)
          ? usersData.filter(user => user.role === 'DOCTOR' && !linkedUserIds.has(Number(user.id)))
          : []
      );
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
    const errors = {};
    if (!/^[A-Za-z ]+$/.test(form.specialization.trim())) {
      errors.specialization = 'Specialization contains letters only.';
    }
    if (!/^[A-Za-z]+(( ?, ?| )[A-Za-z]+)*$/.test(form.qualification.trim())) {
      errors.qualification = 'Qualification must contain letters only, separated by spaces or commas (for example, MBBS, MD).';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      const doctorData = {
        user: Number(form.user),
        specialization: form.specialization,
        qualification: form.qualification,
        contact_number: form.contact_number,
        date_of_joining: form.date_of_joining || null,
        registration_number: form.registration_number,
        consultation_fee: Number(form.consultation_fee),
        available_from: form.available_from,
        available_to: form.available_to,
        available_days: form.available_days,
        slot_minutes: Number(form.slot_minutes)
      };
      if (editingDoctor) {
        await adminService.updateDoctor(editingDoctor.id, doctorData);
        showFeedback('Doctor profile updated successfully!');
      } else {
        await adminService.createDoctor(doctorData);
        showFeedback('Doctor profile registered successfully!');
      }
      closeModal();
      await loadDoctors();
    } catch (err) {
      console.error('Failed to save doctor profile:', err);
      const apiErrors = err.data || {};
      const nextFieldErrors = {};
      if (apiErrors.specialization) {
        nextFieldErrors.specialization = 'Specialization contains letters only.';
      }
      if (apiErrors.qualification) {
        nextFieldErrors.qualification = 'Qualification must contain letters only, separated by spaces or commas (for example, MBBS, MD).';
      }
      if (Object.keys(nextFieldErrors).length) {
        setFieldErrors(nextFieldErrors);
      } else {
        showFeedback(err.message || 'Doctor profile could not be saved.', 'danger');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDoctor = (doctor) => {
    setEditingDoctor(doctor);
    setFieldErrors({});
    setForm({
      user: String(doctor.user),
      specialization: doctor.specialization || '',
      qualification: doctor.qualification || '',
      contact_number: doctor.contact_number || '',
      date_of_joining: doctor.date_of_joining || '',
      registration_number: doctor.registration_number || '',
      consultation_fee: doctor.consultation_fee ?? 0,
      available_from: doctor.available_from || '',
      available_to: doctor.available_to || '',
      available_days: doctor.available_days || ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      slot_minutes: doctor.slot_minutes || 15
    });
    setIsModalOpen(true);
  };

  useEffect(() => {
    const doctorId = Number(searchParams.get('edit'));
    if (loading || !doctorId) return;

    const doctor = doctors.find((item) => Number(item.id) === doctorId);
    if (doctor) openEditDoctor(doctor);
    navigate('/admin/doctors', { replace: true });
  }, [doctors, loading, navigate, searchParams]);

  const handleDeleteDoctor = async (doctor) => {
    if (!window.confirm(`Delete Dr. ${doctor.full_name || doctor.doctor_id}'s profile? Their user account will remain.`)) {
      return;
    }

    setActionDoctorId(doctor.id);
    try {
      await adminService.deleteDoctor(doctor.id);
      showFeedback('Doctor profile deleted. The user account was not deleted.');
      await loadDoctors();
    } catch (err) {
      console.error('Failed to delete doctor profile:', err);
      showFeedback(err.message || 'Doctor profile could not be deleted.', 'danger');
    } finally {
      setActionDoctorId(null);
    }
  };

  const handleToggleDoctorActive = async (doctor) => {
    setActionDoctorId(doctor.id);
    try {
      await adminService.setDoctorActive(doctor.user, !doctor.is_active);
      showFeedback(doctor.is_active ? 'Doctor account deactivated.' : 'Doctor account activated.');
      await loadDoctors();
    } catch (err) {
      console.error('Failed to update doctor account status:', err);
      showFeedback(err.message || 'Doctor account status could not be updated.', 'danger');
    } finally {
      setActionDoctorId(null);
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
      header: 'Contact Number',
      key: 'contact_number',
      render: (row) => <span>{row.contact_number || '—'}</span>
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
      header: 'Date of Joining',
      key: 'date_of_joining',
      render: (row) => <span>{row.date_of_joining || '—'}</span>
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
    },
    {
      header: 'Available Days',
      key: 'available_days',
      render: (row) => (
        <span>
          {((row.available_days || []).map((day) => ({
            MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu',
            FRI: 'Fri', SAT: 'Sat', SUN: 'Sun'
          }[day]) || [])).join(', ') || '—'}
        </span>
      )
    },
    {
      header: 'Status',
      key: 'is_active',
      render: (row) => (
        <span style={{ color: row.is_active ? 'var(--success)' : 'var(--danger)', fontWeight: 600, fontSize: '0.82rem' }}>
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      header: 'Actions',
      key: 'actions',
      headerStyle: { minWidth: '300px' },
      render: (row) => (
        <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => openEditDoctor(row)}
            disabled={actionDoctorId === row.id}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => handleDeleteDoctor(row)}
            disabled={actionDoctorId === row.id}
          >
            Delete
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => handleToggleDoctorActive(row)}
            disabled={actionDoctorId === row.id}
          >
            {row.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
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
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingDoctor(null);
            setForm(createFormDefaults);
            setFieldErrors({});
            setIsModalOpen(true);
          }}
        >
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
        onClose={closeModal}
        title={editingDoctor ? 'Edit Doctor Practice Profile' : 'Register Doctor Practice Profile'}
      >
        <form onSubmit={handleCreateDoctor}>
          <div className="form-group">
            <label className="form-label">Associated User Account *</label>
            <select
              className="form-select"
              required
              value={form.user}
              disabled={Boolean(editingDoctor)}
              onChange={(e) => setForm({ ...form, user: e.target.value })}
            >
              <option value="">-- Select Doctor User Account --</option>
              {editingDoctor && (
                <option value={editingDoctor.user}>
                  {editingDoctor.full_name || editingDoctor.email || editingDoctor.doctor_id}
                </option>
              )}
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
                className={`form-control${fieldErrors.specialization ? ' is-invalid' : ''}`}
                required
                pattern="[A-Za-z ]+"
                title="Specialization contains letters only."
                aria-invalid={Boolean(fieldErrors.specialization)}
                aria-describedby={fieldErrors.specialization ? 'doctor-specialization-error' : undefined}
                value={form.specialization}
                onChange={(e) => {
                  setForm({ ...form, specialization: e.target.value });
                  setFieldErrors({ ...fieldErrors, specialization: '' });
                }}
                placeholder="e.g. Cardiology, Pediatrics"
              />
              {fieldErrors.specialization && (
                <small id="doctor-specialization-error" className="field-error" role="alert">
                  {fieldErrors.specialization}
                </small>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Qualification *</label>
              <input
                type="text"
                className={`form-control${fieldErrors.qualification ? ' is-invalid' : ''}`}
                required
                pattern="[A-Za-z]+(( ?, ?| )[A-Za-z]+)*"
                title="Qualification must contain letters only, separated by spaces or commas (for example, MBBS, MD)."
                aria-invalid={Boolean(fieldErrors.qualification)}
                aria-describedby={fieldErrors.qualification ? 'doctor-qualification-error' : undefined}
                value={form.qualification}
                onChange={(e) => {
                  setForm({ ...form, qualification: e.target.value });
                  setFieldErrors({ ...fieldErrors, qualification: '' });
                }}
                placeholder="e.g. MBBS, MD"
              />
              {fieldErrors.qualification && (
                <small id="doctor-qualification-error" className="field-error" role="alert">
                  {fieldErrors.qualification}
                </small>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Contact Number</label>
            <input
              type="tel"
              inputMode="numeric"
              minLength="10"
              maxLength="10"
              pattern="[6-9][0-9]{9}"
              title="Enter exactly 10 digits, starting with 6, 7, 8, or 9."
              className="form-control"
              value={form.contact_number}
              onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
              placeholder="Doctor contact number"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Date of Joining</label>
            <input
              type="date"
              className="form-control"
              max={getTodayDate()}
              value={form.date_of_joining}
              onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Medical Registration # *</label>
              <input
                type="text"
                className="form-control"
                required
                pattern="[A-Za-z]{3}-[0-9]+"
                title="Registration number must be 3 letters followed by a hyphen and numbers (for example, REG-1234)."
                value={form.registration_number}
                onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
                placeholder="e.g. REG-1234"
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

          <fieldset className="form-group" style={{ border: 0, padding: 0, marginTop: '16px' }}>
            <legend className="form-label">Available Days *</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {[
                ['MON', 'Monday'],
                ['TUE', 'Tuesday'],
                ['WED', 'Wednesday'],
                ['THU', 'Thursday'],
                ['FRI', 'Friday'],
                ['SAT', 'Saturday'],
                ['SUN', 'Sunday']
              ].map(([day, label]) => (
                <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="checkbox"
                    checked={form.available_days.includes(day)}
                    onChange={(event) => {
                      const availableDays = event.target.checked
                        ? [...form.available_days, day]
                        : form.available_days.filter((selectedDay) => selectedDay !== day);
                      setForm({ ...form, available_days: availableDays });
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
            {form.available_days.length === 0 && (
              <small style={{ color: 'var(--danger)' }}>Select at least one available day.</small>
            )}
          </fieldset>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={closeModal}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || form.available_days.length === 0}
            >
              {submitting
                ? (editingDoctor ? 'Saving...' : 'Registering...')
                : (editingDoctor ? 'Save Changes' : 'Register Doctor Profile')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminDoctorsPage;