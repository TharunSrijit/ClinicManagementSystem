import React, { useState, useEffect } from 'react';
import doctorService from '../../services/doctorService';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { formatDate, formatTime } from '../../utils/formatters';

export const DoctorDashboard = () => {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isConsultModalOpen, setIsConsultModalOpen] = useState(false);
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [savingConsult, setSavingConsult] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [apptsData, patientsData] = await Promise.all([
        doctorService.getAppointments(),
        doctorService.getPatients()
      ]);
      setAppointments(Array.isArray(apptsData) ? apptsData : []);
      setPatients(Array.isArray(patientsData) ? patientsData : []);
    } catch (err) {
      console.error('Failed to load doctor dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredAppointments = appointments.filter((appt) => {
    if (filterStatus === 'ALL') return true;
    return String(appt.status || '').toUpperCase() === filterStatus;
  });

  const totalAppts = appointments.length;
  const completedAppts = appointments.filter(a => String(a.status).toUpperCase() === 'COMPLETED').length;
  const pendingAppts = appointments.filter(a => ['BOOKED', 'CONFIRMED', 'WAITING'].includes(String(a.status).toUpperCase())).length;

  const handleStartConsult = (appt) => {
    setSelectedAppointment(appt);
    setDiagnosis('');
    setNotes('');
    setIsConsultModalOpen(true);
  };

  const handleSaveConsultation = async (e) => {
    e.preventDefault();
    if (!selectedAppointment) return;

    setSavingConsult(true);
    try {
      await doctorService.createConsultation({
        appointment: selectedAppointment.id,
        diagnosis,
        doctor_notes: notes,
        symptoms: 'Patient review'
      });
      setIsConsultModalOpen(false);
      await loadData();
    } catch (err) {
      alert('Failed to save consultation: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingConsult(false);
    }
  };

  const columns = [
    {
      header: 'ID / Token',
      key: 'id',
      render: (row) => <span style={{ fontWeight: 600 }}>#{row.id}</span>
    },
    {
      header: 'Patient Name',
      key: 'patient_name',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            {row.patient_name || (row.patient ? `Patient #${row.patient}` : 'N/A')}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Phone: {row.patient_phone || '-'}
          </div>
        </div>
      )
    },
    {
      header: 'Date & Slot',
      key: 'appointment_date',
      render: (row) => (
        <div>
          <div>{formatDate(row.appointment_date)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {formatTime(row.appointment_time || row.slot)}
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
      header: 'Actions',
      key: 'actions',
      render: (row) => (
        <button
          className="btn btn-outline"
          style={{ padding: '4px 10px', fontSize: '0.8rem' }}
          onClick={() => handleStartConsult(row)}
        >
          🩺 Consult
        </button>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Doctor Consultation Desk</h1>
          <p className="page-subtitle">Manage appointments, review patient records, and conduct clinical visits.</p>
        </div>
        <button onClick={loadData} className="btn btn-outline">
          🔄 Refresh
        </button>
      </div>

      <div className="grid-stats">
        <StatCard
          title="Today's Appointments"
          value={totalAppts}
          subtitle="Total scheduled"
          icon="📅"
          color="primary"
        />
        <StatCard
          title="Pending / Queue"
          value={pendingAppts}
          subtitle="Awaiting consultation"
          icon="⏳"
          color="warning"
        />
        <StatCard
          title="Completed"
          value={completedAppts}
          subtitle="Finished consultations"
          icon="✅"
          color="success"
        />
        <StatCard
          title="My Patients"
          value={patients.length}
          subtitle="Active clinic records"
          icon="👥"
          color="info"
        />
      </div>

      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Scheduled Appointments</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['ALL', 'CONFIRMED', 'BOOKED', 'COMPLETED', 'CANCELLED'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`btn ${filterStatus === status ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 12px', fontSize: '0.82rem' }}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredAppointments}
          loading={loading}
          emptyMessage="No appointments found for the selected filter"
        />
      </div>

      <Modal
        isOpen={isConsultModalOpen}
        onClose={() => setIsConsultModalOpen(false)}
        title={`Clinical Consultation — Appointment #${selectedAppointment?.id}`}
      >
        <form onSubmit={handleSaveConsultation}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Patient
            </label>
            <div style={{ padding: '10px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <strong>{selectedAppointment?.patient_name || `Patient #${selectedAppointment?.patient}`}</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Scheduled for {formatDate(selectedAppointment?.appointment_date)} at {formatTime(selectedAppointment?.appointment_time)}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Clinical Diagnosis
            </label>
            <textarea
              required
              rows={3}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Enter preliminary diagnosis and observations..."
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.9rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Doctor Notes & Advice
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Clinical advice, dietary precautions, follow-up notes..."
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.9rem'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsConsultModalOpen(false)}
              disabled={savingConsult}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingConsult}
            >
              {savingConsult ? 'Recording...' : 'Complete & Record Visit'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DoctorDashboard;
