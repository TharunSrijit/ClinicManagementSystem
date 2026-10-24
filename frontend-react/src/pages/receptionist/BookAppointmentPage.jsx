import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import receptionistService from '../../services/receptionistService';

export const BookAppointmentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get('patient') || '';

  // Date constants
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const maxAdvanceStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }, []);

  // Form State
  const [appointmentType, setAppointmentType] = useState('WALK_IN');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(todayStr);
  const [selectedSlotTime, setSelectedSlotTime] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [reason, setReason] = useState('Routine consultation');

  // Async data
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  // Load initial doctors and patients
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [docs, pts] = await Promise.all([
          receptionistService.getDoctors().catch(() => []),
          receptionistService.getPatients().catch(() => [])
        ]);
        setDoctors(Array.isArray(docs) ? docs : []);
        setPatients(Array.isArray(pts) ? pts : []);
        if (docs.length > 0) {
          setSelectedDoctorId(String(docs[0].id));
        }
      } catch (err) {
        console.error('Failed to load doctors/patients:', err);
      }
    };
    loadInitial();
  }, []);

  // Handle appointment type switch
  const handleTypeChange = (newType) => {
    setAppointmentType(newType);
    setSelectedSlotTime('');
    if (newType === 'WALK_IN') {
      setAppointmentDate(todayStr);
    } else {
      setAppointmentDate(tomorrowStr);
    }
  };

  // Fetch available slots when doctor, type, or date changes
  const fetchSlots = useCallback(async () => {
    if (!selectedDoctorId || !appointmentDate) return;
    setLoadingSlots(true);
    try {
      const data = await receptionistService.getDoctorSlots(selectedDoctorId, appointmentType, appointmentDate);
      // Backend returns either an array of slot objects or an object with slots
      const slotList = Array.isArray(data) ? data : (data.available_slots || data.slots || []);
      setSlots(slotList);
    } catch (err) {
      console.error('Error fetching slots:', err);
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedDoctorId, appointmentType, appointmentDate]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Handle patient search query
  const handlePatientSearch = async (term) => {
    setPatientSearchTerm(term);
    try {
      const pts = await receptionistService.getPatients(term);
      setPatients(Array.isArray(pts) ? pts : []);
    } catch (err) {
      console.error('Error searching patients:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) {
      setFeedback({ message: 'Please select a patient.', type: 'danger' });
      return;
    }
    if (!selectedDoctorId) {
      setFeedback({ message: 'Please select a doctor.', type: 'danger' });
      return;
    }
    if (!selectedSlotTime) {
      setFeedback({ message: 'Please select an appointment time slot.', type: 'danger' });
      return;
    }

    setSubmitting(true);
    setFeedback({ message: '', type: '' });

    try {
      const payload = {
        patient: Number(selectedPatientId),
        doctor: Number(selectedDoctorId),
        appointment_date: appointmentDate,
        appointment_time: selectedSlotTime,
        appointment_type: appointmentType,
        reason: reason.trim() || 'General consultation'
      };

      const result = await receptionistService.bookAppointment(payload);
      setFeedback({
        message: `Appointment booked successfully! Appointment #${result.id} is confirmed.`,
        type: 'success'
      });
      setTimeout(() => {
        navigate('/receptionist/appointments');
      }, 1500);
    } catch (err) {
      console.error('Booking failed:', err);
      setFeedback({
        message: err.message || 'Failed to book appointment. Please check slot availability.',
        type: 'danger'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Book Clinic Appointment</h1>
          <p className="page-subtitle">Schedule a walk-in patient for today or reserve an advance appointment.</p>
        </div>
        <Link to="/receptionist/appointments" className="btn btn-outline">
          ← Back to Appointments
        </Link>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>
          {feedback.message}
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit}>
          {/* Booking Type Toggle */}
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Booking Workflow</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div
                onClick={() => handleTypeChange('WALK_IN')}
                style={{
                  padding: '16px',
                  border: `2px solid ${appointmentType === 'WALK_IN' ? 'var(--primary)' : 'var(--border-subtle)'}`,
                  background: appointmentType === 'WALK_IN' ? 'var(--primary-light)' : '#ffffff',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem' }}>
                  🚶 Walk-In Booking
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Patient is present at clinic today. Issues token on arrival confirmation.
                </div>
              </div>

              <div
                onClick={() => handleTypeChange('ADVANCE')}
                style={{
                  padding: '16px',
                  border: `2px solid ${appointmentType === 'ADVANCE' ? 'var(--primary)' : 'var(--border-subtle)'}`,
                  background: appointmentType === 'ADVANCE' ? 'var(--primary-light)' : '#ffffff',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem' }}>
                  📅 Advance Appointment
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Scheduled 1 to 7 days ahead. Arrival and token issued on the visit date.
                </div>
              </div>
            </div>
          </div>

          {/* Patient Selection */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>Select Patient *</label>
              <Link to="/receptionist/patients/register" style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>
                + Register New Patient
              </Link>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search patient by name or phone..."
                value={patientSearchTerm}
                onChange={(e) => handlePatientSearch(e.target.value)}
              />
            </div>

            <select
              className="form-select"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              required
            >
              <option value="">-- Choose Patient --</option>
              {patients.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.full_name || `${pt.first_name} ${pt.last_name}`} (UHID: {pt.uhid || pt.id}, Phone: {pt.phone || 'N/A'})
                </option>
              ))}
            </select>
          </div>

          {/* Doctor Selection */}
          <div className="form-group">
            <label className="form-label">Consulting Doctor *</label>
            <select
              className="form-select"
              value={selectedDoctorId}
              onChange={(e) => {
                setSelectedDoctorId(e.target.value);
                setSelectedSlotTime('');
              }}
              required
            >
              <option value="">-- Choose Doctor --</option>
              {doctors.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.full_name || `Dr. ${doc.user?.first_name || ''} ${doc.user?.last_name || ''}`} — {doc.department_name || doc.specialization || 'General Physician'} (Fee: ₹{doc.consultation_fee || 500})
                </option>
              ))}
            </select>
          </div>

          {/* Date Selection */}
          <div className="form-group">
            <label className="form-label">
              Appointment Date * {appointmentType === 'WALK_IN' ? '(Locked to Today)' : '(Between Tomorrow and 7 Days Ahead)'}
            </label>
            <input
              type="date"
              className="form-control"
              value={appointmentDate}
              min={appointmentType === 'WALK_IN' ? todayStr : tomorrowStr}
              max={appointmentType === 'WALK_IN' ? todayStr : maxAdvanceStr}
              disabled={appointmentType === 'WALK_IN'}
              onChange={(e) => {
                setAppointmentDate(e.target.value);
                setSelectedSlotTime('');
              }}
              required
            />
          </div>

          {/* Time Slot Selection */}
          <div className="form-group">
            <label className="form-label">Available Time Slots *</label>
            {loadingSlots ? (
              <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Fetching doctor schedule and availability...
              </div>
            ) : slots.length === 0 ? (
              <div style={{ padding: '16px', background: '#f8fafc', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                No slots available for this doctor on the selected date. Please pick another date or doctor.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px', maxHeight: '200px', overflowY: 'auto', padding: '4px' }}>
                {slots.map((slot, idx) => {
                  const slotTime = typeof slot === 'string' ? slot : (slot.time || slot.slot_time);
                  const isAvailable = typeof slot === 'object' ? slot.is_available !== false : true;
                  const isSelected = selectedSlotTime === slotTime;

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => setSelectedSlotTime(slotTime)}
                      style={{
                        padding: '10px 8px',
                        border: `1px solid ${isSelected ? 'var(--primary)' : isAvailable ? 'var(--border-subtle)' : '#e2e8f0'}`,
                        background: isSelected ? 'var(--primary)' : isAvailable ? '#ffffff' : '#f1f5f9',
                        color: isSelected ? '#ffffff' : isAvailable ? 'var(--text-main)' : '#94a3b8',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: isAvailable ? 'pointer' : 'not-allowed',
                        textAlign: 'center'
                      }}
                    >
                      {slotTime}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="form-group">
            <label className="form-label">Reason / Symptoms</label>
            <textarea
              className="form-control"
              rows="2"
              placeholder="e.g. Fever, persistent cough, regular blood pressure checkup"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => navigate('/receptionist/appointments')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !selectedSlotTime || !selectedPatientId || !selectedDoctorId}
            >
              {submitting ? 'Confirming Booking...' : 'Confirm Appointment Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookAppointmentPage;
