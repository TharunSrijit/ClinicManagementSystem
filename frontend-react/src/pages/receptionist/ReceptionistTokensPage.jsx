import React, { useState, useEffect, useCallback, useMemo } from 'react';
import receptionistService from '../../services/receptionistService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { formatDate, formatTime } from '../../utils/formatters';

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

export const ReceptionistTokensPage = () => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [tokens, setTokens] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedDoctor, setSelectedDoctor] = useState('ALL');
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  useEffect(() => {
    receptionistService.getDoctors()
      .then((docs) => setDoctors(Array.isArray(docs) ? docs : []))
      .catch((err) => console.error('Failed to load doctors list:', err));
  }, []);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    try {
      const data = await receptionistService.getTokens(
        selectedDate || null,
        selectedStatus === 'ALL' ? null : selectedStatus,
        selectedDoctor === 'ALL' ? null : selectedDoctor
      );
      setTokens(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load token queue:', err);
      showFeedback('Could not load tokens from server.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedStatus, selectedDoctor]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const handleCancel = async (tokenId) => {
    if (!window.confirm('Cancel this queue token?')) return;
    setActionLoading(tokenId);
    try {
      await receptionistService.cancelToken(tokenId);
      showFeedback(`Token #${tokenId} cancelled.`, 'info');
      await loadTokens();
    } catch (err) {
      console.error('Cancel token error:', err);
      showFeedback(`Failed to cancel token: ${extractErrorMessage(err)}`, 'danger');
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
            fontSize: '1.1rem',
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
      header: 'Patient Name',
      key: 'patient_name',
      render: (row) => <span style={{ fontWeight: 600 }}>{row.patient_name || 'Patient'}</span>
    },
    {
      header: 'Assigned Doctor',
      key: 'doctor_name',
      render: (row) => <span>{row.doctor_name || 'Doctor'}</span>
    },
    {
      header: 'Type & Slot',
      key: 'appointment_type',
      render: (row) => (
        <div>
          <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>
            {row.appointment_type === 'WALK_IN' ? '🚶 Walk-In' : '📅 Advance'}
          </span>
          {row.appointment_time && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {formatTime(row.appointment_time)}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Date & Time Issued',
      key: 'created_at',
      render: (row) => (
        <div>
          <div>{formatTime(row.created_at)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDate(row.token_date)}</div>
        </div>
      )
    },
    {
      header: 'Appt Ref',
      key: 'appointment',
      render: (row) => <span>Appt #{row.appointment}</span>
    },
    {
      header: 'Queue Status',
      key: 'status',
      render: (row) => (
        <div>
          <Badge status={row.status} />
          {row.status === 'CALLED' && (
            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, marginTop: '2px' }}>
              In Consultation
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => {
        const isLoading = actionLoading === row.id;
        if (row.status === 'COMPLETED') {
          return <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.82rem' }}>✓ Consulted</span>;
        }
        if (row.status === 'CALLED') {
          return <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.82rem' }}>Doctor Calling</span>;
        }
        if (row.status === 'CANCELLED') {
          return <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Cancelled</span>;
        }

        return (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-outline btn-sm"
              style={{ color: 'var(--danger)', borderColor: 'var(--border-subtle)' }}
              onClick={() => handleCancel(row.id)}
              disabled={isLoading}
              title="Cancel queue token"
            >
              {isLoading ? '...' : 'Cancel Token'}
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Live Token Queue</h1>
          <p className="page-subtitle">Real-time clinic consultation queue tracking patient arrival and consultation status.</p>
        </div>
        <button className="btn btn-outline" onClick={loadTokens}>
          🔄 Refresh Queue
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      {/* Filter Toolbar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div className="filter-toolbar" style={{ margin: 0 }}>
          <div className="filter-group">
            <div>
              <label className="form-label">Queue Date</label>
              <input
                type="date"
                className="form-control"
                style={{ width: '160px' }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label">Doctor Queue</label>
              <select
                className="form-select"
                style={{ width: '220px' }}
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
              >
                <option value="ALL">All Doctors</option>
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.full_name ? `Dr. ${doc.full_name}` : `Doctor #${doc.id}`} ({doc.specialization})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Status</label>
              <select
                className="form-select"
                style={{ width: '180px' }}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="WAITING">WAITING (In Waiting Room)</option>
                <option value="CALLED">CALLED (With Doctor)</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          </div>

          <button
            className="btn btn-outline btn-sm"
            style={{ alignSelf: 'flex-end' }}
            onClick={() => {
              setSelectedDate(todayStr);
              setSelectedStatus('ALL');
              setSelectedDoctor('ALL');
            }}
          >
            Today's Tokens
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={tokens}
        loading={loading}
        emptyMessage="No active tokens found for the selected date and status."
      />
    </div>
  );
};

export default ReceptionistTokensPage;
