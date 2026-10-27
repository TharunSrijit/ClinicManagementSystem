import React from 'react';
import { Hospital } from 'lucide-react';
import { formatDate, formatTime } from '../utils/formatters';

export const ConsultationReceipt = ({ invoice }) => {
  if (!invoice) return null;

  const regFee = Number(invoice.registration_fee || 0);
  const consultFee = Number(invoice.consultation_fee || 0);
  const totalAmount = Number(invoice.total_amount || 0);
  const amountPaid = Number(invoice.amount_paid || 0);
  const balanceDue = Number(
    invoice.balance_due != null ? invoice.balance_due : Math.max(0, totalAmount - amountPaid)
  );

  const clinicName = invoice.clinic_info?.clinic_name || invoice.clinic_info?.name || 'Clinic Management System';
  const clinicAddress = invoice.clinic_info?.clinic_address || invoice.clinic_info?.address || '';
  const clinicPhone = invoice.clinic_info?.clinic_phone || invoice.clinic_info?.phone || '';
  const clinicEmail = invoice.clinic_info?.clinic_email || invoice.clinic_info?.email || '';

  const docTitle = invoice.status === 'PAID' ? 'TAX INVOICE & RECEIPT' : 'BILLING STATEMENT';

  return (
    <div className="receipt-card">
      {/* Clinic Header */}
      <div className="receipt-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Hospital size={24} strokeWidth={2} color="var(--primary)" />
            <h2 className="receipt-clinic-title">{clinicName}</h2>
          </div>
          {clinicAddress && <p className="receipt-clinic-sub">{clinicAddress}</p>}
          {(clinicPhone || clinicEmail) && (
            <p className="receipt-clinic-sub">
              {clinicPhone && `Phone: ${clinicPhone}`}
              {clinicPhone && clinicEmail && ' | '}
              {clinicEmail && `Email: ${clinicEmail}`}
            </p>
          )}
        </div>
        <div className="receipt-doc-title">
          <div className="receipt-doc-name">{docTitle}</div>
          <div>
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
            <span className="receipt-meta-label">Invoice No:</span>
            <span className="receipt-meta-value">{invoice.invoice_number || `#${invoice.id}`}</span>
          </div>
          <div className="receipt-meta-item">
            <span className="receipt-meta-label">Invoice Date:</span>
            <span className="receipt-meta-value">
              {formatDate(invoice.appointment_date || invoice.created_at)}
            </span>
          </div>
          <div className="receipt-meta-item">
            <span className="receipt-meta-label">
              {invoice.appointment ? 'Appointment Ref:' : 'Consultation Ref:'}
            </span>
            <span className="receipt-meta-value">
              {invoice.appointment
                ? `Appt #${invoice.appointment}${invoice.appointment_time ? ` (${invoice.appointment_time})` : ''}`
                : `Consultation #${invoice.consultation || 'Direct'}`}
            </span>
          </div>
          <div className="receipt-meta-item">
            <span className="receipt-meta-label">Consulting Doctor:</span>
            <span className="receipt-meta-value">
              {invoice.doctor_name || '—'}
              {invoice.doctor_specialization && ` (${invoice.doctor_specialization})`}
            </span>
          </div>
        </div>

        <div>
          <div className="receipt-meta-item">
            <span className="receipt-meta-label">Patient ID:</span>
            <span className="receipt-meta-value">{invoice.patient_id || `P-${invoice.patient}`}</span>
          </div>
          <div className="receipt-meta-item">
            <span className="receipt-meta-label">Patient Name:</span>
            <span className="receipt-meta-value">{invoice.patient_name || '—'}</span>
          </div>
          <div className="receipt-meta-item">
            <span className="receipt-meta-label">Contact Phone:</span>
            <span className="receipt-meta-value">{invoice.patient_phone || '—'}</span>
          </div>
          <div className="receipt-meta-item">
            <span className="receipt-meta-label">Gender:</span>
            <span className="receipt-meta-value">{invoice.patient_gender || '—'}</span>
          </div>
        </div>
      </div>

      {/* Itemized Services Table */}
      <table className="receipt-table">
        <thead>
          <tr>
            <th style={{ width: '40px' }}>#</th>
            <th>Service / Item Description</th>
            <th>Category</th>
            <th style={{ textAlign: 'right', width: '130px' }}>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {regFee > 0 && (
            <tr>
              <td>1</td>
              <td>
                <strong>Patient Registration Fee</strong>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  One-time registration and patient file creation
                </div>
              </td>
              <td>Administrative</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{regFee.toFixed(2)}</td>
            </tr>
          )}
          <tr>
            <td>{regFee > 0 ? 2 : 1}</td>
            <td>
              <strong>Doctor Consultation Fee</strong>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Outpatient consultation ({invoice.doctor_specialization || 'General Clinical'})
              </div>
            </td>
            <td>Clinical</td>
            <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{consultFee.toFixed(2)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="receipt-table-totals">
            <td colSpan="3" style={{ textAlign: 'right', fontWeight: 600, color: '#64748b' }}>
              Subtotal:
            </td>
            <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{totalAmount.toFixed(2)}</td>
          </tr>
          <tr className="receipt-table-totals grand-total">
            <td colSpan="3" style={{ textAlign: 'right' }}>
              Total Invoice Amount:
            </td>
            <td style={{ textAlign: 'right' }}>₹{totalAmount.toFixed(2)}</td>
          </tr>
          <tr className="receipt-table-totals">
            <td colSpan="3" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success, #16a34a)' }}>
              Total Amount Paid:
            </td>
            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success, #16a34a)' }}>
              ₹{amountPaid.toFixed(2)}
            </td>
          </tr>
          <tr className="receipt-table-totals">
            <td
              colSpan="3"
              style={{
                textAlign: 'right',
                fontWeight: 700,
                color: balanceDue > 0 ? '#b91c1c' : '#64748b'
              }}
            >
              Outstanding Balance:
            </td>
            <td
              style={{
                textAlign: 'right',
                fontWeight: 700,
                color: balanceDue > 0 ? '#b91c1c' : '#64748b'
              }}
            >
              ₹{balanceDue.toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Payment Transaction History */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a', marginBottom: '6px' }}>
          Payment Transaction History:
        </div>
        {invoice.payments && invoice.payments.length > 0 ? (
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
              {invoice.payments.map((p, idx) => (
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
            No payment has been recorded for this invoice yet. Outstanding balance is due upon consultation.
          </div>
        )}
      </div>

      {/* Footer Notes & Signatures */}
      <div className="receipt-footer-notes">
        <div>
          <div>• Computer-generated tax invoice & receipt; valid without manual signature.</div>
          <div>• Please keep this receipt for future reference, test investigations, and follow-up visits.</div>
          <div style={{ marginTop: '4px', fontSize: '0.74rem', color: '#94a3b8' }}>
            Printed on: {new Date().toLocaleString()}
          </div>
        </div>
        <div>
          <div className="receipt-signature-line">Authorized Reception Desk</div>
        </div>
      </div>
    </div>
  );
};

export default ConsultationReceipt;
