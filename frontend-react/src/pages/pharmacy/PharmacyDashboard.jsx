import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Pill,
  AlertTriangle,
  ReceiptText,
  History,
  Package
} from 'lucide-react';
import pharmacyService from '../../services/pharmacyService';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import { formatDate } from '../../utils/formatters';

export const PharmacyDashboard = () => {
  const navigate = useNavigate();
  const [prescriptions, setPrescriptions] = useState([]);
  const [dispenses, setDispenses] = useState([]);
  const [stock, setStock] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const loadPharmacyData = useCallback(async () => {
    setLoading(true);
    try {
      const [rxData, dispData, stockData, invData] = await Promise.all([
        pharmacyService.getPrescriptions().catch(() => []),
        pharmacyService.getDispenses().catch(() => []),
        pharmacyService.getStock().catch(() => []),
        pharmacyService.getInvoices().catch(() => [])
      ]);
      setPrescriptions(Array.isArray(rxData) ? rxData : []);
      setDispenses(Array.isArray(dispData) ? dispData : []);
      setStock(Array.isArray(stockData) ? stockData : []);
      setInvoices(Array.isArray(invData) ? invData : []);
    } catch (err) {
      console.error('Failed to load pharmacy telemetry:', err);
      setFeedback({ message: 'Could not fetch pharmacy telemetry.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPharmacyData();
  }, [loadPharmacyData]);

  // Derived counts
  const pendingRxCount = prescriptions.filter(p => !p.is_dispensed).length;
  const dispensesCount = dispenses.filter(d => d.status === 'DISPENSED').length;
  const lowStockCount = stock.filter(s => Number(s.quantity || 0) <= Number(s.reorder_level || 10)).length;

  const queueColumns = [
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
      header: 'Date Written',
      key: 'prescription_date',
      render: (row) => <span>{formatDate(row.prescription_date || row.created_at)}</span>
    },
    {
      header: 'Dispense Status',
      key: 'is_dispensed',
      render: (row) => (
        <Badge status={row.is_dispensed ? 'DISPENSED' : 'PENDING'} />
      )
    },
    {
      header: 'Action',
      key: 'action',
      render: (row) => (
        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/pharmacy/prescriptions')}
        >
          Fulfill Prescription →
        </button>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pharmacy Operations Overview</h1>
          <p className="page-subtitle">Medication dispensation queue, formulary stock inventory, and sales billing.</p>
        </div>
        <button className="btn btn-outline" onClick={loadPharmacyData}>
          Refresh
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      {/* KPI Stats */}
      <div className="grid-stats">
        <StatCard
          title="Prescriptions in Queue"
          value={pendingRxCount}
          icon={ClipboardList}
          subtitle="Awaiting dispensation"
          trend="Live Queue"
          trendType="neutral"
        />
        <StatCard
          title="Orders Dispensed"
          value={dispensesCount}
          icon={Pill}
          subtitle="Medications fulfilled"
          trendType="positive"
        />
        <StatCard
          title="Low Stock Warnings"
          value={lowStockCount}
          icon={AlertTriangle}
          subtitle="At or below reorder limit"
          trendType={lowStockCount > 0 ? 'negative' : 'positive'}
        />
        <StatCard
          title="Pharmacy Invoices"
          value={invoices.length}
          icon={ReceiptText}
          subtitle="Total statements"
        />
      </div>

      {/* Quick Access Action Shortcuts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div
          className="card"
          style={{ cursor: 'pointer', textAlign: 'center', padding: '24px 20px' }}
          onClick={() => navigate('/pharmacy/prescriptions')}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', color: 'var(--primary)' }}>
            <ClipboardList size={28} strokeWidth={1.8} />
          </div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Prescriptions Queue</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Dispense patient drugs</div>
        </div>

        <div
          className="card"
          style={{ cursor: 'pointer', textAlign: 'center', padding: '24px 20px' }}
          onClick={() => navigate('/pharmacy/dispenses')}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', color: 'var(--primary)' }}>
            <History size={28} strokeWidth={1.8} />
          </div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Dispense History</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Fulfilled batches & logs</div>
        </div>

        <div
          className="card"
          style={{ cursor: 'pointer', textAlign: 'center', padding: '24px 20px' }}
          onClick={() => navigate('/pharmacy/stock')}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', color: 'var(--primary)' }}>
            <Package size={28} strokeWidth={1.8} />
          </div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Medicine Stock</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Inventory quantities & expiry</div>
        </div>

        <div
          className="card"
          style={{ cursor: 'pointer', textAlign: 'center', padding: '24px 20px' }}
          onClick={() => navigate('/pharmacy/billing')}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', color: 'var(--primary)' }}>
            <ReceiptText size={28} strokeWidth={1.8} />
          </div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Pharmacy Billing</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Pharmacy statements & receipts</div>
        </div>
      </div>

      {/* Pending Prescriptions Queue */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
              Active Prescription Queue ({pendingRxCount})
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Doctor-authorized medications pending pharmaceutical review and fulfillment.
            </p>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => navigate('/pharmacy/prescriptions')}
          >
            Open Queue →
          </button>
        </div>

        <DataTable
          columns={queueColumns}
          data={prescriptions.filter(p => !p.is_dispensed).slice(0, 8)}
          loading={loading}
          emptyMessage="No pending prescriptions in the queue."
        />
      </div>
    </div>
  );
};

export default PharmacyDashboard;
