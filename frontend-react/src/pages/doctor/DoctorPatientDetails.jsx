import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import doctorService from '../../services/doctorService';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/formatters';

// Pure helper functions
const calculateAge = (dobString) => {
  if (!dobString) return null;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
};

const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const DoctorPatientDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Unscheduled consultation modal state
  const [unscheduledModal, setUnscheduledModal] = useState({
    isOpen: false,
    visitReason: '',
    submitting: false,
    error: null
  });

  const fetchPatientData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ptRes, historyRes, consultsRes, apptsRes, rxsRes] = await Promise.all([
        doctorService.getPatient(id),
        doctorService.getMedicalHistory(id).catch(() => []),
        doctorService.getConsultations(id).catch(() => []),
        doctorService.getAppointments({ patient: id }).catch(() => []),
        doctorService.getPrescriptions(id).catch(() => [])
      ]);

      setPatient(ptRes);
      setMedicalHistory(Array.isArray(historyRes) ? historyRes : []);
      setConsultations(Array.isArray(consultsRes) ? consultsRes : []);
      setAppointments(Array.isArray(apptsRes) ? apptsRes : []);
      setPrescriptions(Array.isArray(rxsRes) ? rxsRes : []);
    } catch (err) {
      console.error('Failed to load patient dossier:', err);
      setError(err.message || `Clinical record for Patient #${id} could not be loaded.`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPatientData();
  }, [fetchPatientData]);

  // Check today's appointment status
  const getTodayAppointment = () => {
    const todayStr = getTodayDateString();
    return appointments.find((a) => a.appointment_date === todayStr);
  };

  const handleStartConsultation = () => {
    const todayAppt = getTodayAppointment();

    if (
      todayAppt &&
      ['CONFIRMED', 'BOOKED', 'SCHEDULED', 'IN_CONSULTATION'].includes(todayAppt.status) &&
      todayAppt.token_number &&
      todayAppt.token_status !== 'CANCELLED'
    ) {
      navigate(`/doctor/consultations?appointment=${todayAppt.id}`);
      return;
    }

    // Unscheduled consultation modal
    setUnscheduledModal({
      isOpen: true,
      visitReason: '',
      submitting: false,
      error: null
    });
  };

  const handleConfirmUnscheduled = async (e) => {
    e.preventDefault();
    if (!patient) return;

    setUnscheduledModal((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      const res = await doctorService.startUnscheduledConsultation({
        patient: patient.id,
        visit_reason: unscheduledModal.visitReason.trim()
      });

      setUnscheduledModal({ isOpen: false, visitReason: '', submitting: false, error: null });
      navigate(`/doctor/consultations?consultation=${res.id}`);
    } catch (err) {
      console.error('Failed to start unscheduled consultation:', err);
      const data = err?.data || err?.response?.data;
      let errMsg = err?.message || 'Failed to initiate unscheduled consultation.';
      if (data) {
        if (typeof data === 'string') errMsg = data;
        else if (data.detail) errMsg = data.detail;
        else if (data.message) errMsg = data.message;
        else {
          const fieldMsgs = Object.entries(data).map(
            ([f, m]) => `${f}: ${Array.isArray(m) ? m.join(' ') : String(m)}`
          );
          if (fieldMsgs.length > 0) errMsg = fieldMsgs.join(' | ');
        }
      }
      setUnscheduledModal((prev) => ({ ...prev, submitting: false, error: errMsg }));
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div
          style={{
            display: 'inline-block',
            width: '36px',
            height: '36px',
            border: '3px solid var(--border-subtle)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }}
        />
        <div style={{ marginTop: '16px', fontSize: '0.95rem' }}>Loading clinical record for Patient #{id}...</div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--danger)' }}>
            <AlertCircle size={44} strokeWidth={1.8} />
          </div>
          <h2 style={{ fontSize: '1.3rem', color: 'var(--danger)', marginBottom: '8px' }}>Patient Record Not Found</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            {error || `Clinical record for Patient #${id} does not exist or you lack authorization.`}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn btn-outline" onClick={fetchPatientData}>
              Try Again
            </button>
            <Link to="/doctor/patients" className="btn btn-primary">
              ← Return to Patients Directory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const age = calculateAge(patient.date_of_birth);
  const todayAppt = getTodayAppointment();

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              {patient.first_name} {patient.last_name}
            </h1>
            <span
              style={{
                background: 'var(--primary-light, #e0f2fe)',
                color: 'var(--primary, #0284c7)',
                padding: '4px 12px',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.9rem'
              }}
            >
              {patient.patient_id || `#${patient.id}`}
            </span>
            {todayAppt && (
              <span
                className="badge"
                style={{
                  background: todayAppt.status === 'COMPLETED' ? '#e2e8f0' : '#dcfce7',
                  color: todayAppt.status === 'COMPLETED' ? '#475569' : '#166534',
                  fontSize: '0.82rem'
                }}
              >
                {todayAppt.status === 'COMPLETED' ? '✓ Consulted Today' : `● ${todayAppt.status} Today`}
              </span>
            )}
          </div>
          <p className="page-subtitle" style={{ marginTop: '6px' }}>
            Electronic Health Record, medical background, and past consultation history.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link to="/doctor/patients" className="btn btn-outline">
            ← Back to Patients
          </Link>
          {todayAppt &&
          ['CONFIRMED', 'BOOKED', 'SCHEDULED', 'IN_CONSULTATION'].includes(todayAppt.status) &&
          todayAppt.token_number &&
          todayAppt.token_status !== 'CANCELLED' ? (
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/doctor/consultations?appointment=${todayAppt.id}`)}
              title={`Start token-based consultation (Token #${todayAppt.token_number})`}
            >
              Start Consultation
            </button>
          ) : todayAppt && todayAppt.status === 'COMPLETED' ? (
            <button className="btn btn-outline" disabled title="Patient already consulted today">
              ✓ Consulted Today
            </button>
          ) : (
            <button
              className="btn"
              style={{ background: '#f59e0b', color: '#ffffff', border: 'none', fontWeight: 500 }}
              onClick={handleStartConsultation}
              title={
                todayAppt && !todayAppt.token_number
                  ? 'Patient has an appointment today but no queue token yet. Click to start unscheduled consultation.'
                  : 'Start unscheduled consultation directly without a queue token'
              }
            >
              Start Unscheduled
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        {/* Left Column: Demographics & Contacts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Demographic Card */}
          <div className="card">
            <h3
              style={{
                fontSize: '1.05rem',
                fontWeight: 600,
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '8px'
              }}
            >
              Demographic Information
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Date of Birth / Age</span>
                <span style={{ fontWeight: 600 }}>
                  {formatDate(patient.date_of_birth)} {age !== null ? `(${age} years old)` : ''}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Gender</span>
                <span style={{ fontWeight: 600 }}>{patient.gender || '—'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Blood Group</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: '#b91c1c',
                    background: '#fee2e2',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.85rem'
                  }}
                >
                  {patient.blood_group || 'Unspecified'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Primary Phone</span>
                <span style={{ fontWeight: 500 }}>{patient.phone || '—'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Email Address</span>
                <span>{patient.email || '—'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Residential Address</span>
                <span>{patient.address || '—'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Emergency Contact</span>
                <span>
                  {patient.emergency_contact_name
                    ? `${patient.emergency_contact_name} ${patient.emergency_contact_phone ? `(${patient.emergency_contact_phone})` : ''}`
                    : '—'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Enrolled In System</span>
                <span>{formatDate(patient.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="card" style={{ background: '#f8fafc' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px' }}>Clinical Actions</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleStartConsultation}
                style={{ width: '100%' }}
              >
                Start Consultation
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => navigate(`/doctor/consultations?patient=${patient.id}`)}
                style={{ width: '100%' }}
              >
                View All Consultations
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Medical History, Prior Consultations, Appointments, Prescriptions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Medical Conditions & Allergies */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
                Known Medical Conditions & Allergies
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {medicalHistory.length} record{medicalHistory.length !== 1 ? 's' : ''}
              </span>
            </div>

            {medicalHistory.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
                No prior chronic medical conditions or drug allergies recorded for this patient.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {medicalHistory.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: '#f8fafc',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm, 6px)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {item.medical_condition}
                      </span>
                      {item.diagnosed_date && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Diagnosed: {formatDate(item.diagnosed_date)}
                        </span>
                      )}
                    </div>

                    {item.allergies && (
                      <div
                        style={{
                          color: '#b91c1c',
                          background: '#fee2e2',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '0.82rem',
                          marginTop: '6px',
                          display: 'inline-block',
                          fontWeight: 600
                        }}
                      >
                        Allergies: {item.allergies}
                      </div>
                    )}

                    {item.description && (
                      <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {item.description}
                      </p>
                    )}

                    {item.current_medications && (
                      <div style={{ marginTop: '6px', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                        <strong>Current Medications:</strong> {item.current_medications}
                      </div>
                    )}

                    {item.previous_surgeries && (
                      <div style={{ marginTop: '4px', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                        <strong>Past Surgeries:</strong> {item.previous_surgeries}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Consultations Timeline */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
                Consultation History ({consultations.length})
              </h3>
            </div>

            {consultations.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
                No past consultations found between you and this patient.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {consultations.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      borderLeft: '4px solid var(--primary)',
                      padding: '12px 16px',
                      background: '#f8fafc',
                      borderRadius: '0 var(--radius-sm, 6px) var(--radius-sm, 6px) 0'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                          Diagnosis: {c.diagnosis || 'Clinical evaluation in progress'}
                        </span>
                        {c.visit_type === 'UNSCHEDULED' ? (
                          <span
                            className="badge"
                            style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontSize: '0.75rem' }}
                            title="Unscheduled consultation conducted without a queue token"
                          >
                            Unscheduled (Tokenless)
                          </span>
                        ) : (
                          <span
                            className="badge"
                            style={{ background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe', fontSize: '0.75rem' }}
                            title="Token-based consultation with scheduled appointment"
                          >
                            Token-Based {c.token_number ? `(Token #${c.token_number})` : ''}
                          </span>
                        )}
                        <span
                          className={`badge ${c.status === 'IN_PROGRESS' ? 'badge-warning' : 'badge-success'}`}
                          style={{ fontSize: '0.72rem' }}
                        >
                          {c.status === 'IN_PROGRESS' ? '● In Progress' : '✓ Completed'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {formatDate(c.consultation_date || c.created_at)}
                        </span>
                        {c.status === 'IN_PROGRESS' && (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                            onClick={() => navigate(`/doctor/consultations?consultation=${c.id}`)}
                          >
                            Resume ↗
                          </button>
                        )}
                      </div>
                    </div>

                    {c.visit_reason && (
                      <div style={{ fontSize: '0.85rem', color: '#92400e', marginTop: '6px' }}>
                        <strong>Visit Reason:</strong> {c.visit_reason}
                      </div>
                    )}

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '6px' }}>
                      <strong>Symptoms:</strong> {c.symptoms || 'None recorded'}
                    </div>

                    {c.clinical_notes && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <strong>Clinical Notes:</strong> {c.clinical_notes}
                      </div>
                    )}

                    {c.treatment_plan && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <strong>Treatment Plan:</strong> {c.treatment_plan}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Appointments with Logged-in Doctor */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
                Appointment History ({appointments.length})
              </h3>
            </div>

            {appointments.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
                No prior scheduled appointments on record for this doctor.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {appointments.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: '#fff',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm, 6px)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                        {formatDate(a.appointment_date)} at {a.appointment_time || 'Scheduled slot'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Type: {a.appointment_type || 'General'} {a.reason ? `• Reason: ${a.reason}` : ''}
                      </div>
                    </div>
                    <span
                      className="badge"
                      style={{
                        background:
                          a.status === 'COMPLETED'
                            ? '#dcfce7'
                            : a.status === 'CANCELLED'
                            ? '#fee2e2'
                            : '#e0f2fe',
                        color:
                          a.status === 'COMPLETED'
                            ? '#166534'
                            : a.status === 'CANCELLED'
                            ? '#991b1b'
                            : '#0369a1'
                      }}
                    >
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Prescriptions */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
                Prescription History ({prescriptions.length})
              </h3>
            </div>

            {prescriptions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
                No medication prescriptions issued for this patient.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {prescriptions.map((rx) => (
                  <div
                    key={rx.id}
                    style={{
                      padding: '14px 16px',
                      background: '#ffffff',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm, 6px)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
                          {rx.prescription_number || `Rx #${rx.id}`}
                        </span>
                        {rx.consultation && (
                          <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px' }}>
                            Consultation #{rx.consultation}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {formatDate(rx.prescription_date)}
                      </span>
                    </div>

                    {/* Prescribed Items Table / List */}
                    {rx.items && rx.items.length > 0 ? (
                      <div style={{ background: '#f8fafc', borderRadius: '4px', padding: '8px 12px', marginTop: '8px' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Prescribed Medications ({rx.items.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {rx.items.map((it, idx) => (
                            <div key={idx} style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', borderBottom: idx < rx.items.length - 1 ? '1px dashed #e2e8f0' : 'none', paddingBottom: '4px' }}>
                              <div>
                                <strong style={{ color: 'var(--text-main)' }}>{it.medicine_name || `Medicine #${it.medicine}`}</strong>
                                {it.dosage_name && <span style={{ color: 'var(--text-muted)' }}> — {it.dosage_name}</span>}
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  {it.frequency || 'Daily'} • {it.duration || '5 days'}
                                  {it.instructions ? ` • Instructions: ${it.instructions}` : ''}
                                </div>
                              </div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                                Qty: {it.quantity}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '6px' }}>
                        No specific item lines recorded.
                      </div>
                    )}

                    {rx.notes && (
                      <p style={{ margin: '8px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <strong>Doctor Notes:</strong> {rx.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unscheduled Consultation Confirmation Modal */}
      <Modal
        isOpen={unscheduledModal.isOpen}
        onClose={() =>
          !unscheduledModal.submitting &&
          setUnscheduledModal({ isOpen: false, visitReason: '', submitting: false, error: null })
        }
        title="Start Unscheduled Consultation"
      >
        <form onSubmit={handleConfirmUnscheduled}>
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '6px',
              padding: '14px',
              marginBottom: '16px',
              color: '#92400e',
              fontSize: '0.9rem',
              lineHeight: '1.5'
            }}
          >
            <strong>Workflow B: Unscheduled (Tokenless) Consultation</strong>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem' }}>
              Patient <strong>{patient.first_name} {patient.last_name}</strong> has no queue token or appointment scheduled for today. Starting this consultation will record a tokenless clinical visit and automatically generate a pending consultation invoice.
            </p>
          </div>

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              borderRadius: '6px',
              padding: '12px 14px',
              marginBottom: '16px',
              fontSize: '0.88rem'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Patient ID:</span>{' '}
                <strong>{patient.patient_id || `#${patient.id}`}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Phone:</span>{' '}
                <strong>{patient.phone || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Gender:</span>{' '}
                <strong>{patient.gender || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Blood Group:</span>{' '}
                <strong>{patient.blood_group || '—'}</strong>
              </div>
            </div>
          </div>

          {unscheduledModal.error && (
            <div className="alert alert-danger" style={{ marginBottom: '14px', fontSize: '0.88rem' }}>
              {unscheduledModal.error}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>
              Visit Reason / Chief Complaint <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
            </label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="e.g. Walk-in emergency visit, severe headache and high fever for 2 days..."
              value={unscheduledModal.visitReason}
              onChange={(e) =>
                setUnscheduledModal((prev) => ({ ...prev, visitReason: e.target.value }))
              }
              disabled={unscheduledModal.submitting}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline"
              disabled={unscheduledModal.submitting}
              onClick={() =>
                setUnscheduledModal({ isOpen: false, visitReason: '', submitting: false, error: null })
              }
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={unscheduledModal.submitting}
              style={{ minWidth: '150px' }}
            >
              {unscheduledModal.submitting ? 'Initiating...' : 'Confirm & Start'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DoctorPatientDetails;
