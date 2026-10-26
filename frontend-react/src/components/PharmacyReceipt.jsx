import React from 'react';
import { Hospital, Printer } from 'lucide-react';
import { formatDate, formatTime } from '../utils/formatters';

export const PharmacyReceipt = ({ invoice, onPrint }) => {
  if (!invoice) return null;

  const totalAmount = Number(invoice.total_amount || 0);
  const amountPaid = Number(invoice.amount_paid != null ? invoice.amount_paid : (invoice.status === 'PAID' ? totalAmount : 0));
  const balanceDue = Number(
    invoice.balance_due != null ? invoice.balance_due : Math.max(0, totalAmount - amountPaid)
  );

  const clinicName = invoice.clinic_info?.clinic_name || 'MedCore Clinic';
  const clinicAddress = invoice.clinic_info?.address || '123 Health Avenue, Medical District';
  const clinicPhone = invoice.clinic_info?.phone || '+91 98765 43210';
  const clinicEmail = invoice.clinic_info?.email || 'pharmacy@medcoreclinic.com';

  const isPaid = invoice.status === 'PAID';
  const docTitle = isPaid
    ? 'PHARMACY TAX INVOICE & DISPENSING RECEIPT'
    : 'PHARMACY BILLING STATEMENT';

  const items = invoice.items || [];
  const payments = invoice.payments || [];

  const handlePrintClick = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="pharmacy-receipt-wrapper">
      {/* Non-printed toolbar */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          marginBottom: '16px'
        }}
      >
        <button
          type="button"
          className="btn btn-primary"
          onClick={handlePrintClick}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <Printer size={16} />
          Print Pharmacy Receipt
        </button>
      </div>

      <div className="receipt-card" id="printable-receipt-portal">
        {/* Clinic Header */}
        <div className="receipt-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Hospital size={24} strokeWidth={2} color="#0284c7" />
              <h2 className="receipt-clinic-title">{clinicName} — Pharmacy Dept.</h2>
            </div>
            {clinicAddress && <p className="receipt-clinic-sub">{clinicAddress}</p>}
            {(clinicPhone || clinicEmail) && (
              <p className="receipt-clinic-sub">
                {clinicPhone && `Tel: ${clinicPhone}`}
                {clinicPhone && clinicEmail && ' | '}
                {clinicEmail && `Email: ${clinicEmail}`}
              </p>
            )}
          </div>
          <div className="receipt-doc-title">
            <div className="receipt-doc-name">{docTitle}</div>
            <div style={{ marginTop: '6px' }}>
              {invoice.status === 'PAID' && (
                <span className="receipt-stamp-badge stamp-paid">PAID IN FULL</span>
              )}
              {invoice.status === 'PARTIAL' && (
                <span className="receipt-stamp-badge stamp-partial">PARTIALLY PAID</span>
              )}
              {invoice.status === 'PENDING' && (
                <span className="receipt-stamp-badge stamp-pending">PENDING PAYMENT</span>
              )}
              {invoice.status === 'CANCELLED' && (
                <span className="receipt-stamp-badge stamp-pending">CANCELLED</span>
              )}
            </div>
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div className="receipt-meta-grid">
          <div>
            <div className="receipt-meta-item">
              <span className="receipt-meta-label">Bill / Invoice No:</span>
              <span className="receipt-meta-value">{invoice.invoice_number || `#${invoice.id}`}</span>
            </div>
            <div className="receipt-meta-item">
              <span className="receipt-meta-label">Bill Date & Time:</span>
              <span className="receipt-meta-value">
                {formatDate(invoice.created_at)} {formatTime(invoice.created_at)}
              </span>
            </div>
            <div className="receipt-meta-item">
              <span className="receipt-meta-label">Prescription Ref:</span>
              <span className="receipt-meta-value">
                {invoice.prescription_number || `Rx #${invoice.prescription_id || '—'}`}
              </span>
            </div>
            <div className="receipt-meta-item">
              <span className="receipt-meta-label">Prescribing Doctor:</span>
              <span className="receipt-meta-value">{invoice.doctor_name || 'Clinic Physician'}</span>
            </div>
          </div>

          <div>
            <div className="receipt-meta-item">
              <span className="receipt-meta-label">Patient ID:</span>
              <span className="receipt-meta-value">
                {invoice.patient_identifier || `P-${invoice.patient}`}
              </span>
            </div>
            <div className="receipt-meta-item">
              <span className="receipt-meta-label">Patient Name:</span>
              <span className="receipt-meta-value" style={{ fontWeight: 700 }}>
                {invoice.patient_name || '—'}
              </span>
            </div>
            <div className="receipt-meta-item">
              <span className="receipt-meta-label">Contact / Gender:</span>
              <span className="receipt-meta-value">
                {invoice.patient_phone || '—'} {invoice.patient_gender ? `(${invoice.patient_gender})` : ''}
              </span>
            </div>
            <div className="receipt-meta-item">
              <span className="receipt-meta-label">Dispense Status:</span>
              <span
                className="receipt-meta-value"
                style={{
                  fontWeight: 700,
                  color: invoice.dispense_status === 'DISPENSED' ? '#16a34a' : '#d97706'
                }}
              >
                {invoice.dispense_status === 'DISPENSED' ? 'DISPENSED' : 'READY / PENDING DISPENSE'}
                {invoice.dispense_number ? ` (${invoice.dispense_number})` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Partial Dispensing or Notes Banner */}
        {invoice.dispense_notes && (
          <div
            style={{
              padding: '8px 14px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '0.82rem',
              color: '#334155',
              marginBottom: '16px'
            }}
          >
            <strong>Dispensing Remarks / Reason: </strong>
            {invoice.dispense_notes}
          </div>
        )}

        {/* Itemized Medicines Table (Actual Billed Quantities) */}
        <table className="receipt-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>Medication / Item Description</th>
              <th style={{ textAlign: 'center', width: '90px' }}>Unit</th>
              <th style={{ textAlign: 'center', width: '90px' }}>Billed Qty</th>
              <th style={{ textAlign: 'right', width: '120px' }}>Unit Price (₹)</th>
              <th style={{ textAlign: 'right', width: '120px' }}>Line Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((it, idx) => (
                <tr key={it.id || idx}>
                  <td>{idx + 1}</td>
                  <td>
                    <strong>{it.medicine_name}</strong>
                    {it.generic_name && (
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        Gen: {it.generic_name}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>{it.unit || 'Unit'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{it.quantity}</td>
                  <td style={{ textAlign: 'right' }}>₹{Number(it.unit_price).toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    ₹{Number(it.total_price).toFixed(2)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                  No itemized medicines found.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600 }}>
                Subtotal:
              </td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                ₹{Number(invoice.subtotal || totalAmount).toFixed(2)}
              </td>
            </tr>
            {Number(invoice.discount || 0) > 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'right', color: '#16a34a' }}>
                  Discount:
                </td>
                <td style={{ textAlign: 'right', color: '#16a34a' }}>
                  -₹{Number(invoice.discount).toFixed(2)}
                </td>
              </tr>
            )}
            {Number(invoice.tax || 0) > 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'right' }}>
                  GST / Taxes:
                </td>
                <td style={{ textAlign: 'right' }}>
                  +₹{Number(invoice.tax).toFixed(2)}
                </td>
              </tr>
            )}
            <tr style={{ background: '#f8fafc', fontSize: '1.05rem' }}>
              <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700 }}>
                Total Payable:
              </td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>
                ₹{totalAmount.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                Amount Paid:
              </td>
              <td style={{ textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                ₹{amountPaid.toFixed(2)}
              </td>
            </tr>
            {balanceDue > 0 && (
              <tr style={{ color: '#dc2626' }}>
                <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700 }}>
                  Balance Due:
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                  ₹{balanceDue.toFixed(2)}
                </td>
              </tr>
            )}
          </tfoot>
        </table>

        {/* Payment Transaction History */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a', marginBottom: '6px' }}>
            Payment Transaction History:
          </div>
          {payments.length > 0 ? (
            <table className="receipt-payments-table">
              <thead>
                <tr>
                  <th>Payment Date & Time</th>
                  <th>Payment Mode</th>
                  <th>Transaction ID / UTR</th>
                  <th style={{ textAlign: 'right', width: '130px' }}>Amount Paid (₹)</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, idx) => (
                  <tr key={p.id || idx}>
                    <td>
                      {formatDate(p.payment_date)} {formatTime(p.payment_date)}
                    </td>
                    <td>
                      <strong>{p.payment_method}</strong>
                    </td>
                    <td>{p.transaction_id || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      ₹{Number(p.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div
              style={{
                fontSize: '0.82rem',
                color: '#64748b',
                fontStyle: 'italic',
                padding: '8px 12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '4px'
              }}
            >
              No payment recorded yet. Payment required prior to medicine release.
            </div>
          )}
        </div>

        {/* Footer Notes & Signatures */}
        <div className="receipt-footer-notes">
          <div>
            <div>• Computer-generated pharmacy tax invoice & receipt; valid without manual signature.</div>
            <div>• Please verify all medicines and dosages with the pharmacist before leaving the counter.</div>
            <div>• In case of partial purchase, remaining quantities may be purchased later against the original Rx.</div>
            <div style={{ marginTop: '4px', fontSize: '0.74rem', color: '#94a3b8' }}>
              Printed on: {new Date().toLocaleString()}
            </div>
          </div>
          <div>
            <div className="receipt-signature-line">Registered Pharmacist</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PharmacyReceipt;
