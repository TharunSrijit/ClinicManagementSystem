import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PackageCheck,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Printer,
  FileText
} from 'lucide-react';
import pharmacyService from '../../services/pharmacyService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import PharmacyReceipt from '../../components/PharmacyReceipt';
import { formatDate } from '../../utils/formatters';

export const PharmacyDispensesPage = () => {
  const navigate = useNavigate();
  const [dispenses, setDispenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  // Receipt Modal
  const [receiptInvoice, setReceiptInvoice] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadDispenses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await pharmacyService.getDispenses(statusFilter === 'ALL' ? null : statusFilter);
      setDispenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load dispenses:', err);
      showFeedback('Could not load dispense history.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadDispenses();
  }, [loadDispenses]);

  const handleConfirmDispense = async (row) => {
    if (row.invoice_status && row.invoice_status !== 'PAID') {
      showFeedback(
        `Payment gating: Invoice #${row.invoice_number || row.invoice_id} is unpaid. Payment must be recorded before dispensing.`,
        'danger'
      );
      return;
    }

    if (!window.confirm(`Confirm medication fulfillment for Dispense #${row.dispense_number || row.id}? This will deduct inventory stock.`)) {
      return;
    }

    setActionLoading(row.id);
    try {
      await pharmacyService.dispenseOrder(row.id);
      showFeedback(`Dispensation #${row.dispense_number || row.id} confirmed and inventory deducted.`);
      await loadDispenses();
    } catch (err) {
      showFeedback(`Dispensation confirmation failed: ${err.message}`, 'danger');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelDispense = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this dispense record? Linked unpaid invoices will also be cancelled.')) return;
    setActionLoading(id);
    try {
      await pharmacyService.cancelDispense(id);
      showFeedback('Dispense record cancelled.');
      await loadDispenses();
    } catch (err) {
      showFeedback(`Cancellation failed: ${err.message}`, 'danger');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewReceipt = async (row) => {
    if (!row.invoice_id) {
      showFeedback('No invoice linked to this dispense record.', 'danger');
      return;
    }
    try {
      const inv = await pharmacyService.getInvoice(row.invoice_id);
      setReceiptInvoice(inv);
      setIsReceiptModalOpen(true);
    } catch (err) {
      showFeedback('Could not load invoice receipt details.', 'danger');
    }
  };

  const columns = [
    {
      header: 'Dispense #',
      key: 'dispense_number',
      render: (row) => (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
            {row.dispense_number || `#${row.id}`}
          </span>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {formatDate(row.created_at)}
          </div>
        </div>
      )
    },
    {
      header: 'Prescription Ref',
      key: 'prescription',
      render: (row) => (
        <div>
          <span style={{ fontWeight: 600 }}>{row.prescription_number || `Rx #${row.prescription}`}</span>
        </div>
      )
    },
    {
      header: 'Patient Name',
      key: 'patient_name',
      render: (row) => <span style={{ fontWeight: 600 }}>{row.patient_name || `Patient #${row.patient}`}</span>
    },
    {
      header: 'Linked Bill & Payment',
      key: 'invoice_number',
      render: (row) => {
        if (!row.invoice_id) {
          return <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No Bill</span>;
        }
        const isPaid = row.invoice_status === 'PAID';
        return (
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Bill {row.invoice_number || `#${row.invoice_id}`}
            </div>
            <div>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: isPaid ? '#dcfce7' : '#fef3c7',
                  color: isPaid ? '#15803d' : '#b45309'
                }}
              >
                {isPaid ? 'PAID' : 'UNPAID'}
              </span>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Notes / Remarks',
      key: 'notes',
      render: (row) => (
        <span style={{ fontSize: '0.82rem', color: row.notes ? '#334155' : 'var(--text-muted)' }}>
          {row.notes || '—'}
        </span>
      )
    },
    {
      header: 'Dispense Status',
      key: 'status',
      render: (row) => <Badge status={row.status} />
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => {
        if (row.status === 'PENDING') {
          const isPaid = row.invoice_status === 'PAID';
          return (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {isPaid ? (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}
                  onClick={() => handleConfirmDispense(row)}
                  disabled={actionLoading === row.id}
                  title="Fulfill medicines and deduct inventory"
                >
                  <PackageCheck size={13} style={{ marginRight: '4px' }} />
                  {actionLoading === row.id ? 'Fulfilling...' : 'Confirm Dispense'}
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() =>
                    navigate(
                      `/pharmacy/billing?highlight=${row.invoice_id}&openPayment=true`
                    )
                  }
                  title="Payment required before dispensing. Go to Billing."
                >
                  <CreditCard size={13} style={{ marginRight: '4px' }} />
                  Collect Payment
                </button>
              )}

              <button
                className="btn btn-outline btn-sm"
                style={{ color: 'var(--danger)' }}
                onClick={() => handleCancelDispense(row.id)}
                disabled={actionLoading === row.id}
              >
                Cancel
              </button>
            </div>
          );
        }

        if (row.status === 'DISPENSED' && row.invoice_id) {
          return (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => handleViewReceipt(row)}
              title="View & Print Pharmacy Receipt"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <Printer size={13} />
              Receipt
            </button>
          );
        }

        return <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>;
      }
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dispense History & Audit Log</h1>
          <p className="page-subtitle">Historical records of pharmaceutical fulfillments, partial dispensing, and inventory deductions.</p>
        </div>
        <button className="btn btn-outline" onClick={loadDispenses}>
          Refresh
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      {/* Filter Toolbar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div className="filter-toolbar" style={{ margin: 0 }}>
          <div className="filter-group">
            <div>
              <label className="form-label">Status</label>
              <select
                className="form-select"
                style={{ width: '180px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Dispenses</option>
                <option value="PENDING">Pending</option>
                <option value="DISPENSED">Dispensed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Showing {dispenses.length} records
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={dispenses}
        loading={loading}
        emptyMessage="No medication dispenses logged."
      />

      {/* Printable Receipt Modal */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        title="Official Pharmacy Tax Invoice & Receipt"
        size="lg"
      >
        {receiptInvoice && (
          <PharmacyReceipt
            invoice={receiptInvoice}
            onPrint={() => window.print()}
          />
        )}
      </Modal>
    </div>
  );
};

export default PharmacyDispensesPage;
