import React, { useState, useEffect, useCallback } from 'react';
import labService from '../../services/labService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/formatters';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));

const formatAmount = (value) => `₹${Number(value || 0).toFixed(2)}`;

const printInvoice = (invoice) => {
  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    throw new Error('The print window was blocked. Allow pop-ups and try again.');
  }

  const payments = (invoice.payments || []).map((payment) => `
    <tr>
      <td>${escapeHtml(formatDate(payment.payment_date))}</td>
      <td>${escapeHtml(payment.payment_method)}</td>
      <td>${escapeHtml(payment.transaction_id || '—')}</td>
      <td class="amount">${escapeHtml(formatAmount(payment.amount))}</td>
    </tr>
  `).join('');

  printWindow.document.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(invoice.invoice_number)} - Laboratory Invoice</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; margin: 40px; }
          h1 { margin-bottom: 4px; }
          .muted { color: #4b5563; }
          .section { margin-top: 28px; }
          .details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { padding: 10px; border-bottom: 1px solid #d1d5db; text-align: left; }
          .amount { text-align: right; }
          .totals { width: 320px; margin-left: auto; }
          .totals td { border: 0; }
          .grand-total { font-weight: bold; border-top: 1px solid #111827 !important; }
          @media print { body { margin: 16mm; } }
        </style>
      </head>
      <body>
        <h1>Laboratory Invoice</h1>
        <div class="muted">${invoice.status === 'PAID' ? 'Paid invoice / payment receipt' : 'Invoice and payment receipt'}</div>
        <div class="section details">
          <div><strong>Invoice:</strong> ${escapeHtml(invoice.invoice_number)}</div>
          <div><strong>Invoice date:</strong> ${escapeHtml(formatDate(invoice.created_at))}</div>
          <div><strong>Patient:</strong> ${escapeHtml(invoice.patient_name)}</div>
          <div><strong>Patient ID:</strong> ${escapeHtml(invoice.patient)}</div>
          <div><strong>Doctor:</strong> ${escapeHtml(invoice.doctor_name)}</div>
          <div><strong>Lab order:</strong> ${escapeHtml(invoice.order_number)}</div>
        </div>
        <div class="section">
          <h2>Test</h2>
          <table>
            <thead><tr><th>Description</th><th class="amount">Amount</th></tr></thead>
            <tbody><tr><td>${escapeHtml(invoice.test_name)}</td><td class="amount">${escapeHtml(formatAmount(invoice.amount))}</td></tr></tbody>
          </table>
          <table class="totals">
            <tbody>
              <tr><td>Discount</td><td class="amount">${escapeHtml(formatAmount(invoice.discount))}</td></tr>
              <tr><td>Total</td><td class="amount">${escapeHtml(formatAmount(invoice.total_amount))}</td></tr>
              <tr><td>Paid</td><td class="amount">${escapeHtml(formatAmount(invoice.paid_amount))}</td></tr>
              <tr class="grand-total"><td>Balance due</td><td class="amount">${escapeHtml(formatAmount(invoice.balance))}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="section">
          <h2>Payment history</h2>
          <table>
            <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th class="amount">Amount</th></tr></thead>
            <tbody>${payments || '<tr><td colspan="4">No payments recorded.</td></tr>'}</tbody>
          </table>
        </div>
        <p class="section muted">Invoice status: ${escapeHtml(invoice.status)}</p>
        <script>window.addEventListener('load', () => { window.focus(); window.print(); });</script>
      </body>
    </html>`);
  printWindow.document.close();
};

export const LabBillingPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
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

  const handleViewInvoice = async (invoice) => {
    setViewingInvoice(invoice);
    setIsInvoiceModalOpen(true);
    setInvoiceLoading(true);
    try {
      const latestInvoice = await labService.getInvoice(invoice.id);
      setViewingInvoice(latestInvoice);
    } catch (err) {
      console.error('Failed to load lab invoice:', err);
      showFeedback(err.message || 'Could not load invoice details.', 'danger');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handlePrintInvoice = () => {
    if (!viewingInvoice || Number(viewingInvoice.paid_amount) <= 0) {
      showFeedback('A printable payment receipt is available after a payment is recorded.', 'danger');
      return;
    }
    try {
      printInvoice(viewingInvoice);
    } catch (err) {
      showFeedback(err.message || 'Could not open the print view.', 'danger');
    }
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
      header: 'Actions',
      key: 'actions',
      render: (row) => {
        return (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {row.status !== 'PAID' && row.status !== 'CANCELLED' && Number(row.balance) > 0 && (
              <button className="btn btn-primary btn-sm" onClick={() => handleOpenPayment(row)}>
                Record Payment
              </button>
            )}
            <button className="btn btn-outline btn-sm" onClick={() => handleViewInvoice(row)}>
              View Bill
            </button>
          </div>
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

      <Modal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        title={`Laboratory Invoice: ${viewingInvoice?.invoice_number || ''}`}
        maxWidth="760px"
      >
        {invoiceLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading invoice and payment history...
          </div>
        ) : viewingInvoice && (
          <div>
            <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
              <div><strong>Invoice:</strong> {viewingInvoice.invoice_number}</div>
              <div><strong>Date:</strong> {formatDate(viewingInvoice.created_at)}</div>
              <div><strong>Patient:</strong> {viewingInvoice.patient_name} (ID {viewingInvoice.patient})</div>
              <div><strong>Doctor:</strong> {viewingInvoice.doctor_name}</div>
              <div><strong>Lab order:</strong> {viewingInvoice.order_number}</div>
              <div><strong>Test:</strong> {viewingInvoice.test_name}</div>
              <div><strong>Status:</strong> <Badge status={viewingInvoice.status} /></div>
            </div>

            <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Test amount</span><strong>{formatAmount(viewingInvoice.amount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Discount</span><strong>{formatAmount(viewingInvoice.discount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total</span><strong>{formatAmount(viewingInvoice.total_amount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Paid</span><strong>{formatAmount(viewingInvoice.paid_amount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Balance due</span><strong>{formatAmount(viewingInvoice.balance)}</strong>
              </div>
            </div>

            <h3 style={{ marginBottom: '8px', color: 'var(--text-main)' }}>Payment history</h3>
            <DataTable
              columns={[
                { header: 'Payment Date', key: 'payment_date', render: (payment) => formatDate(payment.payment_date) },
                { header: 'Method', key: 'payment_method' },
                { header: 'Reference', key: 'transaction_id', render: (payment) => payment.transaction_id || '—' },
                { header: 'Amount', key: 'amount', render: (payment) => formatAmount(payment.amount) }
              ]}
              data={viewingInvoice.payments || []}
              loading={false}
              emptyMessage="No payments have been recorded for this invoice."
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handlePrintInvoice}
                disabled={invoiceLoading || Number(viewingInvoice.paid_amount) <= 0}
              >
                Print Bill / Receipt
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setIsInvoiceModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LabBillingPage;
