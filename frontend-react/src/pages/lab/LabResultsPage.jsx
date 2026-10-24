import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import labService from '../../services/labService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/formatters';

export const LabResultsPage = () => {
  const [searchParams] = useSearchParams();
  const preselectedOrderId = searchParams.get('order') || '';

  const [results, setResults] = useState([]);
  const [inProgressOrders, setInProgressOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(Boolean(preselectedOrderId));
  const [selectedOrderId, setSelectedOrderId] = useState(preselectedOrderId);
  const [resultValue, setResultValue] = useState('');
  const [resultStatus, setResultStatus] = useState('NORMAL');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resData, ordersData] = await Promise.all([
        labService.getLabResults().catch(() => []),
        labService.getLabOrders('IN_PROGRESS').catch(() => [])
      ]);
      setResults(Array.isArray(resData) ? resData : []);
      setInProgressOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (err) {
      console.error('Failed to load lab results:', err);
      showFeedback('Could not fetch test results from server.', 'danger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmitResult = async (e) => {
    e.preventDefault();
    if (!selectedOrderId) {
      alert('Please select an active lab test order.');
      return;
    }
    if (!resultValue.trim()) {
      alert('Please enter observed test result values.');
      return;
    }

    setSubmitting(true);
    try {
      await labService.createLabResult({
        order: Number(selectedOrderId),
        result_value: resultValue.trim(),
        result_status: resultStatus,
        remarks: remarks.trim() || 'Analyzed according to laboratory protocols.'
      });

      // Complete order
      await labService.completeOrder(selectedOrderId).catch(() => {});

      showFeedback('Test result recorded and published successfully!');
      setIsModalOpen(false);
      setResultValue('');
      setRemarks('');
      setSelectedOrderId('');
      await loadData();
    } catch (err) {
      console.error('Failed to record result:', err);
      showFeedback(err.message || 'Result entry failed.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Result ID',
      key: 'id',
      render: (row) => <span style={{ fontWeight: 600 }}>#{row.id}</span>
    },
    {
      header: 'Test Investigation',
      key: 'test_name',
      render: (row) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.test_name || `Test #${row.order}`}</span>
    },
    {
      header: 'Observed Measurement',
      key: 'result_value',
      render: (row) => (
        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
          {row.result_value}
        </span>
      )
    },
    {
      header: 'Pathological Classification',
      key: 'result_status',
      render: (row) => <Badge status={row.result_status} />
    },
    {
      header: 'Technician Remarks',
      key: 'remarks',
      render: (row) => <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{row.remarks || 'Normal morphology'}</span>
    },
    {
      header: 'Report Date',
      key: 'result_date',
      render: (row) => <span>{formatDate(row.result_date || row.created_at)}</span>
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Diagnostic Test Findings & Reports</h1>
          <p className="page-subtitle">Verified laboratory test values, clinical observations, and pathological classifications.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setSelectedOrderId(preselectedOrderId || '');
            setIsModalOpen(true);
          }}
        >
          + Enter Test Findings
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      <DataTable
        columns={columns}
        data={results}
        loading={loading}
        emptyMessage="No laboratory test results recorded yet."
      />

      {/* Enter Test Findings Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Laboratory Test Findings"
      >
        <form onSubmit={handleSubmitResult}>
          <div className="form-group">
            <label className="form-label">Select In-Progress Test Order *</label>
            <select
              className="form-select"
              required
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
            >
              <option value="">-- Choose In-Progress Order --</option>
              {inProgressOrders.map((ord) => (
                <option key={ord.id} value={ord.id}>
                  Order #{ord.order_number || ord.id} — {ord.test_name} ({ord.patient_name || `Patient #${ord.patient}`})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Observed Test Value / Measurement *</label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="e.g. 14.2 g/dL, Positive, 110 mg/dL"
              value={resultValue}
              onChange={(e) => setResultValue(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Result Classification *</label>
            <select
              className="form-select"
              required
              value={resultStatus}
              onChange={(e) => setResultStatus(e.target.value)}
            >
              <option value="NORMAL">NORMAL (Within reference limits)</option>
              <option value="ABNORMAL">ABNORMAL (Outside reference range)</option>
              <option value="CRITICAL">CRITICAL (Requires urgent attention)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Clinical Remarks & Technician Observations</label>
            <textarea
              className="form-control"
              rows="3"
              placeholder="Specimen handled under standard temperature conditions. No hemolysis..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Recording...' : 'Publish Test Findings'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LabResultsPage;
