import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import receptionistService from '../../services/receptionistService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { formatDate, formatTime } from '../../utils/formatters';

export const ReceptionistAppointmentsPage = () => {
  const navigate = useNavigate();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [appts, docs] = await Promise.all([
        receptionistService.getAppointments(
          selectedDate || null,
          selectedDoctor || null,
          selectedStatus === 'ALL' ? null : selectedStatus
        ).catch(() => []),
        receptionistService.getDoctors().catch(() => [])
      ]);
      setAppointments(Array.isArray(appts) ? appts : []);
      setDoctors(Array.isArray(docs) ? docs : []);
    } catch (err) {
      console.error('Failed to load appointments:', err);
      showFeedback('Could not load appointments from server.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedDoctor, selectedStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCheckIn = async (apptId) => {
    setActionLoading(apptId);
    try {
      const res = await receptionistService.checkInAppointment(apptId);
      showFeedback(`Patient checked in successfully! Token #${res.token_number || ''} issued.`);
      await loadData();
    } catch (err) {
      showFeedback(`Check-in failed: ${err.message}`, 'danger');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (apptId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    setActionLoading(apptId);
    try {
      await receptionistService.cancelAppointment(apptId);
      showFeedback('Appointment cancelled.');
      await loadData();
    } catch (err) {
      showFeedback(`Cancellation failed: ${err.message}`, 'danger');
    } finally {
      setActionLoading(null);
    }
  };

  const columns = [
    {
      header: 'ID / Token',
      key: 'id',
      render: (row) => (
        <div>
          <span style={{ fontWeight: 600 }}>#{row.id}</span>
          {row.token_number && (
            <span style={{ marginLeft: '6px', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>
              (Tkn #{row.token_number})
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Time & Date',
      key: 'appointment_time',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{formatTime(row.appointment_time)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDate(row.appointment_date)}</div>
        </div>
      )
    },
    {
      header: 'Patient',
      key: 'patient_name',
      render: (row) => (
        <div>
          <Link
            to={`/receptionist/patients/${row.patient}`}
            style={{ fontWeight: 600, color: 'var(--primary)' }}
          >
            {row.patient_name || `Patient #${row.patient}`}
          </Link>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {row.patient_phone || row.patient_uhid || ''}
          </div>
        </div>
      )
    },
    {
      header: 'Doctor',
      key: 'doctor_name',
      render: (row) => <span>{row.doctor_name || `Dr. #${row.doctor}`}</span>
    },
    {
      header: 'Type',
      key: 'appointment_type',
      render: (row) => (
        <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>
          {row.appointment_type === 'WALK_IN' ? '🚶 Walk-In' : '📅 Advance'}
        </span>
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
      render: (row) => {
        const canCheckIn = row.status === 'SCHEDULED' || row.status === 'CONFIRMED';
        const canCancel = row.status === 'SCHEDULED' || row.status === 'CONFIRMED';

        return (
          <div style={{ display: 'flex', gap: '8px' }}>
            {canCheckIn && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleCheckIn(row.id)}
                disabled={actionLoading === row.id}
              >
                {actionLoading === row.id ? 'Processing...' : 'Arrival Check-in'}
              </button>
            )}
            {canCancel && (
              <button
                className="btn btn-outline btn-sm"
                style={{ color: 'var(--danger)', borderColor: 'var(--border-subtle)' }}
                onClick={() => handleCancel(row.id)}
                disabled={actionLoading === row.id}
              >
                Cancel
              </button>
            )}
            {!canCheckIn && !canCancel && (
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>—</span>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Appointments Directory</h1>
          <p className="page-subtitle">Manage clinic appointments, confirm arrivals, and check patients in.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/receptionist/appointments/book')}
        >
          + Book New Appointment
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>
          {feedback.message}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div className="filter-toolbar" style={{ margin: 0 }}>
          <div className="filter-group">
            <div>
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-control"
                style={{ width: '160px' }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label">Doctor</label>
              <select
                className="form-select"
                style={{ width: '200px' }}
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
              >
                <option value="">All Doctors</option>
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.full_name || `Dr. ${doc.user?.first_name || ''} ${doc.user?.last_name || ''}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Status</label>
              <select
                className="form-select"
                style={{ width: '160px' }}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSelectedDate(todayStr);
                setSelectedDoctor('');
                setSelectedStatus('ALL');
              }}
            >
              Reset Filters
            </button>
            <button className="btn btn-outline btn-sm" onClick={loadData}>
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={appointments}
        loading={loading}
        emptyMessage="No appointments found for the selected filters."
      />
    </div>
  );
};

export default ReceptionistAppointmentsPage;
