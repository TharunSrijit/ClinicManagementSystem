import React, { useState, useEffect } from 'react';
import labService from '../../services/labService';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/formatters';

export const LabDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [testValue, setTestValue] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submittingResult, setSubmittingResult] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersData, resultsData] = await Promise.all([
        labService.getLabOrders().catch(() => []),
        labService.getLabResults().catch(() => [])
      ]);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setResults(Array.isArray(resultsData) ? resultsData : []);
    } catch (err) {
      console.error('Failed to load lab data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenResultModal = (order) => {
    setSelectedOrder(order);
    setTestValue('');
    setRemarks('');
    setIsResultModalOpen(true);
  };

  const handleSaveResult = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setSubmittingResult(true);
    try {
      await labService.createLabResult({
        order_item: selectedOrder.id,
        result_value: testValue,
        remarks: remarks || 'Normal range'
      });
      setIsResultModalOpen(false);
      await loadData();
    } catch (err) {
      alert('Failed to record test result: ' + (err.message || 'Error'));
    } finally {
      setSubmittingResult(false);
    }
  };

  const columns = [
    {
      header: 'Order #',
      key: 'id',
      render: (row) => <span style={{ fontWeight: 600 }}>#{row.id}</span>
    },
    {
      header: 'Patient',
      key: 'patient_name',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            {row.patient_name || (row.patient ? `Patient #${row.patient}` : 'N/A')}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Referred by: {row.doctor_name || 'Clinic Physician'}
          </div>
        </div>
      )
    },
    {
      header: 'Date Ordered',
      key: 'created_at',
      render: (row) => formatDate(row.created_at || row.order_date)
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => <Badge status={row.status || 'Pending'} />
    },
    {
      header: 'Action',
      key: 'action',
      render: (row) => (
        <button
          className="btn btn-outline"
          style={{ padding: '4px 10px', fontSize: '0.8rem' }}
          onClick={() => handleOpenResultModal(row)}
        >
          🔬 Record Findings
        </button>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Diagnostic Laboratory Workstation</h1>
          <p className="page-subtitle">Process clinical test orders, log pathology specimen results, and dispatch lab reports.</p>
        </div>
        <button onClick={loadData} className="btn btn-outline">
          🔄 Refresh
        </button>
      </div>

      <div className="grid-stats">
        <StatCard
          title="Lab Orders"
          value={orders.length}
          subtitle="Total requested"
          icon="🧪"
          color="primary"
        />
        <StatCard
          title="Completed Reports"
          value={results.length}
          subtitle="Signed off findings"
          icon="✅"
          color="success"
        />
        <StatCard
          title="Pending Analysis"
          value={orders.filter(o => !['COMPLETED', 'CANCELLED'].includes(String(o.status || '').toUpperCase())).length}
          subtitle="Specimens queued"
          icon="⏳"
          color="warning"
        />
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '16px' }}>
          Diagnostic Orders Queue
        </h2>
        <DataTable
          columns={columns}
          data={orders}
          loading={loading}
          emptyMessage="No pending lab orders found"
        />
      </div>

      <Modal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        title={`Enter Diagnostic Findings — Order #${selectedOrder?.id}`}
      >
        <form onSubmit={handleSaveResult}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Patient
            </label>
            <div style={{ padding: '10px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <strong>{selectedOrder?.patient_name || `Patient #${selectedOrder?.patient}`}</strong>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Test Value / Measured Result
            </label>
            <input
              type="text"
              required
              value={testValue}
              onChange={(e) => setTestValue(e.target.value)}
              placeholder="e.g. 13.5 g/dL or Negative"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.9rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Pathologist Remarks
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Reference range analysis, clinical interpretation..."
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.9rem'
              }}
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
              {submittingResult ? 'Saving...' : 'Submit Lab Findings'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LabDashboard;
