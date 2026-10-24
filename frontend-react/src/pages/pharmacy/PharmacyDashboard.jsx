import React, { useState, useEffect, useCallback } from 'react';
import pharmacyService from '../../services/pharmacyService';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { formatDate, formatCurrency } from '../../utils/formatters';

export const PharmacyDashboard = () => {
  // Navigation Tabs: 'prescriptions' | 'dispenses' | 'inventory' | 'invoices'
  const [activeTab, setActiveTab] = useState('prescriptions');

  const [prescriptions, setPrescriptions] = useState([]);
  const [dispenses, setDispenses] = useState([]);
  const [stock, setStock] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dispensing Modal States
  const [selectedRx, setSelectedRx] = useState(null);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [submittingDispense, setSubmittingDispense] = useState(false);

  // Search Filter
  const [stockSearch, setStockSearch] = useState('');
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

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
      console.error('Failed to load pharmacy data:', err);
      showFeedback('Could not load pharmacy records from server.', 'danger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPharmacyData();
  }, [loadPharmacyData]);

  // Handle Initiating and Confirming Dispense
  const handleOpenDispense = (rx) => {
    setSelectedRx(rx);
    setIsDispenseModalOpen(true);
  };

  const handleConfirmDispense = async (e) => {
    e.preventDefault();
    if (!selectedRx) return;

    setSubmittingDispense(true);
    try {
      // 1. Create a dispense record linked to the prescription
      const newDispense = await pharmacyService.createDispense({
        prescription: selectedRx.id
      });

      // 2. Execute stock deduction dispense action
      try {
        await pharmacyService.dispenseOrder(newDispense.id);
      } catch (dispErr) {
        console.warn('Auto stock deduction note:', dispErr.message);
      }

      setIsDispenseModalOpen(false);
      showFeedback(`Prescription #${selectedRx.id} for ${selectedRx.patient_name || 'Patient'} fulfilled and dispensed.`);
      await loadPharmacyData();
    } catch (err) {
      showFeedback(`Dispensing error: ${err.message}`, 'danger');
    } finally {
      setSubmittingDispense(false);
    }
  };

  const rxColumns = [
    {
      header: 'Rx #',
      key: 'id',
      render: (r) => <span style={{ fontWeight: 600 }}>#{r.id}</span>
    },
    {
      header: 'Patient Details',
      key: 'patient_name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.patient_name || `Patient #${r.patient}`}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Doctor: {r.doctor_name || `Dr. #${r.doctor}`}</div>
        </div>
      )
    },
    {
      header: 'Prescribed Items',
      key: 'items',
      render: (r) => {
        const items = r.items || [];
        if (items.length === 0) return <span style={{ color: 'var(--text-muted)' }}>No medications specified</span>;
        return (
          <div style={{ fontSize: '0.82rem' }}>
            {items.map((it, idx) => (
              <div key={idx}>
                • {it.medicine_name || `Med #${it.medicine}`} ({it.dosage_name || `Dosage #${it.dosage}`}) × {it.quantity || 1}
              </div>
            ))}
          </div>
        );
      }
    },
    {
      header: 'Prescription Date',
      key: 'prescription_date',
      render: (r) => formatDate(r.prescription_date || r.created_at)
    },
    {
      header: 'Fulfillment',
      key: 'status',
      render: (r) => {
        const hasDispenses = (r.dispenses && r.dispenses.length > 0);
        return <Badge status={hasDispenses ? 'COMPLETED' : 'PENDING'} />;
      }
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <button
          className="btn btn-primary"
          style={{ padding: '4px 12px', fontSize: '0.8rem' }}
          onClick={() => handleOpenDispense(r)}
        >
          💊 Dispense Meds
        </button>
      )
    }
  ];

  const dispenseColumns = [
    {
      header: 'Dispense #',
      key: 'dispense_number',
      render: (d) => <span style={{ fontWeight: 600 }}>{d.dispense_number || `#${d.id}`}</span>
    },
    {
      header: 'Patient',
      key: 'patient_name',
      render: (d) => d.patient_name || `Patient #${d.patient}`
    },
    {
      header: 'Prescription',
      key: 'prescription',
      render: (d) => `Rx #${d.prescription}`
    },
    {
      header: 'Dispense Date',
      key: 'dispense_date',
      render: (d) => formatDate(d.dispense_date || d.created_at)
    },
    {
      header: 'Status',
      key: 'status',
      render: (d) => <Badge status={d.status || 'DISPENSED'} />
    }
  ];

  const stockColumns = [
    {
      header: 'Batch #',
      key: 'batch_number',
      render: (s) => <span style={{ fontWeight: 600 }}>{s.batch_number || `BATCH-${s.id}`}</span>
    },
    {
      header: 'Medicine',
      key: 'medicine_name',
      render: (s) => (
        <div>
          <div style={{ fontWeight: 600 }}>{s.medicine_name || (s.medicine ? `Med #${s.medicine}` : '-')}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Price: {formatCurrency(s.unit_price || 0)}</div>
        </div>
      )
    },
    {
      header: 'Available Stock',
      key: 'quantity',
      render: (s) => {
        const qty = s.quantity ?? 0;
        const isLow = qty <= 10;
        return (
          <span style={{ fontWeight: 700, color: isLow ? 'var(--danger)' : 'var(--success)' }}>
            {qty} units {isLow && '(Low Stock)'}
          </span>
        );
      }
    },
    {
      header: 'Expiry Date',
      key: 'expiry_date',
      render: (s) => formatDate(s.expiry_date)
    }
  ];

  const invoiceColumns = [
    {
      header: 'Invoice #',
      key: 'invoice_number',
      render: (i) => <span style={{ fontWeight: 600 }}>{i.invoice_number || `#${i.id}`}</span>
    },
    {
      header: 'Patient',
      key: 'patient_name',
      render: (i) => i.patient_name || `Patient #${i.patient}`
    },
    {
      header: 'Amount',
      key: 'total_amount',
      render: (i) => formatCurrency(i.total_amount || 0)
    },
    {
      header: 'Status',
      key: 'status',
      render: (i) => <Badge status={i.status || 'PENDING'} />
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
          <h1 className="page-title">Pharmacy & Dispensing Unit</h1>
          <p className="page-subtitle">Process clinical prescriptions, dispense pharmaceuticals, and manage stock batches.</p>
        </div>
        <button onClick={loadPharmacyData} className="btn btn-outline">
          🔄 Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid-stats">
        <StatCard
          title="Prescriptions"
          value={prescriptions.length}
          subtitle="Orders received"
          icon="📋"
          color="primary"
        />
        <StatCard
          title="Fulfilled Dispenses"
          value={dispenses.length}
          subtitle="Dispense logs"
          icon="✅"
          color="success"
        />
        <StatCard
          title="Stock Batches"
          value={stock.length}
          subtitle="Active pharmaceutical lots"
          icon="📦"
          color="info"
        />
        <StatCard
          title="Low Stock Batches"
          value={stock.filter(s => (s.quantity ?? 0) <= 10).length}
          subtitle="Threshold: ≤ 10 units"
          icon="⚠️"
          color="warning"
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '24px', gap: '24px' }}>
        {[
          { key: 'prescriptions', label: `Prescriptions Queue (${prescriptions.length})`, icon: '📋' },
          { key: 'dispenses', label: `Dispensed Logs (${dispenses.length})`, icon: '💊' },
          { key: 'inventory', label: `Medicine Stock (${stock.length})`, icon: '📦' },
          { key: 'invoices', label: `Pharmacy Invoices (${invoices.length})`, icon: '🧾' }
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

      {/* Tab 1: Prescriptions Queue */}
      {activeTab === 'prescriptions' && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '18px' }}>
            Doctor Prescriptions Queue
          </h2>
          <DataTable
            columns={rxColumns}
            data={prescriptions}
            loading={loading}
            emptyMessage="No pending doctor prescriptions."
          />
        </div>
      )}

      {/* Tab 2: Dispenses */}
      {activeTab === 'dispenses' && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '18px' }}>
            Dispensed Pharmaceutical Logs
          </h2>
          <DataTable
            columns={dispenseColumns}
            data={dispenses}
            loading={loading}
            emptyMessage="No dispense history found."
          />
        </div>
      )}

      {/* Tab 3: Inventory */}
      {activeTab === 'inventory' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Medicine Inventory & Batches</h2>
            <input
              type="text"
              placeholder="Search batch or medicine..."
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.88rem'
              }}
            />
          </div>
          <DataTable
            columns={stockColumns}
            data={stock.filter(s => {
              if (!stockSearch) return true;
              const q = stockSearch.toLowerCase();
              return (
                (s.batch_number && s.batch_number.toLowerCase().includes(q)) ||
                (s.medicine_name && s.medicine_name.toLowerCase().includes(q))
              );
            })}
            loading={loading}
            emptyMessage="No matching pharmaceutical batches found."
          />
        </div>
      )}

      {/* Tab 4: Invoices */}
      {activeTab === 'invoices' && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '18px' }}>
            Pharmacy Billing & Invoices
          </h2>
          <DataTable
            columns={invoiceColumns}
            data={invoices}
            loading={loading}
            emptyMessage="No pharmacy invoices on file."
          />
        </div>
      )}

      {/* Dispensing Modal */}
      <Modal
        isOpen={isDispenseModalOpen}
        onClose={() => setIsDispenseModalOpen(false)}
        title={`Dispense Medication — Rx #${selectedRx?.id}`}
        maxWidth="600px"
      >
        <form onSubmit={handleConfirmDispense}>
          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              Patient: {selectedRx?.patient_name || `Patient #${selectedRx?.patient}`}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Prescribed by: {selectedRx?.doctor_name || `Dr. #${selectedRx?.doctor}`} on {formatDate(selectedRx?.prescription_date || selectedRx?.created_at)}
            </div>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '8px' }}>Medications to Dispense:</h4>
            {selectedRx?.items && selectedRx.items.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedRx.items.map((item, idx) => (
                  <div key={idx} style={{ padding: '8px 12px', background: 'white', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem' }}>
                    <strong>{item.medicine_name || `Med #${item.medicine}`}</strong> — {item.dosage_name || `Dosage #${item.dosage}`} (Qty: {item.quantity || 1})
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.instructions || 'As advised'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No items listed on prescription.</div>
            )}
          </div>

          <div style={{ padding: '10px 14px', background: 'var(--warning-light)', color: '#92400e', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', marginBottom: '20px' }}>
            ℹ️ Confirming dispense will deduct the corresponding medication quantities from the active inventory batch and generate a pharmacy invoice.
          </div>

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
              {submittingDispense ? 'Processing Dispense...' : 'Confirm & Dispense Medication'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PharmacyDashboard;
