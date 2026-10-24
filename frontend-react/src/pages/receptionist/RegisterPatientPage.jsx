import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import receptionistService from '../../services/receptionistService';

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

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback({ message: '', type: '' });

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
      setFeedback({
        message: err.message || 'Failed to register patient. Please verify required fields.',
        type: 'danger'
      });
    } finally {
      setSubmitting(false);
    }
  };

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
        <form onSubmit={handleSubmit}>
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
                placeholder="e.g. Ramesh"
              />
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
                placeholder="e.g. Kumar"
              />
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
                value={formData.date_of_birth}
                onChange={handleChange}
              />
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
