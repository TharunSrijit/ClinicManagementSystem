import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import doctorService from '../../services/doctorService';
import { formatDate } from '../../utils/formatters';

export const DoctorPatientDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPatientData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [pt, history, consults, rxs] = await Promise.all([
          doctorService.getPatient(id),
          doctorService.getMedicalHistory(id).catch(() => []),
          doctorService.getConsultations(id).catch(() => []),
          doctorService.getPrescriptions(id).catch(() => [])
        ]);
        setPatient(pt);
        setMedicalHistory(Array.isArray(history) ? history : []);
        setConsultations(Array.isArray(consults) ? consults : []);
        setPrescriptions(Array.isArray(rxs) ? rxs : []);
      } catch (err) {
        console.error('Failed to load patient profile:', err);
        setError(err.message || 'Patient profile could not be loaded.');
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid var(--border-subtle)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
        <div style={{ marginTop: '16px' }}>Loading clinical dossier for Patient #{id}...</div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '1.3rem', color: 'var(--danger)', marginBottom: '8px' }}>Patient Not Found</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            {error || `Clinical record for Patient #${id} does not exist or you lack authorization.`}
          </p>
          <Link to="/doctor/patients" className="btn btn-primary">
            ← Return to Patients List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 className="page-title">{patient.first_name} {patient.last_name}</h1>
            <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '3px 10px', borderRadius: '4px', fontWeight: 700, fontSize: '0.85rem' }}>
              {patient.patient_id || `#${patient.id}`}
            </span>
          </div>
          <p className="page-subtitle">Comprehensive Electronic Health Record (EHR) and past consultation timeline.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/doctor/patients" className="btn btn-outline">
            ← Back to Patient List
          </Link>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/doctor/consultations?patient=${patient.id}`)}
          >
            + Start Consultation
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        {/* Left: Demographics & Vitals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              Demographic Profile
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Date of Birth / Age</span>
                <span style={{ fontWeight: 600 }}>{formatDate(patient.date_of_birth)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Gender</span>
                <span style={{ fontWeight: 600 }}>{patient.gender}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Blood Group</span>
                <span style={{ fontWeight: 600, color: '#b91c1c' }}>{patient.blood_group || 'Unspecified'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Phone</span>
                <span>{patient.phone || '—'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Emergency Contact</span>
                <span>{patient.emergency_contact_name ? `${patient.emergency_contact_name} (${patient.emergency_contact_phone || ''})` : '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Medical History & Past Consultations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Medical History */}
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              Known Medical Conditions & Allergies
            </h3>
            {medicalHistory.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                No past chronic conditions or drug allergies flagged for this patient.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {medicalHistory.map((item) => (
                  <div key={item.id} style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.medical_condition}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Diagnosed: {formatDate(item.diagnosed_date)}</span>
                    </div>
                    {item.allergies && (
                      <div style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: '4px' }}>
                        ⚠️ Allergies: {item.allergies}
                      </div>
                    )}
                    {item.description && (
                      <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Consultations */}
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              Past Consultation Timeline ({consultations.length})
            </h3>
            {consultations.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                No prior clinical consultations recorded for this patient.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {consultations.map((c) => (
                  <div key={c.id} style={{ borderLeft: '3px solid var(--primary)', padding: '10px 16px', background: '#f8fafc', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Diagnosis: {c.diagnosis}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDate(c.created_at || c.consultation_date)}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '4px' }}>
                      <strong>Symptoms:</strong> {c.symptoms || 'None recorded'}
                    </div>
                    {c.clinical_notes && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <strong>Notes:</strong> {c.clinical_notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Prescriptions */}
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              Prescription History ({prescriptions.length})
            </h3>
            {prescriptions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                No medication prescriptions issued.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {prescriptions.map((rx) => (
                  <div key={rx.id} style={{ padding: '12px', background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600 }}>Rx #{rx.id}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDate(rx.created_at)}</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {rx.notes || 'Standard regimen'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorPatientDetailsPage;
