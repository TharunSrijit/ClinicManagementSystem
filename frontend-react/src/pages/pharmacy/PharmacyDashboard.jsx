import React, { useState, useEffect } from 'react';
import pharmacyService from '../../services/pharmacyService';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/formatters';

export const PharmacyDashboard = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [submittingDispense, setSubmittingDispense] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rxData, stockData] = await Promise.all([
        pharmacyService.getPrescriptions().catch(() => []),
        pharmacyService.getStock().catch(() => [])
      ]);
      setPrescriptions(Array.isArray(rxData) ? rxData : []);
      setStock(Array.isArray(stockData) ? stockData : []);
    } catch (err) {
      console.error('Failed to load pharmacy data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDispense = (rx) => {
    setSelectedPrescription(rx);
    setIsDispenseModalOpen(true);
  };

  const handleConfirmDispense = async (e) => {
    e.preventDefault();
    if (!selectedPrescription) return;

    setSubmittingDispense(true);
    try {
      await pharmacyService.createDispense({
        prescription: selectedPrescription.id,
        notes: 'Dispensed per doctor prescription'
      });
      setIsDispenseModalOpen(false);
      await loadData();
    } catch (err) {
      alert('Failed to dispense medication: ' + (err.message || 'Error'));
    } finally {
      setSubmittingDispense(false);
    }
  };

  const columns = [
    {
      header: 'Rx #',
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
            Prescribed by: {row.doctor_name || 'Clinic Physician'}
          </div>
        </div>
      )
    },
    {
      header: 'Prescription Date',
      key: 'created_at',
      render: (row) => formatDate(row.created_at || row.prescription_date)
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
          onClick={() => handleOpenDispense(row)}
        >
          💊 Dispense
        </button>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pharmacy & Dispensing Unit</h1>
          <p className="page-subtitle">Fulfill patient prescriptions, manage medicine inventory, and track stock replenishment.</p>
        </div>
        <button onClick={loadData} className="btn btn-outline">
          🔄 Refresh
        </button>
      </div>

      <div className="grid-stats">
        <StatCard
          title="Prescriptions"
          value={prescriptions.length}
          subtitle="Orders received"
          icon="📋"
          color="primary"
        />
        <StatCard
          title="Stock Items"
          value={stock.length}
          subtitle="Active pharmaceutical batches"
          icon="📦"
          color="info"
        />
        <StatCard
          title="Pending Dispenses"
          value={prescriptions.filter(p => !['DISPENSED', 'COMPLETED'].includes(String(p.status || '').toUpperCase())).length}
          subtitle="Awaiting pickup"
          icon="⏳"
          color="warning"
        />
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '16px' }}>
          Prescription Fulfillment Queue
        </h2>
        <DataTable
          columns={columns}
          data={prescriptions}
          loading={loading}
          emptyMessage="No pending prescriptions found"
        />
      </div>

      <Modal
        isOpen={isDispenseModalOpen}
        onClose={() => setIsDispenseModalOpen(false)}
        title={`Dispense Medication — Rx #${selectedPrescription?.id}`}
      >
        <form onSubmit={handleConfirmDispense}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Patient
            </label>
            <div style={{ padding: '10px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <strong>{selectedPrescription?.patient_name || `Patient #${selectedPrescription?.patient}`}</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Prescription issued on {formatDate(selectedPrescription?.created_at || selectedPrescription?.prescription_date)}
              </div>
            </div>
          </div>

          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Verify medications and dosages with the patient before dispensing. Confirming will deduct inventory and prepare invoice.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsDispenseModalOpen(false)}
              disabled={submittingDispense}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submittingDispense}
            >
              {submittingDispense ? 'Processing...' : 'Confirm Dispense'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PharmacyDashboard;
