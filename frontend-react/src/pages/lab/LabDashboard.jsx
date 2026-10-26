import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import labService from '../../services/labService';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import { formatDate } from '../../utils/formatters';

const EMPTY_COUNTS = {
  ORDERED: 0,
  PAYMENT_PENDING: 0,
  PAID: 0,
  SAMPLE_COLLECTED: 0,
  PROCESSING: 0,
  COMPLETED: 0,
  CANCELLED: 0
};

export const LabDashboard = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const loadLabData = useCallback(async () => {
    try {
      const [summary, recentOrders] = await Promise.all([
        labService.getSummary(),
        labService.getLabOrders()
      ]);
      setCounts({ ...EMPTY_COUNTS, ...summary.by_status });
      setTotal(summary.total || 0);
      setOrders(recentOrders.slice(0, 8));
      setFeedback({ message: '', type: '' });
    } catch (err) {
      console.error('Failed to load lab dashboard:', err);
      setFeedback({
        message: err.message || 'Could not load laboratory dashboard data.',
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLabData();
  }, [loadLabData]);

  const recentColumns = [
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
      render: (row) => row.patient_name || `Patient #${row.patient}`
    },
    {
      header: 'Doctor',
      key: 'doctor_name',
      render: (row) => row.doctor_name || `Doctor #${row.doctor}`
    },
    {
      header: 'Test',
      key: 'test_name'
    },
    {
      header: 'Ordered On',
      key: 'ordered_date',
      render: (row) => formatDate(row.ordered_date)
    },
    {
      header: 'Payment',
      key: 'payment_status',
      render: (row) => (
        <Badge status={row.invoice?.status || (row.status === 'PAID' ? 'PAID' : 'NOT BILLED')} />
      )
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => <Badge status={row.status_display || row.status} />
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Diagnostic Laboratory Overview</h1>
          <p className="page-subtitle">Current laboratory workflow statistics and recently received test orders.</p>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => {
            setLoading(true);
            loadLabData();
          }}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {feedback.message && <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>}

      <div className="grid-stats">
        <StatCard title="Total Requests" value={total} icon="📥" subtitle="All lab orders" />
        <StatCard title="Awaiting Payment" value={counts.PAYMENT_PENDING} icon="💳" subtitle="Payment required" />
        <StatCard title="Pending Sample Collection" value={counts.PAID} icon="🩸" subtitle="Paid and ready" />
        <StatCard title="Samples Collected" value={counts.SAMPLE_COLLECTED} icon="🧪" subtitle="Awaiting processing" />
        <StatCard title="Processing" value={counts.PROCESSING} icon="🔬" subtitle="Tests in progress" />
        <StatCard title="Completed" value={counts.COMPLETED} icon="✅" subtitle="Results available" />
        <StatCard title="Cancelled" value={counts.CANCELLED} icon="⛔" subtitle="Cancelled orders" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: '20px' }} onClick={() => navigate('/lab/orders')}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🧪</div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Lab Test Orders</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Manage workflow actions</div>
        </div>
        <div className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: '20px' }} onClick={() => navigate('/lab/all-tests')}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📚</div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>All Lab Tests</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Search current and historical orders</div>
        </div>
        <div className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: '20px' }} onClick={() => navigate('/lab/results')}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📝</div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Test Results</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Enter and review findings</div>
        </div>
        <div className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: '20px' }} onClick={() => navigate('/lab/billing')}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💳</div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Laboratory Billing</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Invoices and payments</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
              Recently Received Lab Requests
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Latest orders from doctors, including their payment and processing status.
            </p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/lab/all-tests')}>
            View All Tests
          </button>
        </div>
        <DataTable
          columns={recentColumns}
          data={orders}
          loading={loading}
          emptyMessage="No laboratory requests have been received."
        />
      </div>
    </div>
  );
};

export default LabDashboard;
