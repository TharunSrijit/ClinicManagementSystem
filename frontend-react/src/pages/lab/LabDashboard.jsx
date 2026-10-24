import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import labService from '../../services/labService';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import { formatDate } from '../../utils/formatters';

export const LabDashboard = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [results, setResults] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const loadLabData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersData, resultsData, invoicesData] = await Promise.all([
        labService.getLabOrders().catch(() => []),
        labService.getLabResults().catch(() => []),
        labService.getInvoices().catch(() => [])
      ]);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setResults(Array.isArray(resultsData) ? resultsData : []);
      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
    } catch (err) {
      console.error('Failed to load lab summary:', err);
      setFeedback({ message: 'Could not load laboratory telemetry.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLabData();
  }, [loadLabData]);

  const requestedCount = orders.filter(o => o.status === 'REQUESTED').length;
  const processingCount = orders.filter(o => o.status === 'SAMPLE_COLLECTED' || o.status === 'IN_PROGRESS').length;
  const completedCount = orders.filter(o => o.status === 'COMPLETED').length;

  const pendingColumns = [
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
      header: 'Ordered On',
      key: 'ordered_date',
      render: (row) => <span>{formatDate(row.ordered_date || row.created_at)}</span>
    },
    {
      header: 'Workflow Stage',
      key: 'status',
      render: (row) => <Badge status={row.status} />
    },
    {
      header: 'Action',
      key: 'action',
      render: (row) => (
        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/lab/orders')}
        >
          Process Order →
        </button>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Diagnostic Laboratory Overview</h1>
          <p className="page-subtitle">Specimen intake, investigation processing, and diagnostic findings telemetry.</p>
        </div>
        <button className="btn btn-outline" onClick={loadLabData}>
          🔄 Refresh
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      {/* KPI Stats */}
      <div className="grid-stats">
        <StatCard
          title="New Test Requests"
          value={requestedCount}
          icon="📥"
          subtitle="Awaiting specimen draw"
          trend="Intake"
          trendType="neutral"
        />
        <StatCard
          title="In Processing / Analyzers"
          value={processingCount}
          icon="🔬"
          subtitle="Tests being assayed"
          trend="Active"
        />
        <StatCard
          title="Completed Reports"
          value={completedCount}
          icon="✅"
          subtitle="Findings delivered"
          trendType="positive"
        />
        <StatCard
          title="Total Lab Invoices"
          value={invoices.length}
          icon="🧾"
          subtitle="Diagnostic statements"
        />
      </div>

      {/* Quick Access Action Shortcuts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div
          className="card"
          style={{ cursor: 'pointer', textAlign: 'center', padding: '20px' }}
          onClick={() => navigate('/lab/orders')}
        >
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🧪</div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Lab Test Orders</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Sample draw & specimen intake</div>
        </div>

        <div
          className="card"
          style={{ cursor: 'pointer', textAlign: 'center', padding: '20px' }}
          onClick={() => navigate('/lab/results')}
        >
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📝</div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Enter Test Results</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Record parameters & publish</div>
        </div>

        <div
          className="card"
          style={{ cursor: 'pointer', textAlign: 'center', padding: '20px' }}
          onClick={() => navigate('/lab/billing')}
        >
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💳</div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Laboratory Billing</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Invoices & payment records</div>
        </div>
      </div>

      {/* Active Investigations Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
              Awaiting Processing ({orders.filter(o => o.status !== 'COMPLETED').length})
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Pending blood, urine, and pathology orders requiring sample collection or testing.
            </p>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => navigate('/lab/orders')}
          >
            Manage All Orders →
          </button>
        </div>

        <DataTable
          columns={pendingColumns}
          data={orders.filter(o => o.status !== 'COMPLETED').slice(0, 8)}
          loading={loading}
          emptyMessage="No pending lab tests waiting for processing."
        />
      </div>
    </div>
  );
};

export default LabDashboard;
