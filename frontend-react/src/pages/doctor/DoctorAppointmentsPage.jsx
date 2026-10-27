import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import doctorService from '../../services/doctorService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { formatDate, formatTime } from '../../utils/formatters';

export const DoctorAppointmentsPage = () => {
  const navigate = useNavigate();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await doctorService.getAppointments(
        selectedDate || null,
        selectedStatus === 'ALL' ? null : selectedStatus
      );
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load appointments:', err);
      showFeedback('Could not load appointments.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedStatus]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const columns = [
    {
      header: 'ID / Token',
      key: 'id',
      headerStyle: { width: '12%' },
      cellStyle: { width: '12%' },
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
      headerStyle: { width: '17%' },
      cellStyle: { width: '17%' },
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{formatTime(row.appointment_time)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDate(row.appointment_date)}</div>
        </div>
      )
    },
    {
      header: 'Patient Name',
      key: 'patient_name',
      headerStyle: { width: '23%' },
      cellStyle: { width: '23%' },
      render: (row) => (
        <div>
          <span
            style={{ fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}
            onClick={() => navigate(`/doctor/patients/${row.patient}`)}
          >
            {row.patient_name || `Patient #${row.patient}`}
          </span>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {row.patient_phone || row.patient_uhid || ''}
          </div>
        </div>
      )
    },
    {
      header: 'Type',
      key: 'appointment_type',
      headerStyle: { width: '12%' },
      cellStyle: { width: '12%' },
      render: (row) => (
        <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>
          {row.appointment_type === 'WALK_IN' ? 'Walk-In' : 'Advance'}
        </span>
      )
    },
    {
      header: 'Reason',
      key: 'reason',
      headerStyle: { width: '22%' },
      cellStyle: { width: '22%' },
      render: (row) => <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{row.reason || 'General'}</span>
    },
    {
      header: 'Status',
      key: 'status',
      headerStyle: { width: '14%' },
      cellStyle: { width: '14%' },
      render: (row) => <Badge status={row.status} />
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Appointments</h1>
          <p className="page-subtitle">Assigned patient appointments filtered securely to your doctor profile.</p>
        </div>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      {/* Filter Bar */}
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
              <label className="form-label">Status</label>
              <select
                className="form-select"
                style={{ width: '180px' }}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="CONFIRMED">Confirmed / Waiting</option>
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
                setSelectedStatus('ALL');
              }}
            >
              Today
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSelectedDate('');
                setSelectedStatus('ALL');
              }}
            >
              All Dates
            </button>
            <button className="btn btn-outline btn-sm" onClick={loadAppointments}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={appointments}
        loading={loading}
        emptyMessage="No appointments found for the selected date and status."
      />
    </div>
  );
};

export default DoctorAppointmentsPage;
