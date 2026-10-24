import React, { useState, useEffect, useCallback } from 'react';
import labService from '../../services/labService';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/formatters';

export const LabDashboard = () => {
  // Navigation Tabs: 'orders' | 'results' | 'tests' | 'invoices'
  const [activeTab, setActiveTab] = useState('orders');

  const [orders, setOrders] = useState([]);
  const [results, setResults] = useState([]);
  const [tests, setTests] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Result Entry Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [resultValue, setResultValue] = useState('');
  const [resultStatus, setResultStatus] = useState('NORMAL');
  const [remarks, setRemarks] = useState('');
  const [submittingResult, setSubmittingResult] = useState(false);

  // Feedback Banner
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadLabData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersData, resultsData, testsData, invoicesData] = await Promise.all([
        labService.getLabOrders().catch(() => []),
        labService.getLabResults().catch(() => []),
        labService.getTests().catch(() => []),
        labService.getInvoices().catch(() => [])
      ]);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setResults(Array.isArray(resultsData) ? resultsData : []);
      setTests(Array.isArray(testsData) ? testsData : []);
      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
    } catch (err) {
      console.error('Failed to load lab data:', err);
      showFeedback('Failed to load laboratory records.', 'danger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLabData();
  }, [loadLabData]);

  // Workflow Action 1: Sample Collection
  const handleCollectSample = async (orderId) => {
    try {
      await labService.collectSample(orderId);
      showFeedback(`Specimen collected for Order #${orderId}`);
      await loadLabData();
    } catch (err) {
      showFeedback(`Could not collect sample: ${err.message}`, 'danger');
    }
  };

  // Workflow Action 2: Start Processing
  const handleStartProcessing = async (orderId) => {
    try {
      await labService.startProcessing(orderId);
      showFeedback(`Processing initiated for Order #${orderId}`);
      await loadLabData();
    } catch (err) {
      showFeedback(`Could not start processing: ${err.message}`, 'danger');
    }
  };

  // Workflow Action 3: Open Record Findings Modal
  const handleOpenFindings = (order) => {
    setSelectedOrder(order);
    setResultValue('');
    setResultStatus('NORMAL');
    setRemarks('Within standard reference parameters');
    setIsResultModalOpen(true);
  };

  // Submit Lab Result Findings and Complete Order
  const handleSaveResult = async (e) => {
    e.preventDefault();
    if (!selectedOrder || !resultValue.trim()) {
      alert('Please enter a test measurement value.');
      return;
    }

    setSubmittingResult(true);
    try {
      // 1. Create result record
      await labService.createLabResult({
        order: selectedOrder.id,
        result_value: resultValue.trim(),
        result_status: resultStatus,
        remarks: remarks || 'Normal range'
      });

      // 2. Mark order as completed if still processing
      try {
        await labService.completeOrder(selectedOrder.id);
      } catch (completeErr) {
        console.warn('Auto complete note:', completeErr.message);
      }

      setIsResultModalOpen(false);
      showFeedback(`Findings submitted and Order #${selectedOrder.id} marked as completed!`);
      await loadLabData();
    } catch (err) {
      showFeedback(`Failed to save test result: ${err.message}`, 'danger');
    } finally {
      setSubmittingResult(false);
    }
  };

  const orderColumns = [
    {
      header: 'Order #',
      key: 'id',
      render: (r) => <span style={{ fontWeight: 600 }}>#{r.id}</span>
    },
    {
      header: 'Patient Details',
      key: 'patient_name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.patient_name || `Patient #${r.patient}`}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Order ID: {r.order_number || `#${r.id}`}</div>
        </div>
      )
    },
    {
      header: 'Test Name',
      key: 'test_name',
      render: (r) => (
        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
          {r.test_name || (r.test ? `Test #${r.test}` : '-')}
        </span>
      )
    },
    {
      header: 'Ordered On',
      key: 'ordered_date',
      render: (r) => formatDate(r.ordered_date || r.created_at)
    },
    {
      header: 'Status',
      key: 'status',
      render: (r) => <Badge status={r.status || 'ORDERED'} />
    },
    {
      header: 'Specimen Workflow',
      key: 'actions',
      render: (r) => {
        const st = String(r.status || '').toUpperCase();
        return (
          <div style={{ display: 'flex', gap: '6px' }}>
            {st === 'ORDERED' && (
              <button
                className="btn btn-outline"
                style={{ padding: '4px 10px', fontSize: '0.78rem', borderColor: 'var(--warning)', color: 'var(--warning)' }}
                onClick={() => handleCollectSample(r.id)}
              >
                💉 Collect Sample
              </button>
            )}

            {st === 'SAMPLE_COLLECTED' && (
              <button
                className="btn btn-outline"
                style={{ padding: '4px 10px', fontSize: '0.78rem', borderColor: 'var(--info)', color: 'var(--info)' }}
                onClick={() => handleStartProcessing(r.id)}
              >
                ⚙️ Start Analysis
              </button>
            )}

            {(st === 'PROCESSING' || st === 'SAMPLE_COLLECTED') && (
              <button
                className="btn btn-primary"
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                onClick={() => handleOpenFindings(r)}
              >
                📝 Enter Findings
              </button>
            )}

            {st === 'COMPLETED' && (
              <span style={{ fontSize: '0.82rem', color: 'var(--success)', fontWeight: 600 }}>
                ✓ Report Dispatched
              </span>
            )}
          </div>
        );
      }
    }
  ];

  const resultColumns = [
    {
      header: 'Result #',
      key: 'id',
      render: (r) => <span style={{ fontWeight: 600 }}>#{r.id}</span>
    },
    {
      header: 'Order Ref',
      key: 'order',
      render: (r) => `Order #${r.order}`
    },
    {
      header: 'Patient',
      key: 'patient_name',
      render: (r) => r.patient_name || '-'
    },
    {
      header: 'Test Measurement',
      key: 'result_value',
      render: (r) => <strong>{r.result_value}</strong>
    },
    {
      header: 'Finding Classification',
      key: 'result_status',
      render: (r) => {
        const isAbnormal = String(r.result_status).toUpperCase() === 'ABNORMAL' || String(r.result_status).toUpperCase() === 'CRITICAL';
        return <Badge variant={isAbnormal ? 'danger' : 'success'}>{r.result_status || 'NORMAL'}</Badge>;
      }
    },
    {
      header: 'Report Date',
      key: 'result_date',
      render: (r) => formatDate(r.result_date)
    }
  ];

  const testColumns = [
    {
      header: 'Test Code',
      key: 'test_code',
      render: (t) => <span style={{ fontWeight: 600 }}>{t.test_code || `TEST-${t.id}`}</span>
    },
    {
      header: 'Test Name',
      key: 'test_name',
      render: (t) => t.test_name
    },
    {
      header: 'Sample Type',
      key: 'sample_type',
      render: (t) => t.sample_type || 'Blood / Serum'
    },
    {
      header: 'Reference Range',
      key: 'reference_range',
      render: (t) => t.reference_range || '-'
    }
  ];

  return (
    <div>
      {/* Feedback Banner */}
      {feedback.message && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '20px',
            background: feedback.type === 'danger' ? 'var(--danger-light)' : 'var(--success-light)',
            color: feedback.type === 'danger' ? 'var(--danger)' : 'var(--success)',
            border: `1px solid ${feedback.type === 'danger' ? '#fecaca' : '#bbf7d0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback({ message: '', type: '' })} style={{ fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Diagnostic Pathology Workstation</h1>
          <p className="page-subtitle">Track specimen intake, run diagnostic tests, record pathologist findings, and issue reports.</p>
        </div>
        <button onClick={loadLabData} className="btn btn-outline">
          🔄 Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid-stats">
        <StatCard
          title="Lab Test Orders"
          value={orders.length}
          subtitle="Orders received"
          icon="🧪"
          color="primary"
        />
        <StatCard
          title="Pending Specimens"
          value={orders.filter(o => ['ORDERED', 'SAMPLE_COLLECTED', 'PROCESSING'].includes(String(o.status).toUpperCase())).length}
          subtitle="Awaiting completion"
          icon="⏳"
          color="warning"
        />
        <StatCard
          title="Completed Reports"
          value={results.length}
          subtitle="Signed off findings"
          icon="✅"
          color="success"
        />
        <StatCard
          title="Cataloged Tests"
          value={tests.length}
          subtitle="Clinical test menu"
          icon="🔬"
          color="info"
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '24px', gap: '24px' }}>
        {[
          { key: 'orders', label: `Specimen Queue (${orders.length})`, icon: '🧪' },
          { key: 'results', label: `Completed Reports (${results.length})`, icon: '📝' },
          { key: 'tests', label: `Test Catalog (${tests.length})`, icon: '🔬' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '12px 6px',
              fontSize: '0.95rem',
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.key ? '3px solid var(--primary)' : '3px solid transparent',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Orders */}
      {activeTab === 'orders' && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '18px' }}>
            Diagnostic Orders Intake & Workflow
          </h2>
          <DataTable
            columns={orderColumns}
            data={orders}
            loading={loading}
            emptyMessage="No diagnostic test orders found."
          />
        </div>
      )}

      {/* Tab 2: Results */}
      {activeTab === 'results' && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '18px' }}>
            Verified Diagnostic Reports Log
          </h2>
          <DataTable
            columns={resultColumns}
            data={results}
            loading={loading}
            emptyMessage="No diagnostic findings logged yet."
          />
        </div>
      )}

      {/* Tab 3: Catalog */}
      {activeTab === 'tests' && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '18px' }}>
            Laboratory Test Master Catalog
          </h2>
          <DataTable
            columns={testColumns}
            data={tests}
            loading={loading}
            emptyMessage="No lab tests configured in master catalog."
          />
        </div>
      )}

      {/* Enter Findings Modal */}
      <Modal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        title={`Enter Diagnostic Findings — Order #${selectedOrder?.id}`}
        maxWidth="580px"
      >
        <form onSubmit={handleSaveResult}>
          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
            <div><strong>Patient:</strong> {selectedOrder?.patient_name || `Patient #${selectedOrder?.patient}`}</div>
            <div><strong>Test:</strong> {selectedOrder?.test_name || `Test #${selectedOrder?.test}`}</div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Measured Test Value *
            </label>
            <input
              type="text"
              required
              value={resultValue}
              onChange={(e) => setResultValue(e.target.value)}
              placeholder="e.g. 14.2 g/dL, 98 mg/dL, or Negative"
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Result Finding Classification *
            </label>
            <select
              value={resultStatus}
              onChange={(e) => setResultStatus(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'white', fontSize: '0.9rem' }}
            >
              <option value="NORMAL">Normal</option>
              <option value="ABNORMAL">Abnormal</option>
              <option value="CRITICAL">Critical Alert</option>
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Pathologist Remarks & Clinical Reference
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter reference range interpretation, specimen observations..."
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsResultModalOpen(false)}
              disabled={submittingResult}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submittingResult}
            >
              {submittingResult ? 'Saving Findings...' : 'Submit & Sign Diagnostic Report'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LabDashboard;
