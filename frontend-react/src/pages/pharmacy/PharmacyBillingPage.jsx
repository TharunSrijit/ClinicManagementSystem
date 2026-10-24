import React, { useState, useEffect, useCallback } from 'react';
import pharmacyService from '../../services/pharmacyService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/formatters';

export const PharmacyBillingPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionId, setTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await pharmacyService.getInvoices();
      setInvoices(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load pharmacy invoices:', err);
      showFeedback('Could not fetch pharmacy billing invoices.', 'danger');
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
    setIsModalOpen(true);
  };

  const handleSettlePayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setSubmitting(true);
    try {
      await pharmacyService.createPayment({
        invoice: selectedInvoice.id,
        amount: selectedInvoice.total_amount,
        payment_method: paymentMethod,
        transaction_id: transactionId.trim() || undefined
      });
      showFeedback(`Payment recorded for Pharmacy Invoice #${selectedInvoice.invoice_number || selectedInvoice.id}!`);
      setIsModalOpen(false);
      await loadInvoices();
    } catch (err) {
      console.error('Pharmacy payment failed:', err);
      showFeedback(err.message || 'Payment submission failed.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

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
      header: 'Dispense Ref',
      key: 'dispense',
      render: (row) => <span>Dispense #{row.dispense}</span>
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
      header: 'Settlement',
      key: 'actions',
      render: (row) => {
        if (row.status === 'PAID') {
          return <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>✓ Settled</span>;
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
          <h1 className="page-title">Pharmacy Medication Billing</h1>
          <p className="page-subtitle">Track drug sales invoices, customer receipts, and settle pharmacy payments.</p>
        </div>
        <button className="btn btn-outline" onClick={loadInvoices}>
          🔄 Refresh Statements
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      <DataTable
        columns={columns}
        data={invoices}
        loading={loading}
        emptyMessage="No pharmacy invoices on file."
      />

      {/* Payment Settlement Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Collect Drug Fee: ${selectedInvoice?.invoice_number || ''}`}
      >
        {selectedInvoice && (
          <form onSubmit={handleSettlePayment}>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Patient</span>
                <span style={{ fontWeight: 600 }}>{selectedInvoice.patient_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                <span style={{ fontWeight: 700 }}>Total Payable</span>
                <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>
                  ₹{Number(selectedInvoice.total_amount || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Mode *</label>
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
                <label className="form-label">Transaction / UTR Reference</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. UPI5548291"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Recording...' : `Collect ₹${Number(selectedInvoice.total_amount || 0).toFixed(2)}`}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default PharmacyBillingPage;
