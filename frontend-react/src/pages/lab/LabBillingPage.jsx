import React, { useState, useEffect, useCallback } from 'react';
import labService from '../../services/labService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/formatters';

export const LabBillingPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionId, setTransactionId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    window.setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadInvoices = useCallback(async () => {
    try {
      const data = await labService.getInvoices();
      setInvoices(data);
      setFeedback({ message: '', type: '' });
    } catch (err) {
      console.error('Failed to load lab invoices:', err);
      showFeedback(err.message || 'Could not fetch lab billing statements.', 'danger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleOpenPayment = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentMethod('CASH');
    setTransactionId('');
    setPaymentAmount(invoice.balance || '0.00');
    setIsModalOpen(true);
  };

  const handleSettlePayment = async (event) => {
    event.preventDefault();
    if (!selectedInvoice || !selectedInvoice.lab_order) {
      showFeedback('This invoice is missing its lab order reference.', 'danger');
      return;
    }
    if (Number(paymentAmount) <= 0 || Number(paymentAmount) > Number(selectedInvoice.balance)) {
      showFeedback('Enter a payment amount greater than zero and no greater than the balance due.', 'danger');
      return;
    }
    if (paymentMethod !== 'CASH' && !transactionId.trim()) {
      showFeedback('Enter the transaction/reference ID for this payment method.', 'danger');
      return;
    }

    setSubmitting(true);
    try {
      const updatedOrder = await labService.recordPayment(selectedInvoice.lab_order, {
        amount: paymentAmount,
        payment_method: paymentMethod,
        transaction_id: transactionId.trim()
      });
      if (updatedOrder?.invoice) {
        setInvoices((currentInvoices) => currentInvoices.map((invoice) =>
          invoice.id === updatedOrder.invoice.id
            ? {
                ...invoice,
                status: updatedOrder.invoice.status,
                total_amount: updatedOrder.invoice.total_amount,
                paid_amount: updatedOrder.invoice.paid_amount,
                balance: updatedOrder.invoice.balance,
                order_status: updatedOrder.status
              }
            : invoice
        ));
      }
      showFeedback(`Payment recorded for invoice ${selectedInvoice.invoice_number}.`);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Lab payment failed:', err);
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
      header: 'Patient',
      key: 'patient_name',
      render: (row) => row.patient_name || `Patient #${row.patient}`
    },
    {
      header: 'Test',
      key: 'test_name'
    },
    {
      header: 'Order Reference',
      key: 'order_number',
      render: (row) => row.order_number || `#${row.lab_order}`
    },
    {
      header: 'Total',
      key: 'total_amount',
      render: (row) => `₹${Number(row.total_amount || 0).toFixed(2)}`
    },
    {
      header: 'Paid',
      key: 'paid_amount',
      render: (row) => `₹${Number(row.paid_amount || 0).toFixed(2)}`
    },
    {
      header: 'Balance',
      key: 'balance',
      render: (row) => `₹${Number(row.balance || 0).toFixed(2)}`
    },
    {
      header: 'Invoice Date',
      key: 'created_at',
      render: (row) => formatDate(row.created_at)
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
          return <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>Settled</span>;
        }
        if (row.status === 'CANCELLED' || Number(row.balance) <= 0) {
          return <span style={{ color: 'var(--text-muted)' }}>Unavailable</span>;
        }
        return (
          <button className="btn btn-primary btn-sm" onClick={() => handleOpenPayment(row)}>
            Record Payment
          </button>
        );
      }
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Diagnostic Laboratory Billing</h1>
          <p className="page-subtitle">Review laboratory invoices, balances, and payment records.</p>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => {
            setLoading(true);
            loadInvoices();
          }}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh Statements'}
        </button>
      </div>

      {feedback.message && <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>}

      <DataTable
        columns={columns}
        data={invoices}
        loading={loading}
        emptyMessage="No laboratory invoices on file."
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Record Payment: ${selectedInvoice?.invoice_number || ''}`}
      >
        {selectedInvoice && (
          <form onSubmit={handleSettlePayment}>
            <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
              <div><strong>Patient:</strong> {selectedInvoice.patient_name}</div>
              <div><strong>Test:</strong> {selectedInvoice.test_name}</div>
              <div><strong>Balance due:</strong> ₹{Number(selectedInvoice.balance || 0).toFixed(2)}</div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="lab-payment-amount">Payment amount *</label>
              <input
                id="lab-payment-amount"
                type="number"
                className="form-control"
                min="0.01"
                max={selectedInvoice.balance}
                step="0.01"
                required
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="lab-payment-method">Payment method *</label>
              <select
                id="lab-payment-method"
                className="form-select"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                required
              >
                <option value="CASH">Cash</option>
                <option value="CARD">Credit / Debit Card</option>
                <option value="UPI">UPI / QR Code</option>
                <option value="ONLINE">Online</option>
              </select>
            </div>

            {paymentMethod !== 'CASH' && (
              <div className="form-group">
                <label className="form-label" htmlFor="lab-transaction-id">Transaction / reference ID *</label>
                <input
                  id="lab-transaction-id"
                  type="text"
                  className="form-control"
                  required
                  value={transactionId}
                  onChange={(event) => setTransactionId(event.target.value)}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default LabBillingPage;
