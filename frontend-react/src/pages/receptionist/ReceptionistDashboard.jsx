import React, { useState, useEffect } from 'react';
import receptionistService from '../../services/receptionistService';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { formatDate, formatTime } from '../../utils/formatters';

export const ReceptionistDashboard = () => {
  const [appointments, setAppointments] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Appointment Modal State
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [apptDate, setApptDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [apptTime, setApptTime] = useState('10:00:00');
  const [submittingAppt, setSubmittingAppt] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [apptsData, tokensData, patientsData, doctorsData] = await Promise.all([
        receptionistService.getAppointments(),
        receptionistService.getTokens(),
        receptionistService.getPatients(),
        receptionistService.getDoctors()
      ]);
      setAppointments(Array.isArray(apptsData) ? apptsData : []);
      setTokens(Array.isArray(tokensData) ? tokensData : []);
      setPatients(Array.isArray(patientsData) ? patientsData : []);
      setDoctors(Array.isArray(doctorsData) ? doctorsData : []);
    } catch (err) {
      console.error('Failed to load receptionist dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedDoctorId) {
      alert('Please select both a patient and a doctor.');
      return;
    }

    setSubmittingAppt(true);
    try {
      await receptionistService.bookAppointment({
        patient: Number(selectedPatientId),
        doctor: Number(selectedDoctorId),
        appointment_date: apptDate,
        appointment_time: apptTime,
        status: 'Booked'
      });
      setIsBookModalOpen(false);
      await loadData();
    } catch (err) {
      alert('Failed to book appointment: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmittingAppt(false);
    }
  };

  const handleUpdateStatus = async (apptId, newStatus) => {
    try {
      await receptionistService.updateAppointmentStatus(apptId, newStatus);
      await loadData();
    } catch (err) {
      alert('Failed to update status: ' + (err.message || 'Error'));
    }
  };

  const columns = [
    {
      header: 'Appt #',
      key: 'id',
      render: (row) => <span style={{ fontWeight: 600 }}>#{row.id}</span>
    },
    {
      header: 'Patient',
      key: 'patient_name',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            {row.patient_name || `Patient #${row.patient}`}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {row.patient_phone || '-'}
          </div>
        </div>
      )
    },
    {
      header: 'Assigned Doctor',
      key: 'doctor_name',
      render: (row) => (
        <span style={{ fontWeight: 500 }}>
          {row.doctor_name || `Dr. #${row.doctor}`}
        </span>
      )
    },
    {
      header: 'Date & Time',
      key: 'appointment_date',
      render: (row) => (
        <div>
          <div>{formatDate(row.appointment_date)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {formatTime(row.appointment_time)}
          </div>
        </div>
      )
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => <Badge status={row.status} />
    },
    {
      header: 'Action',
      key: 'action',
      render: (row) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          {row.status === 'Booked' && (
            <button
              className="btn btn-outline"
              style={{ padding: '3px 8px', fontSize: '0.75rem', color: 'var(--primary)', borderColor: 'var(--primary)' }}
              onClick={() => handleUpdateStatus(row.id, 'Confirmed')}
            >
              Confirm
            </button>
          )}
          {row.status !== 'Cancelled' && row.status !== 'Completed' && (
            <button
              className="btn btn-outline"
              style={{ padding: '3px 8px', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={() => handleUpdateStatus(row.id, 'Cancelled')}
            >
              Cancel
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Front Desk & Reception</h1>
          <p className="page-subtitle">Patient check-in, token allocation, appointment scheduling, and billing.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setIsBookModalOpen(true)} className="btn btn-primary">
            ➕ Book Appointment
          </button>
          <button onClick={loadData} className="btn btn-outline">
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="grid-stats">
        <StatCard
          title="Appointments"
          value={appointments.length}
          subtitle="Scheduled visits"
          icon="📅"
          color="primary"
        />
        <StatCard
          title="Waiting Tokens"
          value={tokens.filter(t => t.status === 'Waiting').length}
          subtitle="In reception queue"
          icon="🎫"
          color="warning"
        />
        <StatCard
          title="Total Patients"
          value={patients.length}
          subtitle="Registered members"
          icon="👥"
          color="info"
        />
        <StatCard
          title="Active Doctors"
          value={doctors.length}
          subtitle="On-duty clinicians"
          icon="🩺"
          color="success"
        />
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '16px' }}>
          Recent Patient Appointments
        </h2>
        <DataTable
          columns={columns}
          data={appointments}
          loading={loading}
          emptyMessage="No scheduled appointments found"
        />
      </div>

      <Modal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        title="Schedule New Appointment"
      >
        <form onSubmit={handleBookAppointment}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Select Patient
            </label>
            <select
              required
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'white'
              }}
            >
              <option value="">-- Choose Patient --</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || `${p.first_name || ''} ${p.last_name || ''}`} ({p.phone_number || p.phone || 'No phone'})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Select Doctor
            </label>
            <select
              required
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'white'
              }}
            >
              <option value="">-- Choose Doctor --</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name || d.name || `Dr. #${d.id}`} ({d.specialization || 'General'})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Date
              </label>
              <input
                type="date"
                required
                value={apptDate}
                onChange={(e) => setApptDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Time Slot
              </label>
              <input
                type="time"
                required
                value={apptTime}
                onChange={(e) => setApptTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsBookModalOpen(false)}
              disabled={submittingAppt}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submittingAppt}
            >
              {submittingAppt ? 'Booking...' : 'Confirm Appointment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ReceptionistDashboard;
