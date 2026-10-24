import React, { useState, useEffect, useCallback } from 'react';
import receptionistService from '../../services/receptionistService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/formatters';

export const ReceptionistBillingPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionId, setTransactionId] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await receptionistService.getConsultationInvoices();
      setInvoices(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load consultation invoices:', err);
      showFeedback('Could not retrieve consultation invoices from server.', 'danger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleOpenPayment = (inv) => {
    setSelectedInvoice(inv);
    setPaymentMethod('CASH');
    setTransactionId('');
    setIsPayModalOpen(true);
  };

  const handleSettlePayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setSubmittingPayment(true);
    try {
      await receptionistService.createConsultationPayment({
        invoice: selectedInvoice.id,
        amount: selectedInvoice.total_amount,
        payment_method: paymentMethod,
        transaction_id: transactionId.trim() || undefined
      });
      showFeedback(`Payment recorded for Invoice #${selectedInvoice.invoice_number}!`);
      setIsPayModalOpen(false);
      setSelectedInvoice(null);
      await loadInvoices();
    } catch (err) {
      console.error('Payment processing failed:', err);
      showFeedback(err.message || 'Payment submission failed.', 'danger');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter === 'ALL') return true;
    return inv.status === statusFilter;
  });

  const columns = [
    {
      header: 'Invoice #',
      key: 'invoice_number',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
          {row.invoice_number || `#${row.id}`}
        </span>
      )
    },
    {
      header: 'Patient Name',
      key: 'patient_name',
      render: (row) => <span style={{ fontWeight: 600 }}>{row.patient_name || `Patient #${row.patient}`}</span>
    },
    {
      header: 'Appointment Ref',
      key: 'appointment',
      render: (row) => <span>Appt #{row.appointment}</span>
    },
    {
      header: 'Consultation Fee',
      key: 'consultation_fee',
      render: (row) => <span>₹{Number(row.consultation_fee || 0).toFixed(2)}</span>
    },
    {
      header: 'Total Amount',
      key: 'total_amount',
      render: (row) => (
        <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
          ₹{Number(row.total_amount || 0).toFixed(2)}
        </span>
      )
    },
    {
      header: 'Invoice Date',
      key: 'created_at',
      render: (row) => <span>{formatDate(row.created_at)}</span>
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => <Badge status={row.status} />
    },
    {
      header: 'Action',
      key: 'actions',
      render: (row) => {
        if (row.status === 'PAID') {
          return (
            <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>
              ✓ Paid
            </span>
          );
        }
        return (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleOpenPayment(row)}
          >
            Collect Payment
          </button>
        );
      }
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Consultation Invoices & Billing</h1>
          <p className="page-subtitle">Track consultation billing statements and record fee collections.</p>
        </div>
        <button className="btn btn-outline" onClick={loadInvoices}>
          🔄 Refresh Invoices
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
              <label className="form-label">Payment Status</label>
              <select
                className="form-select"
                style={{ width: '180px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Invoices</option>
                <option value="PENDING">Pending / Unpaid</option>
                <option value="PAID">Paid</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Showing {filteredInvoices.length} invoices
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredInvoices}
        loading={loading}
        emptyMessage="No consultation invoices found matching this filter."
      />

      {/* Payment Settlement Modal */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title={`Collect Fee: Invoice #${selectedInvoice?.invoice_number || ''}`}
      >
        {selectedInvoice && (
          <form onSubmit={handleSettlePayment}>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Patient</span>
                <span style={{ fontWeight: 600 }}>{selectedInvoice.patient_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Consultation Fee</span>
                <span>₹{Number(selectedInvoice.consultation_fee || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                <span style={{ fontWeight: 700 }}>Total Payable</span>
                <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>
                  ₹{Number(selectedInvoice.total_amount || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Method *</label>
              <select
                className="form-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                required
              >
                <option value="CASH">Cash</option>
                <option value="CARD">Credit / Debit Card</option>
                <option value="UPI">UPI / QR Code</option>
              </select>
            </div>

            {paymentMethod !== 'CASH' && (
              <div className="form-group">
                <label className="form-label">Transaction Reference / UTR Number</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. UPI123456789 or POS-REF"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setIsPayModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingPayment}
              >
                {submittingPayment ? 'Processing...' : `Confirm Receipt of ₹${Number(selectedInvoice.total_amount || 0).toFixed(2)}`}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default ReceptionistBillingPage;
