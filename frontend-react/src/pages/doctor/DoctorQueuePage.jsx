import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import doctorService from '../../services/doctorService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { formatTime } from '../../utils/formatters';

export const DoctorQueuePage = () => {
  const navigate = useNavigate();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const data = await doctorService.getAppointments(todayStr);
      // Filter for active appointments in queue today
      const list = Array.isArray(data) ? data : [];
      setAppointments(list);
    } catch (err) {
      console.error('Failed to load doctor queue:', err);
      setFeedback({ message: 'Could not load today\'s queue.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Sort: Waiting/Confirmed first, then In Progress, then Completed
  const sortedQueue = [...appointments].sort((a, b) => {
    const statusPriority = { IN_PROGRESS: 1, CONFIRMED: 2, SCHEDULED: 3, COMPLETED: 4, CANCELLED: 5 };
    const pA = statusPriority[a.status] || 99;
    const pB = statusPriority[b.status] || 99;
    if (pA !== pB) return pA - pB;
    return (a.token_number || 999) - (b.token_number || 999);
  });

  const columns = [
    {
      header: 'Token #',
      key: 'token_number',
      render: (row) => (
        <span
          style={{
            fontSize: '1.15rem',
            fontWeight: 700,
            color: 'var(--primary)',
            background: 'var(--primary-light)',
            padding: '3px 10px',
            borderRadius: '4px'
          }}
        >
          #{row.token_number || row.id}
        </span>
      )
    },
    {
      header: 'Slot Time',
      key: 'appointment_time',
      render: (row) => <span style={{ fontWeight: 600 }}>{formatTime(row.appointment_time)}</span>
    },
    {
      header: 'Patient Name',
      key: 'patient_name',
      render: (row) => (
        <div>
          <span style={{ fontWeight: 600 }}>{row.patient_name || `Patient #${row.patient}`}</span>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{row.patient_phone || ''}</div>
        </div>
      )
    },
    {
      header: 'Type',
      key: 'appointment_type',
      render: (row) => (
        <span style={{ fontSize: '0.82rem' }}>
          {row.appointment_type === 'WALK_IN' ? '🚶 Walk-In' : '📅 Advance'}
        </span>
      )
    },
    {
      header: 'Reason',
      key: 'reason',
      render: (row) => <span>{row.reason || 'General checkup'}</span>
    },
    {
      header: 'Queue Status',
      key: 'status',
      render: (row) => <Badge status={row.status} />
    },
    {
      header: 'Action',
      key: 'action',
      render: (row) => {
        if (row.status === 'COMPLETED') {
          return <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>✓ Finished</span>;
        }
        if (row.status === 'CANCELLED') {
          return <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Cancelled</span>;
        }
        return (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/doctor/consultations?appointment=${row.id}`)}
          >
            Call Patient / Examine
          </button>
        );
      }
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Today's Token Queue</h1>
          <p className="page-subtitle">Sequential waiting room queue for active clinical consultations today.</p>
        </div>
        <button className="btn btn-outline" onClick={loadQueue}>
          🔄 Refresh Queue
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      <DataTable
        columns={columns}
        data={sortedQueue}
        loading={loading}
        emptyMessage="No patients currently waiting in today's queue."
      />
    </div>
  );
};

export default DoctorQueuePage;
