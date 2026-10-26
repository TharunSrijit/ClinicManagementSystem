import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, CheckCircle2, Clock, AlertTriangle, ArrowRight, Eye } from 'lucide-react';
import pharmacyService from '../../services/pharmacyService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import PharmacyReceipt from '../../components/PharmacyReceipt';
import { formatDate } from '../../utils/formatters';

const STATUS_TABS = [
  { key: 'ALL', label: 'All Prescriptions' },
  { key: 'AWAITING_BILLING', label: 'Awaiting Billing' },
  { key: 'AWAITING_PAYMENT', label: 'Awaiting Payment' },
  { key: 'READY_FOR_DISPENSING', label: 'Ready to Dispense' },
  { key: 'PARTIALLY_DISPENSED', label: 'Partially Dispensed' },
  { key: 'FULLY_DISPENSED', label: 'Fully Dispensed' }
];

export const PharmacyPrescriptionsPage = () => {
  const navigate = useNavigate();

  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Prepare Bill / Dispensing Quantities Modal State
  const [selectedRx, setSelectedRx] = useState(null);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [itemQuantities, setItemQuantities] = useState({}); // { [medicineId]: number }
  const [partialReason, setPartialReason] = useState('Patient Affordability');
  const [dispenseNotes, setDispenseNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Dispense Action State (direct from Ready to Dispense)
  const [dispensingId, setDispensingId] = useState(null);

  // Receipt Modal State (for viewed bills/receipts)
  const [receiptInvoice, setReceiptInvoice] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadPrescriptions = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (activeTab !== 'ALL') {
        params.status = activeTab;
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }
      const data = await pharmacyService.getPrescriptions(params);
      setPrescriptions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load prescriptions:', err);
      showFeedback('Could not fetch prescriptions queue.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchTerm]);

  useEffect(() => {
    loadPrescriptions();
  }, [loadPrescriptions]);

  // Open "Prepare Bill / Select Quantities" Modal
  const handleOpenPrepareBill = (rx) => {
    setSelectedRx(rx);
    setFormError('');
    setPartialReason('Patient Affordability');
    setDispenseNotes('');

    // Prepopulate quantities with each item's remaining quantity (or 0 if out of stock)
    const initialQtyMap = {};
    (rx.items || []).forEach((it) => {
      const remaining = it.remaining_quantity != null ? it.remaining_quantity : it.quantity;
      const stock = it.available_stock != null ? it.available_stock : 999;
      // Default to remaining, capped by in-stock
      initialQtyMap[it.medicine] = Math.min(remaining, stock);
    });

    setItemQuantities(initialQtyMap);
    setIsBillModalOpen(true);
  };

  const handleQuantityChange = (medicineId, val, maxRemaining, maxStock) => {
    const parsed = parseInt(val, 10);
    const qty = isNaN(parsed) ? 0 : parsed;
    const clamped = Math.max(0, Math.min(qty, maxRemaining));
    setItemQuantities((prev) => ({
      ...prev,
      [medicineId]: clamped
    }));
    setFormError('');
  };

  // Determine if this is a partial dispensing
  const isPartialDispense = useMemo(() => {
    if (!selectedRx || !selectedRx.items) return false;
    return selectedRx.items.some((it) => {
      const selected = itemQuantities[it.medicine] || 0;
      const remaining = it.remaining_quantity != null ? it.remaining_quantity : it.quantity;
      return selected < remaining;
    });
  }, [selectedRx, itemQuantities]);

  // Calculate Subtotal for the proposed bill
  const billSubtotal = useMemo(() => {
    if (!selectedRx || !selectedRx.items) return 0;
    return selectedRx.items.reduce((acc, it) => {
      const qty = itemQuantities[it.medicine] || 0;
      const price = parseFloat(it.unit_price || 0);
      return acc + qty * price;
    }, 0);
  }, [selectedRx, itemQuantities]);

  // Submit Proposed Bill & Redirect to Pharmacy Billing Page
  const handleCreateBill = async (e) => {
    e.preventDefault();
    if (!selectedRx) return;

    // Validate that at least one item has quantity > 0
    const itemsPayload = [];
    for (const it of selectedRx.items || []) {
      const qty = itemQuantities[it.medicine] || 0;
      if (qty > 0) {
        const remaining = it.remaining_quantity != null ? it.remaining_quantity : it.quantity;
        const stock = it.available_stock != null ? it.available_stock : 999;

        if (qty > remaining) {
          setFormError(`Cannot dispense ${qty} units of ${it.medicine_name}; only ${remaining} remain.`);
          return;
        }
        if (qty > stock) {
          setFormError(`Insufficient stock for ${it.medicine_name}. Available: ${stock}.`);
          return;
        }

        itemsPayload.push({
          medicine_id: it.medicine,
          quantity: qty,
          reason: isPartialDispense ? partialReason : undefined
        });
      }
    }

    if (itemsPayload.length === 0) {
      setFormError('Please select at least one medicine with a quantity greater than 0.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const billData = {
        items: itemsPayload,
        partial_reason: isPartialDispense ? partialReason : '',
        notes: dispenseNotes.trim()
      };

      const createdInvoice = await pharmacyService.createBill(selectedRx.id, billData);
      showFeedback(`Pharmacy Bill #${createdInvoice.invoice_number} created successfully.`);
      setIsBillModalOpen(false);

      // Redirect directly to Pharmacy Billing page with highlight & auto-payment modal open
      navigate(`/pharmacy/billing?highlight=${createdInvoice.id}&openPayment=true`);
    } catch (err) {
      console.error('Bill creation failed:', err);
      const serverMsg =
        err.response?.data?.detail ||
        err.data?.detail ||
        err.message ||
        'Failed to generate pharmacy bill.';
      setFormError(serverMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Direct Dispense Action (when bill is already PAID)
  const handleDirectDispense = async (rx) => {
    if (!rx.active_bill || !rx.active_bill.dispense_id) return;
    setDispensingId(rx.id);
    try {
      await pharmacyService.dispenseOrder(rx.active_bill.dispense_id);
      showFeedback(`Medications for Rx #${rx.prescription_number} successfully dispensed and inventory deducted.`);
      await loadPrescriptions();
    } catch (err) {
      console.error('Dispense failed:', err);
      showFeedback(err.message || 'Dispensing failed. Ensure bill is paid and stock is available.', 'danger');
    } finally {
      setDispensingId(null);
    }
  };

  // View Receipt Modal
  const handleViewReceipt = async (rx) => {
    if (!rx.active_bill || !rx.active_bill.invoice_id) return;
    setLoadingReceipt(true);
    try {
      const inv = await pharmacyService.getInvoice(rx.active_bill.invoice_id);
      setReceiptInvoice(inv);
      setIsReceiptModalOpen(true);
    } catch (err) {
      console.error('Failed to load invoice receipt:', err);
      showFeedback('Could not fetch receipt details.', 'danger');
    } finally {
      setLoadingReceipt(false);
    }
  };

  const getStatusBadge = (statusKey, label) => {
    switch (statusKey) {
      case 'FULLY_DISPENSED':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              color: '#15803d',
              padding: '4px 8px',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            ✓ Fully Dispensed
          </span>
        );
      case 'PARTIALLY_DISPENSED':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(168, 85, 247, 0.1)',
              color: '#7e22ce',
              padding: '4px 8px',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            Partially Dispensed
          </span>
        );
      case 'READY_FOR_DISPENSING':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              color: '#1d4ed8',
              padding: '4px 8px',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            ● Paid & Ready to Dispense
          </span>
        );
      case 'AWAITING_PAYMENT':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(234, 179, 8, 0.1)',
              color: '#b45309',
              padding: '4px 8px',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            ⏳ Awaiting Payment
          </span>
        );
      case 'AWAITING_BILLING':
      default:
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(100, 116, 139, 0.1)',
              color: '#475569',
              padding: '4px 8px',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            Awaiting Billing
          </span>
        );
    }
  };

  const columns = [
    {
      header: 'Prescription #',
      key: 'prescription_number',
      render: (row) => (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
            {row.prescription_number || `#${row.id}`}
          </span>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {formatDate(row.prescription_date)}
          </div>
        </div>
      )
    },
    {
      header: 'Patient Details',
      key: 'patient_name',
      render: (row) => (
        <div>
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            {row.patient_name || `Patient #${row.patient}`}
          </span>
          {row.patient_identifier && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              ID: {row.patient_identifier}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Prescribing Doctor',
      key: 'doctor_name',
      render: (row) => <span>{row.doctor_name || 'Clinic Doctor'}</span>
    },
    {
      header: 'Medication Orders & Quantities',
      key: 'items',
      render: (row) => {
        const items = row.items || [];
        if (items.length === 0) return <span style={{ color: 'var(--text-muted)' }}>No items</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {items.map((it, idx) => (
              <div key={idx} style={{ fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600 }}>{it.medicine_name}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
                  (Rx: {it.prescribed_quantity} | Disp: {it.dispensed_quantity} | Rem: {it.remaining_quantity})
                </span>
              </div>
            ))}
          </div>
        );
      }
    },
    {
      header: 'Dispensing Status',
      key: 'dispensing_status',
      render: (row) => (
        <div>
          {getStatusBadge(row.dispensing_status, row.dispensing_status_display)}
          {row.active_bill && (
            <div style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-muted)' }}>
              Bill: <strong>{row.active_bill.invoice_number}</strong> ({row.active_bill.invoice_status})
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Action',
      key: 'actions',
      headerStyle: { minWidth: '190px' },
      render: (row) => {
        const statusKey = row.dispensing_status;

        if (statusKey === 'AWAITING_BILLING' || statusKey === 'PARTIALLY_DISPENSED') {
          return (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleOpenPrepareBill(row)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Receipt size={14} />
              Prepare Bill / Dispense
            </button>
          );
        }

        if (statusKey === 'AWAITING_PAYMENT') {
          return (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() =>
                navigate(`/pharmacy/billing?highlight=${row.active_bill?.invoice_id}&openPayment=true`)
              }
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#b45309' }}
            >
              Collect Payment
              <ArrowRight size={14} />
            </button>
          );
        }

        if (statusKey === 'READY_FOR_DISPENSING') {
          return (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
              onClick={() => handleDirectDispense(row)}
              disabled={dispensingId === row.id}
            >
              {dispensingId === row.id ? 'Dispensing...' : 'Dispense Medicines'}
            </button>
          );
        }

        if (statusKey === 'FULLY_DISPENSED') {
          return (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => handleViewReceipt(row)}
              disabled={loadingReceipt}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Eye size={14} />
              View Receipt
            </button>
          );
        }

        return <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>;
      }
    }
  ];

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
            Pharmacy Prescription Queue
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Review doctor orders, select dispensing quantities, create bills, and dispense paid medications.
          </p>
        </div>
        <button type="button" className="btn btn-outline" onClick={loadPrescriptions}>
          Refresh Queue
        </button>
      </div>

      {feedback.message && (
        <div
          className={`alert alert-${feedback.type}`}
          style={{ marginBottom: '20px' }}
          role="alert"
        >
          {feedback.message}
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`btn btn-sm ${activeTab === tab.key ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ width: '260px' }}>
            <input
              type="search"
              className="form-control"
              placeholder="Search patient, Rx#, doctor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search prescriptions"
            />
          </div>
        </div>
      </div>

      {/* Prescriptions DataTable */}
      <div className="card" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          data={prescriptions}
          loading={loading}
          emptyMessage="No prescriptions matching current filter."
        />
      </div>

      {/* Select Dispensing Quantities & Create Bill Modal */}
      <Modal
        isOpen={isBillModalOpen}
        onClose={() => {
          if (!submitting) setIsBillModalOpen(false);
        }}
        title={`Prepare Pharmacy Bill: Rx #${selectedRx?.prescription_number || ''}`}
      >
        {selectedRx && (
          <form onSubmit={handleCreateBill}>
            {/* Patient & Doctor Context Banner */}
            <div
              style={{
                background: '#f8fafc',
                padding: '14px 18px',
                borderRadius: '8px',
                marginBottom: '16px',
                border: '1px solid #e2e8f0',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px'
              }}
            >
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Patient:</span>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                  {selectedRx.patient_name} ({selectedRx.patient_identifier || `P-${selectedRx.patient}`})
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Prescribing Doctor:</span>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{selectedRx.doctor_name}</div>
              </div>
            </div>

            {/* Error Message */}
            {formError && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#b91c1c',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '6px',
                  fontSize: '0.88rem',
                  marginBottom: '16px'
                }}
              >
                {formError}
              </div>
            )}

            {/* Medicines List Table */}
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px' }}>
              Select Dispensing Quantities:
            </h4>
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                overflow: 'hidden',
                marginBottom: '16px'
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Medicine</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: '70px' }}>Rx Qty</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: '70px' }}>Rem Qty</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: '70px' }}>Stock</th>
                    <th style={{ padding: '8px 12px', width: '110px' }}>Qty to Bill *</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', width: '90px' }}>Price (₹)</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', width: '100px' }}>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedRx.items || []).map((it) => {
                    const remaining = it.remaining_quantity != null ? it.remaining_quantity : it.quantity;
                    const stock = it.available_stock != null ? it.available_stock : 0;
                    const curQty = itemQuantities[it.medicine] !== undefined ? itemQuantities[it.medicine] : remaining;
                    const unitPrice = parseFloat(it.unit_price || 0);
                    const lineTotal = curQty * unitPrice;

                    return (
                      <tr key={it.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{it.medicine_name}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            {it.dosage_name || ''} • {it.frequency || 'Daily'} ({it.duration || ''})
                          </div>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>{it.prescribed_quantity}</td>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600 }}>{remaining}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <span
                            style={{
                              color: stock < remaining ? '#dc2626' : '#16a34a',
                              fontWeight: 600
                            }}
                          >
                            {stock}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <input
                            type="number"
                            min="0"
                            max={Math.min(remaining, stock)}
                            className="form-control"
                            style={{ padding: '4px 8px', fontSize: '0.88rem', textAlign: 'center' }}
                            value={curQty}
                            onChange={(e) =>
                              handleQuantityChange(it.medicine, e.target.value, remaining, stock)
                            }
                            disabled={submitting || stock === 0}
                          />
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          ₹{unitPrice.toFixed(2)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                          ₹{lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Partial Dispensing Reason Box (Required when isPartialDispense is true) */}
            {isPartialDispense && (
              <div
                style={{
                  background: 'rgba(234, 179, 8, 0.08)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#b45309', fontWeight: 600 }}>
                  <AlertTriangle size={18} />
                  Partial Dispensing Recorded
                </div>
                <div style={{ fontSize: '0.82rem', color: '#78350f', marginBottom: '10px' }}>
                  One or more medications are selected below the remaining prescribed quantity. Please record the clinical or administrative reason.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.82rem' }}>
                      Reason for Partial Dispensing *
                    </label>
                    <select
                      className="form-select"
                      style={{ fontSize: '0.85rem' }}
                      value={partialReason}
                      onChange={(e) => setPartialReason(e.target.value)}
                    >
                      <option value="Patient Affordability">Patient Affordability (Purchasing partial supply)</option>
                      <option value="Stock Shortage">Pharmacy Stock Shortage (Batch depleted)</option>
                      <option value="Patient Clinical Request">Patient Clinical Request / Trial</option>
                      <option value="Other Authorized Reason">Other Authorized Reason</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.82rem' }}>
                      Notes / Remarks
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      style={{ fontSize: '0.85rem' }}
                      placeholder="e.g. Patient will buy balance in 3 days"
                      value={dispenseNotes}
                      onChange={(e) => setDispenseNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bill Summary Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
                padding: '12px 18px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '1px solid #e2e8f0'
              }}
            >
              <div>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Total Billed Amount:</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0284c7' }}>
                  ₹{billSubtotal.toFixed(2)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsBillModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || billSubtotal <= 0}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {submitting ? 'Generating Bill...' : 'Create Pharmacy Bill & Proceed to Payment'}
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* View Printable Receipt Modal */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        title="Pharmacy Tax Invoice & Dispensing Receipt"
      >
        <PharmacyReceipt invoice={receiptInvoice} />
      </Modal>
    </div>
  );
};

export default PharmacyPrescriptionsPage;
