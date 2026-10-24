import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import labService from '../../services/labService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { formatDate } from '../../utils/formatters';

export const LabOrdersPage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await labService.getLabOrders(statusFilter === 'ALL' ? null : statusFilter);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load lab orders:', err);
      showFeedback('Could not fetch lab orders.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleCollectSample = async (id) => {
    setActionLoading(id);
    try {
      await labService.collectSample(id);
      showFeedback('Sample collected and specimen cataloged.');
      await loadOrders();
    } catch (err) {
      showFeedback(`Failed to collect sample: ${err.message}`, 'danger');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartProcessing = async (id) => {
    setActionLoading(id);
    try {
      await labService.startProcessing(id);
      showFeedback('Specimen sent to analyzer; test processing initiated.');
      await loadOrders();
    } catch (err) {
      showFeedback(`Failed to start processing: ${err.message}`, 'danger');
    } finally {
      setActionLoading(null);
    }
  };

  const columns = [
    {
      header: 'Order #',
      key: 'order_number',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
          {row.order_number || `#${row.id}`}
        </span>
      )
    },
    {
      header: 'Patient Name',
      key: 'patient_name',
      render: (row) => <span style={{ fontWeight: 600 }}>{row.patient_name || `Patient #${row.patient}`}</span>
    },
    {
      header: 'Test Investigation',
      key: 'test_name',
      render: (row) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.test_name}</span>
    },
    {
      header: 'Date Ordered',
      key: 'ordered_date',
      render: (row) => <span>{formatDate(row.ordered_date || row.created_at)}</span>
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => <Badge status={row.status} />
    },
    {
      header: 'Laboratory Workflow Action',
      key: 'actions',
      render: (row) => {
        const isActionRunning = actionLoading === row.id;

        if (row.status === 'REQUESTED') {
          return (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleCollectSample(row.id)}
              disabled={isActionRunning}
            >
              {isActionRunning ? 'Logging...' : '🩸 Collect Specimen'}
            </button>
          );
        }

        if (row.status === 'SAMPLE_COLLECTED') {
          return (
            <button
              className="btn btn-primary btn-sm"
              style={{ background: 'var(--accent)' }}
              onClick={() => handleStartProcessing(row.id)}
              disabled={isActionRunning}
            >
              {isActionRunning ? 'Starting...' : '🔬 Begin Processing'}
            </button>
          );
        }

        if (row.status === 'IN_PROGRESS') {
          return (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/lab/results?order=${row.id}`)}
            >
              📝 Record Findings
            </button>
          );
        }

        if (row.status === 'COMPLETED') {
          return (
            <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>
              ✓ Test Completed
            </span>
          );
        }

        return <span style={{ color: 'var(--text-muted)' }}>—</span>;
      }
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Diagnostic Test Orders</h1>
          <p className="page-subtitle">Specimen intake, phlebotomy tracking, and processing workflow control.</p>
        </div>
        <button className="btn btn-outline" onClick={loadOrders}>
          🔄 Refresh Orders
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
              <label className="form-label">Workflow Stage</label>
              <select
                className="form-select"
                style={{ width: '220px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Test Orders</option>
                <option value="REQUESTED">Requested (Sample Pending)</option>
                <option value="SAMPLE_COLLECTED">Sample Collected</option>
                <option value="IN_PROGRESS">In Progress (Analyzing)</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>

          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Showing {orders.length} orders
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={orders}
        loading={loading}
        emptyMessage="No lab test orders found for this stage."
      />
    </div>
  );
};

export default LabOrdersPage;
