import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import receptionistService from '../../services/receptionistService';
import { formatDate } from '../../utils/formatters';

export const PatientDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPatient = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await receptionistService.getPatient(id);
        setPatient(data);
      } catch (err) {
        console.error('Failed to load patient record:', err);
        setError(err.message || 'Patient not found or could not be loaded.');
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid var(--border-subtle)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
        <div style={{ marginTop: '16px' }}>Loading patient profile #{id}...</div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '1.3rem', color: 'var(--danger)', marginBottom: '8px' }}>Record Unavailable</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            {error || `Patient #${id} could not be found in the database.`}
          </p>
          <Link to="/receptionist/patients" className="btn btn-primary">
            ← Return to Patient Directory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 className="page-title">{patient.first_name} {patient.last_name}</h1>
            <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '3px 10px', borderRadius: '4px', fontWeight: 700, fontSize: '0.85rem' }}>
              {patient.patient_id || `#${patient.id}`}
            </span>
          </div>
          <p className="page-subtitle">Patient demographic profile and registration history.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/receptionist/patients" className="btn btn-outline">
            ← Back to Directory
          </Link>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/receptionist/appointments/book?patient=${patient.id}`)}
          >
            + Book Appointment
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        {/* Left Column: Quick Profile */}
        <div className="card">
          <div style={{ textAlign: 'center', padding: '16px 0', borderBottom: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'var(--primary)',
                color: 'white',
                fontSize: '1.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto'
              }}
            >
              {patient.first_name?.[0]?.toUpperCase()}
            </div>
            <h3 style={{ fontSize: '1.2rem', margin: 0 }}>{patient.first_name} {patient.last_name}</h3>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
              {patient.gender} • {patient.blood_group || 'Blood Group: N/A'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Date of Birth</span>
              <span style={{ fontWeight: 600 }}>{formatDate(patient.date_of_birth)}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Phone Number</span>
              <span style={{ fontWeight: 600 }}>{patient.phone || 'Not recorded'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Email Address</span>
              <span style={{ fontWeight: 600 }}>{patient.email || 'Not recorded'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Enrolled On</span>
              <span>{formatDate(patient.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Full Details & Contacts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              Address & Residence
            </h3>
            <p style={{ fontSize: '0.92rem', color: patient.address ? 'var(--text-main)' : 'var(--text-muted)' }}>
              {patient.address || 'No residential address recorded.'}
            </p>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              Emergency Contact Record
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Contact Name</span>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{patient.emergency_contact_name || '—'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Contact Phone</span>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{patient.emergency_contact_phone || '—'}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ background: 'var(--bg-page)', border: '1px dashed var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Schedule an Appointment</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Book a consultation with an active doctor for {patient.first_name}.</div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate(`/receptionist/appointments/book?patient=${patient.id}`)}
              >
                Proceed to Booking
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientDetailsPage;
