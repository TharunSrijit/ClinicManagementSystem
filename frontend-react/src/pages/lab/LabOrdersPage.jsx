import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import labService from '../../services/labService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { formatDate } from '../../utils/formatters';

const STATUS_FILTERS = [
  ['ALL', 'All Test Orders'],
  ['ORDERED', 'Ordered'],
  ['PAYMENT_PENDING', 'Awaiting Payment'],
  ['PAID', 'Paid / Awaiting Sample'],
  ['SAMPLE_COLLECTED', 'Sample Collected'],
  ['PROCESSING', 'Processing'],
  ['COMPLETED', 'Completed'],
  ['CANCELLED', 'Cancelled']
];

export const LabOrdersPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAllTestsPage = location.pathname === '/lab/all-tests';
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    window.setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadOrders = useCallback(async () => {
    try {
      const data = await labService.getLabOrders({
        status: statusFilter === 'ALL' ? '' : statusFilter,
        search: search.trim()
      });
      setOrders(data);
    } catch (err) {
      console.error('Failed to load lab orders:', err);
      showFeedback(err.message || 'Could not fetch lab orders.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const runOrderAction = async (id, action, successMessage) => {
    setActionLoading(id);
    try {
      await action(id);
      showFeedback(successMessage);
      await loadOrders();
    } catch (err) {
      showFeedback(err.message || 'The lab order could not be updated.', 'danger');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = (order) => {
    if (window.confirm(`Cancel lab order ${order.order_number || `#${order.id}`}?`)) {
      runOrderAction(order.id, labService.cancelOrder, 'Lab order cancelled.');
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
      header: 'Patient',
      key: 'patient_name',
      render: (row) => (
        <span style={{ fontWeight: 600 }}>
          {row.patient_name || `Patient #${row.patient}`}
          <br />
          <small>{row.patient_code || `ID ${row.patient}`}</small>
        </span>
      )
    },
    {
      header: 'Doctor',
      key: 'doctor_name',
      render: (row) => row.doctor_name || `Doctor #${row.doctor}`
    },
    {
      header: 'Test Investigation',
      key: 'test_name',
      render: (row) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.test_name}</span>
    },
    {
      header: 'Date Ordered',
      key: 'ordered_date',
      render: (row) => formatDate(row.ordered_date)
    },
    {
      header: 'Payment',
      key: 'invoice',
      render: (row) => (
        <Badge status={row.invoice?.status || (row.status === 'PAID' ? 'PAID' : 'NOT BILLED')} />
      )
    },
    {
      header: 'Lab Status',
      key: 'status',
      render: (row) => <Badge status={row.status_display || row.status} />
    },
    {
      header: 'Available Actions',
      key: 'actions',
      render: (row) => {
        const isActionRunning = actionLoading === row.id;
        const disabled = isActionRunning;

        if (row.status === 'ORDERED') {
          return (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => runOrderAction(row.id, labService.generateBill, 'Lab bill generated. Record payment in Lab Billing.')}
                disabled={disabled}
              >
                {disabled ? 'Working...' : 'Generate Bill'}
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => handleCancel(row)} disabled={disabled}>
                Cancel
              </button>
            </div>
          );
        }

        if (row.status === 'PAYMENT_PENDING') {
          return (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)' }}>Awaiting payment</span>
              <button className="btn btn-outline btn-sm" onClick={() => handleCancel(row)} disabled={disabled}>
                Cancel
              </button>
            </div>
          );
        }

        if (row.status === 'PAID') {
          return (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => runOrderAction(row.id, labService.collectSample, 'Sample collection recorded.')}
              disabled={disabled}
            >
              {disabled ? 'Recording...' : 'Collect Sample'}
            </button>
          );
        }

        if (row.status === 'SAMPLE_COLLECTED') {
          return (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => runOrderAction(row.id, labService.startProcessing, 'Processing started.')}
              disabled={disabled}
            >
              {disabled ? 'Starting...' : 'Start Processing'}
            </button>
          );
        }

        if (row.status === 'PROCESSING') {
          return (
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/lab/results?order=${row.id}`)}>
              Enter Result
            </button>
          );
        }

        if (row.status === 'COMPLETED') {
          return (
            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/lab/results?order=${row.id}`)}>
              View Result
            </button>
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
          <h1 className="page-title">{isAllTestsPage ? 'All Lab Tests' : 'Diagnostic Test Orders'}</h1>
          <p className="page-subtitle">
            {isAllTestsPage
              ? 'Search current and historical laboratory orders by patient, order ID, or test.'
              : 'Review requests and progress eligible tests through the laboratory workflow.'}
          </p>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => {
            setLoading(true);
            loadOrders();
          }}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh Orders'}
        </button>
      </div>

      {feedback.message && <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>}

      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div className="filter-toolbar" style={{ margin: 0 }}>
          <div className="filter-group">
            <div>
              <label className="form-label" htmlFor="lab-status-filter">Workflow Stage</label>
              <select
                id="lab-status-filter"
                className="form-select"
                style={{ width: '220px' }}
                value={statusFilter}
                onChange={(event) => {
                  setLoading(true);
                  setStatusFilter(event.target.value);
                }}
              >
                {STATUS_FILTERS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="lab-order-search">Search</label>
              <input
                id="lab-order-search"
                className="form-control"
                type="search"
                placeholder="Patient, patient ID, order ID, or test"
                value={search}
                onChange={(event) => {
                  setLoading(true);
                  setSearch(event.target.value);
                }}
              />
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
        emptyMessage="No lab test orders match this filter."
      />
    </div>
  );
};

export default LabOrdersPage;
