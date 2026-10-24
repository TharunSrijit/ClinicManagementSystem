import React, { useState, useEffect, useCallback } from 'react';
import pharmacyService from '../../services/pharmacyService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/formatters';

export const PharmacyPrescriptionsPage = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingOnly, setPendingOnly] = useState(true);
  const [selectedRx, setSelectedRx] = useState(null);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadPrescriptions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await pharmacyService.getPrescriptions(pendingOnly ? false : null);
      setPrescriptions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load prescriptions:', err);
      showFeedback('Could not fetch prescriptions queue.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [pendingOnly]);

  useEffect(() => {
    loadPrescriptions();
  }, [loadPrescriptions]);

  const handleOpenDispense = (rx) => {
    setSelectedRx(rx);
    setIsDispenseModalOpen(true);
  };

  const handleConfirmDispense = async () => {
    if (!selectedRx) return;
    setSubmitting(true);
    try {
      // Create dispense record
      await pharmacyService.createDispense({
        prescription: selectedRx.id,
        patient: selectedRx.patient,
        status: 'DISPENSED',
        notes: 'Dispensed by clinic pharmacy'
      });
      showFeedback(`Prescription #${selectedRx.prescription_number || selectedRx.id} fulfilled and stock deducted.`);
      setIsDispenseModalOpen(false);
      await loadPrescriptions();
    } catch (err) {
      console.error('Dispensation failed:', err);
      showFeedback(err.message || 'Dispensation failed. Check inventory levels.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Prescription #',
      key: 'prescription_number',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
          {row.prescription_number || `#${row.id}`}
        </span>
      )
    },
    {
      header: 'Patient Name',
      key: 'patient_name',
      render: (row) => <span style={{ fontWeight: 600 }}>{row.patient_name || `Patient #${row.patient}`}</span>
    },
    {
      header: 'Prescribing Doctor',
      key: 'doctor_name',
      render: (row) => <span>{row.doctor_name || `Dr. #${row.doctor}`}</span>
    },
    {
      header: 'Prescribed Items',
      key: 'items',
      render: (row) => {
        const items = row.items || [];
        if (items.length === 0) return <span style={{ color: 'var(--text-muted)' }}>No items</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {items.map((it, idx) => (
              <div key={idx} style={{ fontSize: '0.85rem' }}>
                <strong>{it.medicine_name || `Med #${it.medicine}`}</strong> — Qty: {it.quantity} ({it.frequency || 'Daily'})
              </div>
            ))}
          </div>
        );
      }
    },
    {
      header: 'Date Written',
      key: 'prescription_date',
      render: (row) => <span>{formatDate(row.prescription_date || row.created_at)}</span>
    },
    {
      header: 'Status',
      key: 'is_dispensed',
      render: (row) => <Badge status={row.is_dispensed ? 'DISPENSED' : 'PENDING'} />
    },
    {
      header: 'Action',
      key: 'actions',
      render: (row) => {
        if (row.is_dispensed) {
          return <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>✓ Dispensed</span>;
        }
        return (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleOpenDispense(row)}
          >
            Dispense Drugs
          </button>
        );
      }
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Prescription Queue</h1>
          <p className="page-subtitle">Verify doctor medication orders, validate formulary availability, and dispense pharmaceuticals.</p>
        </div>
        <button className="btn btn-outline" onClick={loadPrescriptions}>
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
            <button
              className={`btn btn-sm ${pendingOnly ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setPendingOnly(true)}
            >
              Pending Dispensation Only
            </button>
            <button
              className={`btn btn-sm ${!pendingOnly ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setPendingOnly(false)}
            >
              All Prescriptions
            </button>
          </div>

          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Showing {prescriptions.length} prescriptions
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={prescriptions}
        loading={loading}
        emptyMessage="No prescriptions pending fulfillment."
      />

      {/* Dispense Modal */}
      <Modal
        isOpen={isDispenseModalOpen}
        onClose={() => setIsDispenseModalOpen(false)}
        title={`Dispense Medication: Rx #${selectedRx?.prescription_number || selectedRx?.id}`}
      >
        {selectedRx && (
          <div>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Patient</span>
                <span style={{ fontWeight: 600 }}>{selectedRx.patient_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Prescribing Doctor</span>
                <span>{selectedRx.doctor_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Prescription Date</span>
                <span>{formatDate(selectedRx.prescription_date || selectedRx.created_at)}</span>
              </div>
            </div>

            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '10px' }}>
              Items to Dispense:
            </h4>

            <div style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '20px' }}>
              {selectedRx.items && selectedRx.items.length > 0 ? (
                selectedRx.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx < selectedRx.items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.medicine_name || `Medicine #${item.medicine}`}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {item.dosage_name || ''} • {item.instructions || 'Standard usage'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.85rem' }}>
                        Qty: {item.quantity}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No itemized lines recorded on this prescription.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setIsDispenseModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting}
                onClick={handleConfirmDispense}
              >
                {submitting ? 'Dispensing...' : 'Confirm Fulfillment & Deduct Stock'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PharmacyPrescriptionsPage;
