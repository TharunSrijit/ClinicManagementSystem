import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import doctorService from '../../services/doctorService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { formatTime, formatDate } from '../../utils/formatters';

const extractErrorMessage = (err, fallback = 'Operation failed.') => {
  const data = err?.data || err?.response?.data;
  if (!data) return err?.message || fallback;
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  if (data.message) return data.message;
  if (typeof data === 'object') {
    const fieldMsgs = Object.entries(data).map(
      ([field, msg]) => `${field}: ${Array.isArray(msg) ? msg.join(' ') : String(msg)}`
    );
    if (fieldMsgs.length > 0) return fieldMsgs.join(' | ');
  }
  return err?.message || fallback;
};

export const DoctorQueuePage = () => {
  const navigate = useNavigate();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const data = await doctorService.getAppointments({ date: todayStr });
      const list = Array.isArray(data) ? data : [];

      // Filter for eligible patients entering the consultation queue:
      // Must have valid token, arrival confirmed, and paid consultation fee.
      const eligibleQueue = list.filter((a) => {
        const hasValidToken = a.token_number && a.token_status !== 'CANCELLED';
        const isArrived = a.status === 'CONFIRMED';
        const isFeePaid = a.is_paid === true;
        const notCompleted = a.status !== 'COMPLETED' && a.token_status !== 'COMPLETED';

        return hasValidToken && isArrived && isFeePaid && notCompleted;
      });

      setAppointments(eligibleQueue);
    } catch (err) {
      console.error('Failed to load doctor queue:', err);
      showFeedback('Could not load today\'s queue from server.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Determine current time in HH:MM:SS for scheduled slot comparison
  const now = new Date();
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  // Recommendation logic:
  // 1. Advance appointments whose scheduled time is due (slot time <= now)
  // 2. If no advance appointment is due, recommend eligible waiting walk-in
  // 3. Otherwise, next scheduled advance appointment
  const { recommendedPatient, recommendationReason } = useMemo(() => {
    const waitingPatients = appointments.filter((a) => a.token_status === 'WAITING');

    const dueAdvance = waitingPatients
      .filter((a) => a.appointment_type === 'ADVANCE' && (!a.appointment_time || a.appointment_time <= currentTimeStr))
      .sort((a, b) => {
        if (a.appointment_time !== b.appointment_time) {
          return (a.appointment_time || '').localeCompare(b.appointment_time || '');
        }
        return (a.token_number || 0) - (b.token_number || 0);
      });

    const waitingWalkIns = waitingPatients
      .filter((a) => a.appointment_type === 'WALK_IN')
      .sort((a, b) => (a.token_number || 0) - (b.token_number || 0));

    const upcomingAdvance = waitingPatients
      .filter((a) => a.appointment_type === 'ADVANCE' && a.appointment_time > currentTimeStr)
      .sort((a, b) => (a.appointment_time || '').localeCompare(b.appointment_time || ''));

    if (dueAdvance.length > 0) {
      return {
        recommendedPatient: dueAdvance[0],
        recommendationReason: `Scheduled Time Due (${formatTime(dueAdvance[0].appointment_time)})`
      };
    }
    if (waitingWalkIns.length > 0) {
      return {
        recommendedPatient: waitingWalkIns[0],
        recommendationReason: `Next Waiting Walk-In (Token #${waitingWalkIns[0].token_number})`
      };
    }
    if (upcomingAdvance.length > 0) {
      return {
        recommendedPatient: upcomingAdvance[0],
        recommendationReason: `Next Scheduled Advance (Slot: ${formatTime(upcomingAdvance[0].appointment_time)})`
      };
    }

    return { recommendedPatient: null, recommendationReason: '' };
  }, [appointments, currentTimeStr]);

  // Sort queue:
  // 1. Currently CALLED (In Consultation) at the top
  // 2. Due advance appointments
  // 3. Waiting walk-in appointments
  // 4. Upcoming advance appointments
  const sortedQueue = useMemo(() => {
    return [...appointments].sort((a, b) => {
      // CALLED patients come first
      if (a.token_status === 'CALLED' && b.token_status !== 'CALLED') return -1;
      if (b.token_status === 'CALLED' && a.token_status !== 'CALLED') return 1;

      // Group by priority category
      const getPriority = (item) => {
        if (item.appointment_type === 'ADVANCE' && (!item.appointment_time || item.appointment_time <= currentTimeStr)) {
          return 1; // Due advance
        }
        if (item.appointment_type === 'WALK_IN') {
          return 2; // Walk-in
        }
        return 3; // Upcoming advance
      };

      const pA = getPriority(a);
      const pB = getPriority(b);
      if (pA !== pB) return pA - pB;

      if (pA === 1 || pA === 3) {
        if (a.appointment_time !== b.appointment_time) {
          return (a.appointment_time || '').localeCompare(b.appointment_time || '');
        }
      }
      return (a.token_number || 0) - (b.token_number || 0);
    });
  }, [appointments, currentTimeStr]);

  const handleStartConsultation = async (appointmentId) => {
    setActionLoading(appointmentId);
    try {
      await doctorService.startConsultation(appointmentId);
      showFeedback('Consultation started! Opening consultation record...');
      await loadQueue();
      navigate(`/doctor/consultations?appointment=${appointmentId}`);
    } catch (err) {
      console.error('Failed to start consultation:', err);
      showFeedback(`Failed to start consultation: ${extractErrorMessage(err)}`, 'danger');
    } finally {
      setActionLoading(null);
    }
  };

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
            background: 'var(--primary-light, #e0f2fe)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)'
          }}
        >
          #{row.token_number}
        </span>
      )
    },
    {
      header: 'Patient Details',
      key: 'patient_name',
      render: (row) => (
        <div>
          <span style={{ fontWeight: 600 }}>{row.patient_name || `Patient #${row.patient}`}</span>
          {row.patient_phone && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{row.patient_phone}</div>
          )}
        </div>
      )
    },
    {
      header: 'Appointment Type',
      key: 'appointment_type',
      render: (row) => (
        <span
          className="badge"
          style={{
            background: row.appointment_type === 'WALK_IN' ? '#fef3c7' : '#e0e7ff',
            color: row.appointment_type === 'WALK_IN' ? '#92400e' : '#3730a3',
            fontSize: '0.8rem'
          }}
        >
          {row.appointment_type === 'WALK_IN' ? '🚶 Walk-In' : '📅 Advance'}
        </span>
      )
    },
    {
      header: 'Slot Time',
      key: 'appointment_time',
      render: (row) => (
        <span style={{ fontWeight: 600 }}>
          {row.appointment_time ? formatTime(row.appointment_time) : 'Walk-In'}
        </span>
      )
    },
    {
      header: 'Arrival Time',
      key: 'arrival_time',
      render: (row) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {row.arrival_time ? formatTime(row.arrival_time) : 'Arrived'}
        </span>
      )
    },
    {
      header: 'Arrival & Fee',
      key: 'status_fee',
      render: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ color: 'var(--success)', fontSize: '0.78rem', fontWeight: 600 }}>
            ✓ Arrived
          </span>
          <span style={{ color: 'var(--success)', fontSize: '0.78rem', fontWeight: 600 }}>
            ✓ Fee Paid
          </span>
        </div>
      )
    },
    {
      header: 'Queue Status',
      key: 'token_status',
      render: (row) => {
        if (row.token_status === 'CALLED') {
          return (
            <span
              className="badge"
              style={{ background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}
            >
              In Consultation
            </span>
          );
        }
        return <Badge status="WAITING" />;
      }
    },
    {
      header: 'Action',
      key: 'action',
      render: (row) => {
        const isCurrentLoading = actionLoading === row.id;

        if (row.token_status === 'CALLED') {
          return (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => navigate(`/doctor/consultations?appointment=${row.id}`)}
              title="Continue active consultation"
            >
              Continue Consultation
            </button>
          );
        }

        return (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleStartConsultation(row.id)}
            disabled={isCurrentLoading}
            title="Call patient into consultation room"
          >
            {isCurrentLoading ? 'Starting...' : 'Start Consultation'}
          </button>
        );
      }
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Doctor Consultation Queue</h1>
          <p className="page-subtitle">
            Eligible waiting patients who have checked in, paid their consultation fee, and received a valid token.
          </p>
        </div>
        <button className="btn btn-outline" onClick={loadQueue}>
          🔄 Refresh Queue
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      {/* Recommended Next Patient Card */}
      {recommendedPatient && (
        <div
          className="card"
          style={{
            marginBottom: '24px',
            border: '2px solid var(--primary)',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.04) 0%, rgba(255, 255, 255, 1) 100%)',
            padding: '20px 24px'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.25rem' }}>🎯</span>
              <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>
                Recommended Next Patient
              </h2>
              <span
                className="badge"
                style={{
                  background: 'var(--primary)',
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  padding: '4px 10px'
                }}
              >
                {recommendationReason}
              </span>
            </div>

            <button
              className="btn btn-primary"
              style={{ fontWeight: 600, padding: '8px 20px', fontSize: '0.95rem' }}
              onClick={() => handleStartConsultation(recommendedPatient.id)}
              disabled={actionLoading === recommendedPatient.id}
            >
              {actionLoading === recommendedPatient.id ? 'Calling In...' : '▶ Start Consultation'}
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px',
              padding: '12px 16px',
              background: '#f8fafc',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Queue Token
              </span>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)' }}>
                #{recommendedPatient.token_number}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Patient
              </span>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {recommendedPatient.patient_name || `Patient #${recommendedPatient.patient}`}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {recommendedPatient.patient_phone || 'No phone'}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Type & Slot Time
              </span>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {recommendedPatient.appointment_type === 'WALK_IN' ? '🚶 Walk-In' : '📅 Advance'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {recommendedPatient.appointment_time ? formatTime(recommendedPatient.appointment_time) : 'Today'}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Arrival & Payment
              </span>
              <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
                ✓ Arrived ({recommendedPatient.arrival_time ? formatTime(recommendedPatient.arrival_time) : 'Confirmed'})
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
                ✓ Consultation Fee Paid
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Reason for Visit
              </span>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontStyle: 'italic' }}>
                "{recommendedPatient.reason || 'General medical checkup'}"
              </div>
            </div>
          </div>

          <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Tip: You can call this recommended patient or select any other eligible patient below when clinically or operationally necessary.
          </p>
        </div>
      )}

      {/* Eligible Patients Table */}
      <div style={{ marginTop: '16px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px' }}>
          Waiting Queue ({sortedQueue.length} {sortedQueue.length === 1 ? 'patient' : 'patients'} eligible)
        </h2>
        <DataTable
          columns={columns}
          data={sortedQueue}
          loading={loading}
          emptyMessage="No eligible patients currently waiting in today's consultation queue."
        />
      </div>
    </div>
  );
};

export default DoctorQueuePage;
