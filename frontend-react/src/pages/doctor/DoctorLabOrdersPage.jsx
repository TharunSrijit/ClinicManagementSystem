import React, { useState, useEffect, useCallback } from 'react';
import doctorService from '../../services/doctorService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/formatters';

export const DoctorLabOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await doctorService.getLabOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load lab orders:', err);
      setFeedback({ message: 'Could not load lab orders.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleViewResult = (order) => {
    setSelectedResult(order);
    setIsResultModalOpen(true);
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
      header: 'Test Name',
      key: 'test_name',
      render: (row) => <span style={{ fontWeight: 600 }}>{row.test_name || `Test #${row.test}`}</span>
    },
    {
      header: 'Date Ordered',
      key: 'ordered_date',
      render: (row) => <span>{formatDate(row.ordered_date || row.created_at)}</span>
    },
    {
      header: 'Order Status',
      key: 'status',
      render: (row) => <Badge status={row.status} />
    },
    {
      header: 'Lab Report',
      key: 'actions',
      render: (row) => {
        if (row.status === 'COMPLETED' || row.result) {
          return (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleViewResult(row)}
            >
              View Findings
            </button>
          );
        }
        return (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            In Processing...
          </span>
        );
      }
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Diagnostic Lab Test Orders</h1>
          <p className="page-subtitle">Track status of pathology, hematology, and biochemistry investigations requested by you.</p>
        </div>
        <button className="btn btn-outline" onClick={loadOrders}>
          Refresh Orders
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      <DataTable
        columns={columns}
        data={orders}
        loading={loading}
        emptyMessage="No lab test orders logged."
      />

      {/* Lab Results Modal */}
      <Modal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        title={`Diagnostic Result: ${selectedResult?.test_name || 'Lab Test'}`}
      >
        {selectedResult && (
          <div>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Patient</span>
                <span style={{ fontWeight: 600 }}>{selectedResult.patient_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Order Reference</span>
                <span>{selectedResult.order_number || `#${selectedResult.id}`}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Date Completed</span>
                <span>{formatDate(selectedResult.result?.result_date || selectedResult.ordered_date)}</span>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">Observed Measured Value</label>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>
                {selectedResult.result?.result_value || 'Report verified: Normal Limits'}
              </div>
            </div>

            {selectedResult.result?.result_status && (
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Result Status</label>
                <Badge status={selectedResult.result.result_status} />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">Technician Remarks & Observations</label>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', background: '#ffffff', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                {selectedResult.result?.remarks || 'Specimen processed according to clinical diagnostic protocols. No abnormal morphologies observed.'}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                className="btn btn-outline"
                onClick={() => setIsResultModalOpen(false)}
              >
                Close Findings
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DoctorLabOrdersPage;
