import React, { useState, useEffect, useCallback } from 'react';
import doctorService from '../../services/doctorService';
import DataTable from '../../components/DataTable';
import { formatDate } from '../../utils/formatters';

export const DoctorPrescriptionsPage = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const loadPrescriptions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await doctorService.getPrescriptions();
      setPrescriptions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load prescriptions:', err);
      setFeedback({ message: 'Could not load prescription records.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrescriptions();
  }, [loadPrescriptions]);

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
      header: 'Prescribed Items',
      key: 'items',
      render: (row) => {
        const items = row.items || [];
        if (items.length === 0) return <span style={{ color: 'var(--text-muted)' }}>No items</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {items.map((it, idx) => (
              <div key={idx} style={{ fontSize: '0.85rem' }}>
                <strong>{it.medicine_name || `Med #${it.medicine}`}</strong> — {it.dosage_name || ''} ({it.frequency || 'Daily'}, Qty: {it.quantity})
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
      header: 'Doctor Notes',
      key: 'notes',
      render: (row) => <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{row.notes || '—'}</span>
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Prescription Records</h1>
          <p className="page-subtitle">Medication regimens authored and issued by your clinical practice.</p>
        </div>
        <button className="btn btn-outline" onClick={loadPrescriptions}>
          🔄 Refresh
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      <DataTable
        columns={columns}
        data={prescriptions}
        loading={loading}
        emptyMessage="No prescriptions have been authored yet."
      />
    </div>
  );
};

export default DoctorPrescriptionsPage;
