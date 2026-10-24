import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import receptionistService from '../../services/receptionistService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import { formatDate, formatTime } from '../../utils/formatters';

export const ReceptionistBillingPage = () => {
  const [searchParams] = useSearchParams();
  const targetInvoiceQuery = searchParams.get('invoice');
  const targetAppointmentQuery = searchParams.get('appointment');

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);

  // Payment settlement modal state
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionId, setTransactionId] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Receipt modal state
  const [receiptInvoice, setReceiptInvoice] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

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

  useEffect(() => {
    if (!loading && invoices.length > 0 && (targetInvoiceQuery || targetAppointmentQuery)) {
      const match = invoices.find((inv) =>
        (targetInvoiceQuery && (inv.invoice_number === targetInvoiceQuery || String(inv.id) === targetInvoiceQuery)) ||
        (targetAppointmentQuery && String(inv.appointment) === targetAppointmentQuery)
      );
      if (match) {
        setHighlightedId(match.id);
        if (match.status !== 'PAID') {
          handleOpenPayment(match);
          showFeedback(`Please record payment for Invoice #${match.invoice_number} (Appointment #${match.appointment || targetAppointmentQuery}).`, 'warning');
        } else {
          showFeedback(`Invoice #${match.invoice_number} is already paid in full.`, 'info');
        }
      }
    }
  }, [loading, invoices, targetInvoiceQuery, targetAppointmentQuery]);

  const handleOpenPayment = (inv) => {
    setSelectedInvoice(inv);
    const balance = Number(inv.balance_due != null ? inv.balance_due : inv.total_amount || 0);
    setPaymentAmount(balance > 0 ? balance.toFixed(2) : '0.00');
    setPaymentMethod('CASH');
    setTransactionId('');
    setIsPayModalOpen(true);
  };

  const handleSettlePayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const amountNum = parseFloat(paymentAmount);
    const balanceDue = Number(selectedInvoice.balance_due != null ? selectedInvoice.balance_due : selectedInvoice.total_amount || 0);

    if (isNaN(amountNum) || amountNum <= 0) {
      showFeedback('Please enter a valid payment amount greater than zero.', 'danger');
      return;
    }

    if (amountNum > balanceDue + 0.001) {
      showFeedback(`Payment amount (₹${amountNum.toFixed(2)}) cannot exceed the remaining balance of ₹${balanceDue.toFixed(2)}.`, 'danger');
      return;
    }

    setSubmittingPayment(true);
    try {
      await receptionistService.createConsultationPayment({
        invoice: selectedInvoice.id,
        amount: amountNum.toFixed(2),
        payment_method: paymentMethod,
        transaction_id: transactionId.trim() || undefined
      });

      showFeedback(`Payment of ₹${amountNum.toFixed(2)} recorded for Invoice #${selectedInvoice.invoice_number}!`);
      setIsPayModalOpen(false);
      setSelectedInvoice(null);
      await loadInvoices();
    } catch (err) {
      console.error('Payment processing failed:', err);
      const errMsg = err.response?.data?.detail || err.message || 'Payment submission failed.';
      showFeedback(errMsg, 'danger');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleOpenReceipt = async (inv) => {
    setIsReceiptModalOpen(true);
    setLoadingReceipt(true);
    try {
      const freshInv = await receptionistService.getConsultationInvoice(inv.id);
      setReceiptInvoice(freshInv);
    } catch (err) {
      console.warn('Could not fetch single invoice, using row data:', err);
      setReceiptInvoice(inv);
    } finally {
      setLoadingReceipt(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter === 'ALL') return true;
    return inv.status === statusFilter;
  });

  const columns = [
    {
      header: 'Invoice #',
      key: 'invoice_number',
      render: (row) => {
        const isTarget = row.id === highlightedId || (targetInvoiceQuery && (row.invoice_number === targetInvoiceQuery || String(row.id) === targetInvoiceQuery));
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
              {row.invoice_number || `#${row.id}`}
            </span>
            {isTarget && (
              <span style={{
                background: 'var(--primary)',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.02em'
              }}>
                Newly Booked
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: 'Patient',
      key: 'patient_name',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.patient_name || `Patient #${row.patient}`}</div>
          {row.patient_id && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ID: {row.patient_id}</div>
          )}
        </div>
      )
    },
    {
      header: 'Doctor',
      key: 'doctor_name',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.doctor_name || '—'}</div>
          {row.doctor_specialization && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{row.doctor_specialization}</div>
          )}
        </div>
      )
    },
    {
      header: 'Reg Fee',
      key: 'registration_fee',
      render: (row) => <span>₹{Number(row.registration_fee || 0).toFixed(2)}</span>
    },
    {
      header: 'Consult Fee',
      key: 'consultation_fee',
      render: (row) => <span>₹{Number(row.consultation_fee || 0).toFixed(2)}</span>
    },
    {
      header: 'Total',
      key: 'total_amount',
      render: (row) => (
        <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
          ₹{Number(row.total_amount || 0).toFixed(2)}
        </span>
      )
    },
    {
      header: 'Paid',
      key: 'amount_paid',
      render: (row) => (
        <span style={{ fontWeight: 600, color: Number(row.amount_paid) > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
          ₹{Number(row.amount_paid || 0).toFixed(2)}
        </span>
      )
    },
    {
      header: 'Balance',
      key: 'balance_due',
      render: (row) => {
        const bal = Number(row.balance_due != null ? row.balance_due : (row.total_amount - (row.amount_paid || 0)));
        return (
          <span style={{ fontWeight: 600, color: bal > 0 ? '#b91c1c' : 'var(--text-muted)' }}>
            ₹{bal.toFixed(2)}
          </span>
        );
      }
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
        const bal = Number(row.balance_due != null ? row.balance_due : (row.total_amount - (row.amount_paid || 0)));
        return (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => handleOpenReceipt(row)}
              title="View and print official tax receipt"
            >
              🧾 Receipt
            </button>
            {row.status !== 'PAID' && bal > 0 && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleOpenPayment(row)}
                title="Record patient fee payment"
              >
                Collect Fee
              </button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Consultation Invoices & Billing</h1>
          <p className="page-subtitle">Track consultation billing statements, record fee collections, and print receipts.</p>
        </div>
        <button className="btn btn-outline" onClick={loadInvoices}>
          🔄 Refresh Invoices
        </button>
      </div>

      {targetAppointmentQuery && (
        <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            💳 <strong>Appointment #{targetAppointmentQuery} Created:</strong> Please record the patient fee payment below to transition the appointment to booked/confirmed status and enable queue token issuance.
          </div>
        </div>
      )}

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
                style={{ width: '200px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Invoices</option>
                <option value="PENDING">Pending / Unpaid</option>
                <option value="PARTIAL">Partially Paid</option>
                <option value="PAID">Paid in Full</option>
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
        title={`Record Payment: Invoice #${selectedInvoice?.invoice_number || ''}`}
      >
        {selectedInvoice && (
          <form onSubmit={handleSettlePayment}>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Patient</span>
                <span style={{ fontWeight: 600 }}>{selectedInvoice.patient_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Doctor</span>
                <span>{selectedInvoice.doctor_name || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Registration Fee</span>
                <span>₹{Number(selectedInvoice.registration_fee || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Consultation Fee</span>
                <span>₹{Number(selectedInvoice.consultation_fee || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600 }}>Total Invoice Amount</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  ₹{Number(selectedInvoice.total_amount || 0).toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Amount Already Paid</span>
                <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                  ₹{Number(selectedInvoice.amount_paid || 0).toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
                <span style={{ fontWeight: 700, color: '#b91c1c' }}>Outstanding Balance Due</span>
                <span style={{ fontWeight: 700, color: '#b91c1c', fontSize: '1.1rem' }}>
                  ₹{Number(selectedInvoice.balance_due != null ? selectedInvoice.balance_due : (selectedInvoice.total_amount - (selectedInvoice.amount_paid || 0))).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Payment Amount to Collect (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={Number(selectedInvoice.balance_due != null ? selectedInvoice.balance_due : selectedInvoice.total_amount).toFixed(2)}
                className="form-control"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                required
              />
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Enter full or partial payment amount up to ₹{Number(selectedInvoice.balance_due != null ? selectedInvoice.balance_due : selectedInvoice.total_amount).toFixed(2)}.
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
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
              <div className="form-group" style={{ marginBottom: '16px' }}>
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
                {submittingPayment ? 'Processing...' : `Record Payment of ₹${paymentAmount || '0.00'}`}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Printable Receipt Modal */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        title="Printable Receipt & Invoice"
        maxWidth="820px"
      >
        {loadingReceipt || !receiptInvoice ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading receipt details...
          </div>
        ) : (
          <div className="receipt-wrapper">
            {/* Action Bar (Hidden during Print) */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Previewing receipt for Invoice <strong>{receiptInvoice.invoice_number}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setIsReceiptModalOpen(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handlePrintReceipt}
                >
                  🖨️ Print Receipt
                </button>
              </div>
            </div>

            {/* Printable Receipt Card */}
            <div id="printable-receipt-portal">
              <div className="receipt-card">
                {/* Header */}
                <div className="receipt-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '1.4rem' }}>🏥</span>
                      <h2 className="receipt-clinic-title">
                        {receiptInvoice.clinic_info?.clinic_name || 'Clinic Management System'}
                      </h2>
                    </div>
                    {receiptInvoice.clinic_info?.clinic_address && (
                      <p className="receipt-clinic-sub">{receiptInvoice.clinic_info.clinic_address}</p>
                    )}
                    <p className="receipt-clinic-sub">
                      {receiptInvoice.clinic_info?.clinic_phone && `Phone: ${receiptInvoice.clinic_info.clinic_phone}`}
                      {receiptInvoice.clinic_info?.clinic_email && ` | Email: ${receiptInvoice.clinic_info.clinic_email}`}
                    </p>
                  </div>
                  <div className="receipt-doc-title">
                    <div className="receipt-doc-name">
                      {receiptInvoice.status === 'PAID' ? 'TAX INVOICE & RECEIPT' : 'BILLING STATEMENT'}
                    </div>
                    <div>
                      {receiptInvoice.status === 'PAID' && (
                        <span className="receipt-stamp-badge stamp-paid">✓ PAID IN FULL</span>
                      )}
                      {receiptInvoice.status === 'PARTIAL' && (
                        <span className="receipt-stamp-badge stamp-partial">⚠ PARTIALLY PAID</span>
                      )}
                      {receiptInvoice.status === 'PENDING' && (
                        <span className="receipt-stamp-badge stamp-pending">⏳ PENDING PAYMENT</span>
                      )}
                      {receiptInvoice.status === 'CANCELLED' && (
                        <span className="receipt-stamp-badge stamp-pending">CANCELLED</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Metadata Details Grid */}
                <div className="receipt-meta-grid">
                  <div>
                    <div className="receipt-meta-item">
                      <span className="receipt-meta-label">Invoice No:</span>
                      <span className="receipt-meta-value">{receiptInvoice.invoice_number}</span>
                    </div>
                    <div className="receipt-meta-item">
                      <span className="receipt-meta-label">Date:</span>
                      <span className="receipt-meta-value">
                        {formatDate(receiptInvoice.appointment_date || receiptInvoice.created_at)}
                      </span>
                    </div>
                    <div className="receipt-meta-item">
                      <span className="receipt-meta-label">Appointment Ref:</span>
                      <span className="receipt-meta-value">Appt #{receiptInvoice.appointment}</span>
                    </div>
                    <div className="receipt-meta-item">
                      <span className="receipt-meta-label">Consulting Doctor:</span>
                      <span className="receipt-meta-value">
                        {receiptInvoice.doctor_name || '—'}
                        {receiptInvoice.doctor_specialization && ` (${receiptInvoice.doctor_specialization})`}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="receipt-meta-item">
                      <span className="receipt-meta-label">Patient ID:</span>
                      <span className="receipt-meta-value">{receiptInvoice.patient_id || `P-${receiptInvoice.patient}`}</span>
                    </div>
                    <div className="receipt-meta-item">
                      <span className="receipt-meta-label">Patient Name:</span>
                      <span className="receipt-meta-value">{receiptInvoice.patient_name}</span>
                    </div>
                    <div className="receipt-meta-item">
                      <span className="receipt-meta-label">Phone:</span>
                      <span className="receipt-meta-value">{receiptInvoice.patient_phone || '—'}</span>
                    </div>
                    <div className="receipt-meta-item">
                      <span className="receipt-meta-label">Gender:</span>
                      <span className="receipt-meta-value">{receiptInvoice.patient_gender || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Itemized Table */}
                <table className="receipt-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th>Service / Item Description</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'right', width: '120px' }}>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Number(receiptInvoice.registration_fee) > 0 && (
                      <tr>
                        <td>1</td>
                        <td>
                          <strong>Patient Registration Fee</strong>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>One-time registration and patient file creation</div>
                        </td>
                        <td>Administrative</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          ₹{Number(receiptInvoice.registration_fee).toFixed(2)}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td>{Number(receiptInvoice.registration_fee) > 0 ? 2 : 1}</td>
                      <td>
                        <strong>Doctor Consultation Fee</strong>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Outpatient consultation ({receiptInvoice.doctor_specialization || 'General'})
                        </div>
                      </td>
                      <td>Clinical</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        ₹{Number(receiptInvoice.consultation_fee).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="receipt-table-totals">
                      <td colSpan="3" style={{ textAlign: 'right', fontWeight: 600, color: '#64748b' }}>
                        Subtotal:
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        ₹{Number(receiptInvoice.total_amount).toFixed(2)}
                      </td>
                    </tr>
                    <tr className="receipt-table-totals grand-total">
                      <td colSpan="3" style={{ textAlign: 'right' }}>Total Invoice Amount:</td>
                      <td style={{ textAlign: 'right' }}>
                        ₹{Number(receiptInvoice.total_amount).toFixed(2)}
                      </td>
                    </tr>
                    <tr className="receipt-table-totals">
                      <td colSpan="3" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>
                        Amount Paid:
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                        ₹{Number(receiptInvoice.amount_paid || 0).toFixed(2)}
                      </td>
                    </tr>
                    <tr className="receipt-table-totals">
                      <td colSpan="3" style={{ textAlign: 'right', fontWeight: 700, color: Number(receiptInvoice.balance_due) > 0 ? '#b91c1c' : '#64748b' }}>
                        Outstanding Balance:
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: Number(receiptInvoice.balance_due) > 0 ? '#b91c1c' : '#64748b' }}>
                        ₹{Number(receiptInvoice.balance_due != null ? receiptInvoice.balance_due : (receiptInvoice.total_amount - (receiptInvoice.amount_paid || 0))).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Recorded Payments History */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a', marginBottom: '6px' }}>
                    Payment Transaction History:
                  </div>
                  {receiptInvoice.payments && receiptInvoice.payments.length > 0 ? (
                    <table className="receipt-payments-table">
                      <thead>
                        <tr>
                          <th>Payment Date</th>
                          <th>Payment Mode</th>
                          <th>Transaction ID / Reference</th>
                          <th style={{ textAlign: 'right' }}>Amount Paid (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receiptInvoice.payments.map((p, idx) => (
                          <tr key={p.id || idx}>
                            <td>{formatDate(p.payment_date)} {formatTime(p.payment_date)}</td>
                            <td><strong>{p.payment_method}</strong></td>
                            <td>{p.transaction_id || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              ₹{Number(p.amount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                      No payment has been recorded for this invoice yet.
                    </div>
                  )}
                </div>

                {/* Footer Notes & Signatures */}
                <div className="receipt-footer-notes">
                  <div>
                    <div>• Computer-generated receipt; no manual signature required.</div>
                    <div>• Please keep this receipt for future reference and follow-up consultations.</div>
                    <div style={{ marginTop: '4px', fontSize: '0.74rem', color: '#94a3b8' }}>
                      Printed on: {new Date().toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="receipt-signature-line">
                      Authorized Reception Desk
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReceptionistBillingPage;
