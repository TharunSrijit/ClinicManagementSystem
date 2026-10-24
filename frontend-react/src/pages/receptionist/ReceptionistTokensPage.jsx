import React, { useState, useEffect, useCallback, useMemo } from 'react';
import receptionistService from '../../services/receptionistService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { formatDate, formatTime } from '../../utils/formatters';

export const ReceptionistTokensPage = () => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [tokens, setTokens] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const loadTokens = useCallback(async () => {
    setLoading(true);
    try {
      const data = await receptionistService.getTokens(
        selectedDate || null,
        selectedStatus === 'ALL' ? null : selectedStatus
      );
      setTokens(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load token queue:', err);
      setFeedback({ message: 'Could not load tokens from server.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedStatus]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

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
            background: 'var(--primary-light)',
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
      header: 'Appointment Ref',
      key: 'appointment',
      render: (row) => <span>Appt #{row.appointment}</span>
    },
    {
      header: 'Queue Status',
      key: 'status',
      render: (row) => <Badge status={row.status} />
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
              <label className="form-label">Status</label>
              <select
                className="form-select"
                style={{ width: '180px' }}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ISSUED">ISSUED (Waiting)</option>
                <option value="CALLED">CALLED</option>
                <option value="IN_CONSULTATION">IN_CONSULTATION</option>
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
            }}
          >
            Reset Filters
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={tokens}
        loading={loading}
        emptyMessage="No queue tokens found for the selected date and status."
      />
    </div>
  );
};

export default ReceptionistTokensPage;
