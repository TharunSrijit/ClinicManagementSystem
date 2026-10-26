import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import receptionistService from '../../services/receptionistService';

const getTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const RegisterPatientPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: 'MALE',
    blood_group: 'O+',
    phone: '',
    email: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: ''
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const validateField = (name, value) => {
    let error = '';
    if (name === 'first_name') {
      const trimmed = (value || '').trim();
      if (!trimmed || trimmed.length < 2) {
        error = 'Name must contain at least 2 characters.';
      }
    } else if (name === 'last_name') {
      const trimmed = (value || '').trim();
      if (!trimmed || trimmed.length < 2) {
        error = 'Name must contain at least 2 characters.';
      }
    } else if (name === 'date_of_birth') {
      if (!value) {
        error = 'Date of birth is required.';
      } else {
        const todayStr = getTodayDate();
        if (value > todayStr) {
          error = 'Date of birth cannot be in the future.';
        }
      }
    }
    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Revalidate and update inline error
    if (errors[name]) {
      const fieldError = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: fieldError }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const fieldError = validateField(name, value);
    if (fieldError) {
      setErrors((prev) => ({ ...prev, [name]: fieldError }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ message: '', type: '' });

    // Validate fields before submission
    const newErrors = {};
    const firstNameErr = validateField('first_name', formData.first_name);
    if (firstNameErr) newErrors.first_name = firstNameErr;

    const lastNameErr = validateField('last_name', formData.last_name);
    if (lastNameErr) newErrors.last_name = lastNameErr;

    const dobErr = validateField('date_of_birth', formData.date_of_birth);
    if (dobErr) newErrors.date_of_birth = dobErr;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setFeedback({
        message: 'Please resolve the highlighted validation errors before submitting.',
        type: 'danger'
      });
      return;
    }

    setSubmitting(true);

    try {
      const res = await receptionistService.createPatient(formData);
      setFeedback({
        message: `Patient ${res.first_name} ${res.last_name} enrolled successfully! (ID: ${res.patient_id || res.id})`,
        type: 'success'
      });
      setTimeout(() => {
        navigate(`/receptionist/patients/${res.id}`);
      }, 1500);
    } catch (err) {
      console.error('Patient registration failed:', err);
      if (err.data && typeof err.data === 'object') {
        const backendErrors = {};
        if (err.data.first_name) {
          backendErrors.first_name = Array.isArray(err.data.first_name)
            ? err.data.first_name[0]
            : err.data.first_name;
        }
        if (err.data.last_name) {
          backendErrors.last_name = Array.isArray(err.data.last_name)
            ? err.data.last_name[0]
            : err.data.last_name;
        }
        if (err.data.date_of_birth) {
          backendErrors.date_of_birth = Array.isArray(err.data.date_of_birth)
            ? err.data.date_of_birth[0]
            : err.data.date_of_birth;
        }
        if (Object.keys(backendErrors).length > 0) {
          setErrors((prev) => ({ ...prev, ...backendErrors }));
        }
      }
      setFeedback({
        message: err.message || 'Failed to register patient. Please verify required fields.',
        type: 'danger'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const todayDateStr = getTodayDate();

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Register New Patient</h1>
          <p className="page-subtitle">Enroll a new patient with primary demographic and emergency contact records.</p>
        </div>
        <Link to="/receptionist/patients" className="btn btn-outline">
          ← Back to Directory
        </Link>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit} noValidate>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-main)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            Personal Demographics
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input
                type="text"
                name="first_name"
                className="form-control"
                required
                value={formData.first_name}
                onChange={handleChange}
                onBlur={handleBlur}
                style={errors.first_name ? { borderColor: 'var(--danger)' } : {}}
                placeholder="e.g. Ramesh"
              />
              {errors.first_name && (
                <div style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: '4px' }}>
                  {errors.first_name}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input
                type="text"
                name="last_name"
                className="form-control"
                required
                value={formData.last_name}
                onChange={handleChange}
                onBlur={handleBlur}
                style={errors.last_name ? { borderColor: 'var(--danger)' } : {}}
                placeholder="e.g. Kumar"
              />
              {errors.last_name && (
                <div style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: '4px' }}>
                  {errors.last_name}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Date of Birth *</label>
              <input
                type="date"
                name="date_of_birth"
                className="form-control"
                required
                max={todayDateStr}
                value={formData.date_of_birth}
                onChange={handleChange}
                onBlur={handleBlur}
                style={errors.date_of_birth ? { borderColor: 'var(--danger)' } : {}}
              />
              {errors.date_of_birth && (
                <div style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: '4px' }}>
                  {errors.date_of_birth}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Gender *</label>
              <select
                name="gender"
                className="form-select"
                required
                value={formData.gender}
                onChange={handleChange}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Blood Group</label>
              <select
                name="blood_group"
                className="form-select"
                value={formData.blood_group}
                onChange={handleChange}
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
          </div>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '24px 0 16px 0', color: 'var(--text-main)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            Contact Details
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input
                type="tel"
                name="phone"
                className="form-control"
                required
                value={formData.phone}
                onChange={handleChange}
                placeholder="e.g. 9876543210"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                name="email"
                className="form-control"
                value={formData.email}
                onChange={handleChange}
                placeholder="e.g. ramesh@example.com"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Residential Address</label>
            <textarea
              name="address"
              className="form-control"
              rows="2"
              value={formData.address}
              onChange={handleChange}
              placeholder="Full residential street, area, city, pincode"
            />
          </div>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '24px 0 16px 0', color: 'var(--text-main)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            Emergency Contact Information
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Emergency Contact Name</label>
              <input
                type="text"
                name="emergency_contact_name"
                className="form-control"
                value={formData.emergency_contact_name}
                onChange={handleChange}
                placeholder="Next of kin / Guardian"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Emergency Contact Phone</label>
              <input
                type="tel"
                name="emergency_contact_phone"
                className="form-control"
                value={formData.emergency_contact_phone}
                onChange={handleChange}
                placeholder="Emergency phone number"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => navigate('/receptionist/patients')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Registering...' : 'Register Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPatientPage;
