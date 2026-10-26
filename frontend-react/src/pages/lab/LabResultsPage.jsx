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
  const [processingOrders, setProcessingOrders] = useState([]);
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
    window.setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadData = useCallback(async () => {
    try {
      const [resultRows, completedOrders, processingOrdersData] = await Promise.all([
        labService.getLabResults(),
        labService.getLabOrders({ status: 'COMPLETED' }),
        labService.getLabOrders({ status: 'PROCESSING' })
      ]);
      const completedById = new Map(completedOrders.map((order) => [String(order.id), order]));
      setResults(resultRows.map((result) => {
        const order = completedById.get(String(result.order));
        return {
          ...result,
          patient_name: order?.patient_name || result.patient_name,
          patient_code: order?.patient_code,
          unit: order?.unit,
          normal_range: order?.normal_range,
          order_number: order?.order_number
        };
      }));
      setProcessingOrders(processingOrdersData);
      setFeedback({ message: '', type: '' });
    } catch (err) {
      console.error('Failed to load lab results:', err);
      showFeedback(err.message || 'Could not load test results and orders.', 'danger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedOrder = processingOrders.find((order) => String(order.id) === String(selectedOrderId));

  const handleSubmitResult = async (event) => {
    event.preventDefault();
    if (!selectedOrder || !resultValue.trim()) {
      showFeedback('Select a processing order and enter its result.', 'danger');
      return;
    }

    setSubmitting(true);
    try {
      const submittedValue = `${resultValue.trim()}${selectedOrder.unit ? ` ${selectedOrder.unit}` : ''}`;
      const completedOrder = await labService.submitResult(selectedOrder.id, {
        result_value: submittedValue,
        result_status: resultStatus,
        remarks: remarks.trim()
      });

      if (completedOrder?.result) {
        setResults((currentResults) => [
          {
            ...completedOrder.result,
            patient_name: selectedOrder.patient_name,
            patient_code: selectedOrder.patient_code,
            unit: selectedOrder.unit,
            normal_range: selectedOrder.normal_range,
            order_number: selectedOrder.order_number
          },
          ...currentResults.filter((result) => result.order !== selectedOrder.id)
        ]);
      }
      setProcessingOrders((currentOrders) =>
        currentOrders.filter((order) => order.id !== selectedOrder.id)
      );
      showFeedback('Result submitted. The backend has completed the order and made the result available to its doctor.');
      setIsModalOpen(false);
      setResultValue('');
      setResultStatus('NORMAL');
      setRemarks('');
      setSelectedOrderId('');
    } catch (err) {
      console.error('Failed to submit lab result:', err);
      showFeedback(err.message || 'Result submission failed.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Order #',
      key: 'order_number',
      render: (row) => row.order_number || `#${row.order}`
    },
    {
      header: 'Patient',
      key: 'patient_name',
      render: (row) => (
        <span>
          {row.patient_name || 'Patient details unavailable'}
          {row.patient_code && <><br /><small>{row.patient_code}</small></>}
        </span>
      )
    },
    {
      header: 'Test',
      key: 'test_name'
    },
    {
      header: 'Reference Range',
      key: 'normal_range',
      render: (row) => row.normal_range || '—'
    },
    {
      header: 'Result',
      key: 'result_value',
      render: (row) => (
        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
          {row.result_value}
        </span>
      )
    },
    {
      header: 'Classification',
      key: 'result_status',
      render: (row) => <Badge status={row.result_status} />
    },
    {
      header: 'Technician Remarks',
      key: 'remarks',
      render: (row) => row.remarks || '—'
    },
    {
      header: 'Report Date',
      key: 'result_date',
      render: (row) => formatDate(row.result_date)
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Diagnostic Test Findings & Reports</h1>
          <p className="page-subtitle">Enter results for processing orders and review completed laboratory reports.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setSelectedOrderId(preselectedOrderId || '');
            setIsModalOpen(true);
          }}
          disabled={processingOrders.length === 0 || loading}
        >
          Enter Test Result
        </button>
      </div>

      {feedback.message && <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>}

      <DataTable
        columns={columns}
        data={results}
        loading={loading}
        emptyMessage="No completed laboratory results are available."
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Laboratory Test Result"
      >
        <form onSubmit={handleSubmitResult}>
          <div className="form-group">
            <label className="form-label" htmlFor="result-order">Processing order *</label>
            <select
              id="result-order"
              className="form-select"
              required
              value={selectedOrderId}
              onChange={(event) => setSelectedOrderId(event.target.value)}
            >
              <option value="">-- Select a processing order --</option>
              {processingOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.order_number} — {order.test_name} — {order.patient_name}
                </option>
              ))}
            </select>
          </div>

          {selectedOrder && (
            <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
              <div><strong>Patient:</strong> {selectedOrder.patient_name} ({selectedOrder.patient_code})</div>
              <div><strong>Test:</strong> {selectedOrder.test_name}</div>
              <div><strong>Reference range:</strong> {selectedOrder.normal_range || 'Not specified'}</div>
              <div><strong>Unit:</strong> {selectedOrder.unit || 'Not specified'}</div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="result-value">
              Result value{selectedOrder?.unit ? ` (${selectedOrder.unit})` : ''} *
            </label>
            <input
              id="result-value"
              type="text"
              className="form-control"
              required
              maxLength="2000"
              placeholder="Enter the observed result"
              value={resultValue}
              onChange={(event) => setResultValue(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="result-status">Result classification *</label>
            <select
              id="result-status"
              className="form-select"
              required
              value={resultStatus}
              onChange={(event) => setResultStatus(event.target.value)}
            >
              <option value="NORMAL">Normal</option>
              <option value="ABNORMAL">Abnormal</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="result-remarks">Technician remarks</label>
            <textarea
              id="result-remarks"
              className="form-control"
              rows="3"
              maxLength="2000"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </div>

          <p className="form-label">
            Submitting a result completes this order in the current backend workflow.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !selectedOrder}>
              {submitting ? 'Submitting...' : 'Submit Result & Complete Order'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LabResultsPage;
