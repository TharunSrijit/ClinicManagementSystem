import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  Printer,
  PackageCheck,
  Search,
  AlertCircle,
  FileText,
  Clock,
  CheckCircle2
} from 'lucide-react';
import pharmacyService from '../../services/pharmacyService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import PharmacyReceipt from '../../components/PharmacyReceipt';
import { formatDate } from '../../utils/formatters';

export const PharmacyBillingPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const openPaymentParam = searchParams.get('openPayment');

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptInvoice, setReceiptInvoice] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [detailsInvoice, setDetailsInvoice] = useState(null);

  // Payment form state
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionId, setTransactionId] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [dispensingId, setDispensingId] = useState(null);

  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 6000);
  };

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await pharmacyService.getInvoices();
      const list = Array.isArray(data) ? data : [];
      setInvoices(list);
      return list;
    } catch (err) {
      console.error('Failed to load pharmacy invoices:', err);
      showFeedback('Could not fetch pharmacy billing invoices.', 'danger');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and URL param handling
  useEffect(() => {
    loadInvoices().then((list) => {
      if (highlightId && list.length > 0) {
        const found = list.find((inv) => String(inv.id) === String(highlightId));
        if (found) {
          if (openPaymentParam === 'true' && found.status !== 'PAID') {
            setSelectedInvoice(found);
            setPaymentMethod('CASH');
            setTransactionId('');
            setIsPaymentModalOpen(true);
            // Clear openPayment param to prevent re-opening on manual refresh
            setSearchParams({ highlight: highlightId }, { replace: true });
          }
        }
      }
    });
  }, [loadInvoices, highlightId, openPaymentParam, setSearchParams]);

  const handleOpenPayment = (inv) => {
    setSelectedInvoice(inv);
    setPaymentMethod('CASH');
    setTransactionId('');
    setIsPaymentModalOpen(true);
  };

  const handleSettlePayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setSubmittingPayment(true);
    try {
      await pharmacyService.createPayment({
        invoice: selectedInvoice.id,
        amount: selectedInvoice.total_amount,
        payment_method: paymentMethod,
        transaction_id: transactionId.trim() || undefined
      });
      showFeedback(
        `Payment recorded successfully for Pharmacy Invoice #${selectedInvoice.invoice_number || selectedInvoice.id}! Now eligible for dispensing.`
      );
      setIsPaymentModalOpen(false);
      const updatedList = await loadInvoices();
      // Keep selected invoice updated
      const updatedInv = updatedList.find((i) => i.id === selectedInvoice.id);
      if (updatedInv) setSelectedInvoice(updatedInv);
    } catch (err) {
      console.error('Pharmacy payment failed:', err);
      showFeedback(err.message || 'Payment submission failed.', 'danger');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDispenseMedicines = async (inv) => {
    if (inv.status !== 'PAID') {
      showFeedback('Payment gating: Medicines cannot be dispensed for an unpaid bill.', 'danger');
      return;
    }

    if (!window.confirm(`Dispense paid medicines for Invoice #${inv.invoice_number}? This will deduct inventory and log stock transactions.`)) {
      return;
    }

    setDispensingId(inv.id);
    try {
      await pharmacyService.dispenseOrder(inv.dispense);
      showFeedback(
        `Medicines dispensed successfully for ${inv.patient_name || 'patient'}! Inventory has been deducted.`
      );
      const updatedList = await loadInvoices();
      const updatedInv = updatedList.find((i) => i.id === inv.id);
      if (updatedInv) {
        setReceiptInvoice(updatedInv);
        setIsReceiptModalOpen(true);
      }
    } catch (err) {
      console.error('Dispensing failed:', err);
      showFeedback(err.message || 'Failed to dispense medication.', 'danger');
    } finally {
      setDispensingId(null);
    }
  };

  const handleOpenReceipt = async (inv) => {
    try {
      const fullInv = await pharmacyService.getInvoice(inv.id);
      setReceiptInvoice(fullInv);
      setIsReceiptModalOpen(true);
    } catch (err) {
      console.error('Failed to load full invoice for receipt:', err);
      setReceiptInvoice(inv);
      setIsReceiptModalOpen(true);
    }
  };

  const handleOpenDetails = (inv) => {
    setDetailsInvoice(inv);
    setIsDetailsModalOpen(true);
  };

  // Filter invoices
  const filteredInvoices = invoices.filter((inv) => {
    // Status filter
    if (statusFilter === 'PENDING_PAYMENT' && inv.status === 'PAID') return false;
    if (statusFilter === 'READY_TO_DISPENSE' && (inv.status !== 'PAID' || inv.dispense_status === 'DISPENSED')) return false;
    if (statusFilter === 'DISPENSED' && inv.dispense_status !== 'DISPENSED') return false;

    // Search term
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const numMatch = (inv.invoice_number || '').toLowerCase().includes(q);
      const patientMatch = (inv.patient_name || '').toLowerCase().includes(q);
      const pidMatch = (inv.patient_identifier || '').toLowerCase().includes(q);
      const rxMatch = (inv.prescription_number || '').toLowerCase().includes(q);
      return numMatch || patientMatch || pidMatch || rxMatch;
    }

    return true;
  });

  const columns = [
    {
      header: 'Invoice #',
      key: 'invoice_number',
      render: (row) => {
        const isHighlighted = highlightId && String(row.id) === String(highlightId);
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                {row.invoice_number || `#${row.id}`}
              </span>
              {isHighlighted && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    background: '#e0e7ff',
                    color: '#4338ca',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '10px'
                  }}
                >
                  NEW
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {formatDate(row.created_at)}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Patient Details',
      key: 'patient_name',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            {row.patient_name || `Patient #${row.patient}`}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            ID: {row.patient_identifier || `P-${row.patient}`}
            {row.patient_phone && ` • ${row.patient_phone}`}
          </div>
        </div>
      )
    },
    {
      header: 'Prescription & Doctor',
      key: 'prescription_number',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-main)' }}>
            {row.prescription_number || `Rx #${row.prescription_id || '—'}`}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Dr. {row.doctor_name || 'Physician'}
          </div>
        </div>
      )
    },
    {
      header: 'Total Payable',
      key: 'total_amount',
      render: (row) => (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>
            ₹{Number(row.total_amount || 0).toFixed(2)}
          </span>
          {row.items && row.items.length > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {row.items.length} item{row.items.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Payment Status',
      key: 'status',
      render: (row) => (
        <div>
          <Badge status={row.status} />
          {row.status === 'PAID' && (
            <div style={{ fontSize: '0.74rem', color: 'var(--success)', marginTop: '2px', fontWeight: 600 }}>
              Paid in Full
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Dispense Status',
      key: 'dispense_status',
      render: (row) => {
        if (row.dispense_status === 'DISPENSED') {
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                background: '#dcfce7',
                color: '#15803d'
              }}
            >
              <CheckCircle2 size={13} />
              Dispensed
            </span>
          );
        }
        if (row.status === 'PAID') {
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                background: '#dbeafe',
                color: '#1d4ed8'
              }}
            >
              <PackageCheck size={13} />
              Ready to Dispense
            </span>
          );
        }
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              background: '#fef3c7',
              color: '#b45309'
            }}
          >
            <Clock size={13} />
            Awaiting Payment
          </span>
        );
      }
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => {
        const isPaid = row.status === 'PAID';
        const isDispensed = row.dispense_status === 'DISPENSED';
        const isDispensing = dispensingId === row.id;

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Payment Button if Unpaid */}
            {!isPaid && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleOpenPayment(row)}
                title="Record patient payment for this bill"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <CreditCard size={13} />
                Collect Payment
              </button>
            )}

            {/* Dispense Button if Paid & Pending */}
            {isPaid && !isDispensed && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleDispenseMedicines(row)}
                disabled={isDispensing}
                title="Deduct inventory and fulfill medication"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#16a34a',
                  borderColor: '#16a34a'
                }}
              >
                <PackageCheck size={14} />
                {isDispensing ? 'Dispensing...' : 'Dispense Medicines'}
              </button>
            )}

            {/* View / Print Receipt */}
            <button
              className="btn btn-outline btn-sm"
              onClick={() => handleOpenReceipt(row)}
              title="View and print official pharmacy receipt"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <Printer size={13} />
              Receipt
            </button>

            {/* View Bill Details */}
            <button
              className="btn btn-outline btn-sm"
              onClick={() => handleOpenDetails(row)}
              title="View bill line items and details"
              style={{ padding: '4px 8px' }}
            >
              <FileText size={13} />
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
          <h1 className="page-title">Pharmacy Medication Billing</h1>
          <p className="page-subtitle">
            Manage pharmacy invoices, collect customer payments, enforce payment gating, and dispense medications.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline" onClick={loadInvoices} disabled={loading}>
            Refresh Invoices
          </button>
        </div>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {feedback.type === 'danger' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Newly created bill notice banner */}
      {highlightId && (
        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} color="#2563eb" />
            <div>
              <div style={{ fontWeight: 700, color: '#1e40af', fontSize: '0.92rem' }}>
                Pharmacy Bill Ready for Payment Settlement
              </div>
              <div style={{ fontSize: '0.84rem', color: '#3b82f6' }}>
                Medicines cannot be dispensed until payment is collected. Settle payment below to enable dispensing.
              </div>
            </div>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setSearchParams({}, { replace: true })}
            style={{ fontSize: '0.78rem' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters and Status Tabs */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'All Invoices' },
              { id: 'PENDING_PAYMENT', label: 'Awaiting Payment' },
              { id: 'READY_TO_DISPENSE', label: 'Paid & Ready to Dispense' },
              { id: 'DISPENSED', label: 'Dispensed' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm ${statusFilter === tab.id ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setStatusFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '280px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Search invoice #, patient, Rx..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '36px', fontSize: '0.88rem' }}
              />
            </div>
            {searchTerm && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setSearchTerm('')}
                style={{ whiteSpace: 'nowrap' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredInvoices}
        loading={loading}
        emptyMessage="No pharmacy invoices found matching criteria."
      />

      {/* Payment Settlement Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Record Payment — Bill #${selectedInvoice?.invoice_number || selectedInvoice?.id || ''}`}
      >
        {selectedInvoice && (
          <form onSubmit={handleSettlePayment}>
            <div
              style={{
                background: '#f8fafc',
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '20px',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Patient Name</span>
                <span style={{ fontWeight: 600 }}>{selectedInvoice.patient_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Prescription Ref</span>
                <span style={{ fontWeight: 600 }}>
                  {selectedInvoice.prescription_number || `Rx #${selectedInvoice.prescription_id}`}
                </span>
              </div>
              {selectedInvoice.dispense_notes && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Dispense Reason</span>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{selectedInvoice.dispense_notes}</span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '10px',
                  marginTop: '10px'
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>Total Amount Due</span>
                <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.25rem' }}>
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
                <label className="form-label">Transaction / UTR Reference</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. UPI8839210 or POS Ref"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                />
              </div>
            )}

            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: '16px',
                background: '#f1f5f9',
                padding: '8px 12px',
                borderRadius: '6px'
              }}
            >
              ℹ️ Once payment is recorded, the invoice status changes to <strong>PAID</strong>, unlocking the Dispense Medicines action.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setIsPaymentModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingPayment}
              >
                {submittingPayment ? 'Recording...' : `Collect ₹${Number(selectedInvoice.total_amount || 0).toFixed(2)}`}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Bill Line Items / Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={`Pharmacy Bill Details — #${detailsInvoice?.invoice_number || detailsInvoice?.id || ''}`}
        size="lg"
      >
        {detailsInvoice && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                background: '#f8fafc',
                padding: '14px 18px',
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '0.88rem'
              }}
            >
              <div>
                <div><strong>Patient:</strong> {detailsInvoice.patient_name}</div>
                <div><strong>Identifier:</strong> {detailsInvoice.patient_identifier || `P-${detailsInvoice.patient}`}</div>
                <div><strong>Prescription:</strong> {detailsInvoice.prescription_number || `Rx #${detailsInvoice.prescription_id}`}</div>
              </div>
              <div>
                <div><strong>Prescribing Doctor:</strong> Dr. {detailsInvoice.doctor_name || 'Physician'}</div>
                <div><strong>Invoice Date:</strong> {formatDate(detailsInvoice.created_at)}</div>
                <div>
                  <strong>Status: </strong>
                  <Badge status={detailsInvoice.status} />
                </div>
              </div>
            </div>

            {detailsInvoice.dispense_notes && (
              <div
                style={{
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  color: '#92400e',
                  marginBottom: '16px'
                }}
              >
                <strong>Dispensing Note / Reason: </strong>
                {detailsInvoice.dispense_notes}
              </div>
            )}

            <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '0.92rem' }}>
              Billed Medication Items:
            </div>
            <table className="table" style={{ fontSize: '0.88rem', marginBottom: '16px' }}>
              <thead>
                <tr>
                  <th>Medicine Name</th>
                  <th style={{ textAlign: 'center' }}>Billed Qty</th>
                  <th style={{ textAlign: 'right' }}>Unit Price (₹)</th>
                  <th style={{ textAlign: 'right' }}>Line Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {detailsInvoice.items && detailsInvoice.items.length > 0 ? (
                  detailsInvoice.items.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td>
                        <strong>{it.medicine_name}</strong>
                        {it.medicine_sku && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            SKU: {it.medicine_sku}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{it.quantity}</td>
                      <td style={{ textAlign: 'right' }}>₹{Number(it.unit_price).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{Number(it.total_price).toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No item details found.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total Payable:</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)', fontSize: '1rem' }}>
                    ₹{Number(detailsInvoice.total_amount || 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  handleOpenReceipt(detailsInvoice);
                }}
              >
                <Printer size={15} style={{ marginRight: '6px' }} />
                Print Receipt
              </button>
              {detailsInvoice.status !== 'PAID' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    handleOpenPayment(detailsInvoice);
                  }}
                >
                  <CreditCard size={15} style={{ marginRight: '6px' }} />
                  Collect Payment
                </button>
              ) : detailsInvoice.dispense_status !== 'DISPENSED' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    handleDispenseMedicines(detailsInvoice);
                  }}
                >
                  <PackageCheck size={15} style={{ marginRight: '6px' }} />
                  Dispense Medicines
                </button>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

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

export default PharmacyBillingPage;
