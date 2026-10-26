import React, { useState, useEffect, useCallback } from 'react';
import doctorService from '../../services/doctorService';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/formatters';

export const DoctorPrescriptionsPage = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ message: '', type: '' });
  const [selectedRx, setSelectedRx] = useState(null);

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
        <span style={{ fontWeight: 600, color: 'var(--primary, #0284c7)', fontFamily: 'monospace' }}>
          {row.prescription_number || `#${row.id}`}
        </span>
      )
    },
    {
      header: 'Patient',
      key: 'patient_name',
      render: (row) => (
        <div>
          <span style={{ fontWeight: 600, display: 'block' }}>
            {row.patient_name || `Patient #${row.patient}`}
          </span>
          {row.consultation && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Consultation #{row.consultation}
              {row.consultation_diagnosis ? ` (${row.consultation_diagnosis})` : ''}
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Prescribed Items',
      key: 'items',
      render: (row) => {
        const items = row.items || [];
        if (items.length === 0) return <span style={{ color: 'var(--text-muted)' }}>No items</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {items.map((it, idx) => (
              <div key={idx} style={{ fontSize: '0.84rem' }}>
                <span style={{ fontWeight: 600 }}>{it.medicine_name || `Med #${it.medicine}`}</span>
                {it.dosage_name && <span style={{ color: 'var(--text-muted)' }}> — {it.dosage_name}</span>}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {' '}({it.frequency || 'Daily'}{it.duration ? `, ${it.duration}` : ''}{it.quantity ? `, Qty: ${it.quantity}` : ''})
                </span>
                {it.instructions && (
                  <div style={{ fontSize: '0.78rem', color: '#0369a1', fontStyle: 'italic', paddingLeft: '4px' }}>
                    Note: {it.instructions}
                  </div>
                )}
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
      render: (row) => (
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {row.notes || '—'}
        </span>
      )
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => (
        <button
          className="btn btn-outline btn-sm"
          onClick={() => setSelectedRx(row)}
          title="View full prescription details"
        >
          Details
        </button>
      )
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
          Refresh
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

      {/* Prescription Details Modal */}
      <Modal
        isOpen={Boolean(selectedRx)}
        onClose={() => setSelectedRx(null)}
        title={`Prescription ${selectedRx?.prescription_number || ('#' + selectedRx?.id)} Details`}
        maxWidth="700px"
      >
        {selectedRx && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                background: 'var(--surface-muted, #f8fafc)',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                fontSize: '0.88rem'
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>PRESCRIPTION #</span>
                <strong style={{ fontFamily: 'monospace', color: 'var(--primary, #0284c7)' }}>
                  {selectedRx.prescription_number || `#${selectedRx.id}`}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>PATIENT</span>
                <strong>{selectedRx.patient_name || `Patient #${selectedRx.patient}`}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>DATE WRITTEN</span>
                <strong>{formatDate(selectedRx.prescription_date || selectedRx.created_at)}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>LINKED CONSULTATION</span>
                <span>
                  {selectedRx.consultation ? `Consultation #${selectedRx.consultation}` : 'Direct'}
                </span>
              </div>
            </div>

            {selectedRx.consultation_diagnosis && (
              <div style={{ fontSize: '0.88rem' }}>
                <strong style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Diagnosis: </strong>
                <span>{selectedRx.consultation_diagnosis}</span>
              </div>
            )}

            {selectedRx.notes && (
              <div style={{ fontSize: '0.88rem', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', borderLeft: '3px solid var(--primary)' }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>DOCTOR INSTRUCTIONS / NOTES:</strong>
                <p style={{ margin: '4px 0 0 0', fontStyle: 'italic' }}>{selectedRx.notes}</p>
              </div>
            )}

            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px' }}>
                Prescribed Medications ({selectedRx.items?.length || 0})
              </h4>
              {Array.isArray(selectedRx.items) && selectedRx.items.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ fontSize: '0.85rem', width: '100%', margin: 0 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-muted, #f1f5f9)', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>Medicine</th>
                        <th style={{ padding: '8px' }}>Dosage</th>
                        <th style={{ padding: '8px' }}>Frequency</th>
                        <th style={{ padding: '8px' }}>Duration</th>
                        <th style={{ padding: '8px' }}>Qty</th>
                        <th style={{ padding: '8px' }}>Instructions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRx.items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle, #e2e8f0)' }}>
                          <td style={{ padding: '8px', fontWeight: 600 }}>
                            {it.medicine_name || `Medicine #${it.medicine}`}
                          </td>
                          <td style={{ padding: '8px' }}>{it.dosage_name || it.dosage || '—'}</td>
                          <td style={{ padding: '8px' }}>{it.frequency || 'Daily'}</td>
                          <td style={{ padding: '8px' }}>{it.duration || '—'}</td>
                          <td style={{ padding: '8px' }}>{it.quantity || '—'}</td>
                          <td style={{ padding: '8px', color: 'var(--text-muted)' }}>
                            {it.instructions || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No individual medication items recorded.</p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSelectedRx(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DoctorPrescriptionsPage;

