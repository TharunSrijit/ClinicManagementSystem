import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import receptionistService from '../../services/receptionistService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import { formatDate, formatTime } from '../../utils/formatters';

const extractErrorMessage = (err, fallback = 'Operation failed.') => {
  const data = err?.data || err?.response?.data;
  if (!data) return err?.message || fallback;
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  if (data.message) return data.message;
  if (typeof data === 'object') {
    const fieldMsgs = Object.entries(data).map(
      ([field, msg]) => `${field}: ${Array.isArray(msg) ? msg.join(' ') : String(msg)}`
    );
    if (fieldMsgs.length > 0) return fieldMsgs.join(' | ');
  }
  return err?.message || fallback;
};

export const ReceptionistAppointmentsPage = () => {
  const navigate = useNavigate();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  // Payment Modal State
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedApptForPay, setSelectedApptForPay] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionId, setTransactionId] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 6000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [appts, docs] = await Promise.all([
        receptionistService.getAppointments(
          selectedDate || null,
          selectedDoctor || null,
          selectedStatus === 'ALL' ? null : selectedStatus
        ).catch(() => []),
        receptionistService.getDoctors().catch(() => [])
      ]);
      setAppointments(Array.isArray(appts) ? appts : []);
      setDoctors(Array.isArray(docs) ? docs : []);
    } catch (err) {
      console.error('Failed to load appointments:', err);
      showFeedback('Could not load appointments from server.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedDoctor, selectedStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConfirmArrival = async (apptId) => {
    setActionLoading(apptId);
    try {
      const res = await receptionistService.confirmArrival(apptId);
      showFeedback(res.detail || 'Patient arrival confirmed! Eligible for consultation fee payment.');
      await loadData();
    } catch (err) {
      console.error('Arrival confirmation error:', err);
      showFeedback(`Arrival confirmation failed: ${extractErrorMessage(err)}`, 'danger');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenPayModal = (appt) => {
    setSelectedApptForPay(appt);
    setPaymentMethod('CASH');
    setTransactionId('');
    setPayModalOpen(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedApptForPay) return;

    setSubmittingPayment(true);
    try {
      const res = await receptionistService.collectFee(selectedApptForPay.id, {
        payment_method: paymentMethod,
        transaction_id: transactionId.trim() || undefined
      });
      showFeedback(res.detail || 'Consultation fee recorded as PAID! Queue token can now be issued.');
      setPayModalOpen(false);
      setSelectedApptForPay(null);
      await loadData();
    } catch (err) {
      console.error('Payment collection error:', err);
      showFeedback(`Payment collection failed: ${extractErrorMessage(err)}`, 'danger');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleIssueToken = async (apptId) => {
    setActionLoading(apptId);
    try {
      const res = await receptionistService.issueToken(apptId);
      const tokenNum = res.token?.token_number || res.token_number;
      showFeedback(res.detail || `Token #${tokenNum} issued successfully!`);
      await loadData();
    } catch (err) {
      console.error('Token issuance error:', err);
      showFeedback(`Token issuance failed: ${extractErrorMessage(err)}`, 'danger');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (apptId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    setActionLoading(apptId);
    try {
      await receptionistService.cancelAppointment(apptId);
      showFeedback('Appointment cancelled successfully.', 'info');
      await loadData();
    } catch (err) {
      console.error('Cancellation error:', err);
      showFeedback(`Cancellation failed: ${extractErrorMessage(err)}`, 'danger');
    } finally {
      setActionLoading(null);
    }
  };

  const columns = [
    {
      header: 'Appt / Token',
      key: 'id',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>Appt #{row.id}</div>
          {row.token_number ? (
            <span
              style={{
                display: 'inline-block',
                marginTop: '4px',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--primary)',
                background: 'var(--primary-light, #e0f2fe)',
                padding: '2px 8px',
                borderRadius: '4px'
              }}
              title={`Queue Token #${row.token_number} (${row.token_status || 'WAITING'})`}
            >
              Token #{row.token_number}
            </span>
          ) : row.status === 'CONFIRMED' ? (
            row.is_paid ? (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: '4px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#065f46',
                  background: '#d1fae5',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}
                title="Arrival confirmed & fee paid; ready for token issuance"
              >
                ✓ Ready for Token
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: '4px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#b45309',
                  background: '#fef3c7',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}
                title="Arrival confirmed; awaiting consultation fee payment"
              >
                Awaiting Fee
              </span>
            )
          ) : (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              No Token
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Time & Date',
      key: 'appointment_time',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{formatTime(row.appointment_time)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDate(row.appointment_date)}</div>
        </div>
      )
    },
    {
      header: 'Patient',
      key: 'patient_name',
      render: (row) => (
        <div>
          <Link
            to={`/receptionist/patients/${row.patient}`}
            style={{ fontWeight: 600, color: 'var(--primary)' }}
          >
            {row.patient_name || `Patient #${row.patient}`}
          </Link>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {row.patient_phone || row.patient_uhid || ''}
          </div>
        </div>
      )
    },
    {
      header: 'Doctor',
      key: 'doctor_name',
      render: (row) => <span>{row.doctor_name || `Dr. #${row.doctor}`}</span>
    },
    {
      header: 'Type',
      key: 'appointment_type',
      render: (row) => (
        <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>
          {row.appointment_type === 'WALK_IN' ? 'Walk-In' : 'Advance'}
        </span>
      )
    },
    {
      header: 'Arrival Status',
      key: 'status',
      render: (row) => {
        if (row.status === 'CONFIRMED') {
          return (
            <span
              style={{
                display: 'inline-block',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#065f46',
                background: '#d1fae5',
                padding: '2px 8px',
                borderRadius: '4px'
              }}
            >
              Arrived
            </span>
          );
        }
        return <Badge status={row.status} />;
      }
    },
    {
      header: 'Fee & Payment',
      key: 'is_paid',
      render: (row) => {
        const fee = Number(row.consultation_fee || 0).toFixed(2);
        if (row.status === 'CANCELLED') {
          return <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</span>;
        }

        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>₹{fee}</div>
            {row.is_paid ? (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: '2px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#065f46',
                  background: '#d1fae5',
                  padding: '1px 6px',
                  borderRadius: '3px'
                }}
              >
                Paid
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: '2px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#b45309',
                  background: '#fef3c7',
                  padding: '1px 6px',
                  borderRadius: '3px'
                }}
              >
                Unpaid
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => {
        const isToday = row.appointment_date === todayStr;
        const isLoading = actionLoading === row.id;

        if (row.status === 'COMPLETED') {
          return <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.82rem' }}>✓ Consulted</span>;
        }
        if (row.status === 'CANCELLED') {
          return <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Cancelled</span>;
        }

        return (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* 1. ADVANCE APPOINTMENT: Confirm Arrival (only when BOOKED and for today) */}
            {row.appointment_type === 'ADVANCE' && isToday && row.status === 'BOOKED' && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => handleConfirmArrival(row.id)}
                disabled={isLoading}
                title="Confirm advance appointment arrival"
              >
                {isLoading ? 'Confirming...' : 'Confirm Arrival'}
              </button>
            )}

            {/* 2. PAYMENT: Show Collect Fee once arrived (CONFIRMED) but not yet paid */}
            {row.status === 'CONFIRMED' && !row.is_paid && (
              <button
                className="btn btn-primary btn-sm"
                style={{ background: '#d97706', borderColor: '#d97706' }}
                onClick={() => handleOpenPayModal(row)}
                disabled={isLoading}
                title="Collect consultation fee"
              >
                Collect Fee
              </button>
            )}

            {/* 3. TOKEN: Show Issue Token ONLY when ARRIVED (CONFIRMED) AND PAID, exactly once */}
            {row.status === 'CONFIRMED' && row.is_paid && !row.token_number && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleIssueToken(row.id)}
                disabled={isLoading}
                title="Issue next queue token (fee paid)"
              >
                {isLoading ? 'Issuing...' : 'Issue Token'}
              </button>
            )}

            {/* 4. Cancel action if not completed */}
            {['BOOKED', 'CONFIRMED'].includes(row.status) && (
              <button
                className="btn btn-outline btn-sm"
                style={{ color: 'var(--danger)', borderColor: 'var(--border-subtle)' }}
                onClick={() => handleCancel(row.id)}
                disabled={isLoading}
                title="Cancel appointment"
              >
                Cancel
              </button>
            )}

            {/* Future advance appointments */}
            {!isToday && row.status === 'BOOKED' && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Arrives on appt date
              </span>
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
          <h1 className="page-title">Appointments Directory</h1>
          <p className="page-subtitle">Manage clinic appointments, confirm arrival, collect consultation fees, and issue queue tokens.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/receptionist/appointments/book')}
        >
          + Book New Appointment
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>
          {feedback.message}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div className="filter-toolbar" style={{ margin: 0 }}>
          <div className="filter-group">
            <div>
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-control"
                style={{ width: '160px' }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label">Doctor</label>
              <select
                className="form-select"
                style={{ width: '200px' }}
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
              >
                <option value="">All Doctors</option>
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.full_name || `Dr. ${doc.user?.first_name || ''} ${doc.user?.last_name || ''}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Status</label>
              <select
                className="form-select"
                style={{ width: '180px' }}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="BOOKED">Booked (Awaiting Arrival)</option>
                <option value="CONFIRMED">Confirmed (Arrived)</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSelectedDate(todayStr);
                setSelectedDoctor('');
                setSelectedStatus('ALL');
              }}
            >
              Today's Appts
            </button>
            <button className="btn btn-outline btn-sm" onClick={loadData}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={appointments}
        loading={loading}
        emptyMessage="No appointments found for the selected filters."
      />

      {/* Collect Consultation Fee Modal */}
      <Modal
        isOpen={payModalOpen}
        onClose={() => !submittingPayment && setPayModalOpen(false)}
        title="Collect Consultation Fee"
      >
        {selectedApptForPay && (
          <form onSubmit={handleRecordPayment}>
            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-main)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Patient:</span>
                <strong>{selectedApptForPay.patient_name || `Patient #${selectedApptForPay.patient}`}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Doctor:</span>
                <strong>{selectedApptForPay.doctor_name || `Dr. #${selectedApptForPay.doctor}`}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Type:</span>
                <span>{selectedApptForPay.appointment_type === 'WALK_IN' ? 'Walk-In' : 'Advance'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', fontSize: '1.05rem' }}>
                <span style={{ fontWeight: 600 }}>Total Fee Payable:</span>
                <strong style={{ color: 'var(--primary)' }}>
                  ₹{Number(selectedApptForPay.total_amount != null ? selectedApptForPay.total_amount : selectedApptForPay.consultation_fee || 0).toFixed(2)}
                </strong>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Payment Method</label>
              <select
                className="form-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={submittingPayment}
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI / QR</option>
                <option value="CARD">Credit / Debit Card</option>
                <option value="ONLINE">Online Transfer</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Transaction Reference (Optional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. UPI Ref / Card Auth Code"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                disabled={submittingPayment}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setPayModalOpen(false)}
                disabled={submittingPayment}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingPayment}
              >
                {submittingPayment ? 'Recording...' : `Record Payment (₹${Number(selectedApptForPay.total_amount != null ? selectedApptForPay.total_amount : selectedApptForPay.consultation_fee || 0).toFixed(2)})`}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default ReceptionistAppointmentsPage;
