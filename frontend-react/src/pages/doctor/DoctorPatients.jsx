import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import doctorService from '../../services/doctorService';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/formatters';

// Pure helper functions
const calculateAge = (dobString) => {
  if (!dobString) return null;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
};

const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const DoctorPatients = () => {
  const navigate = useNavigate();

  // Data state
  const [patients, setPatients] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search and Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [activeQuery, setActiveQuery] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Unscheduled Consultation Modal State
  const [unscheduledModal, setUnscheduledModal] = useState({
    isOpen: false,
    patient: null,
    visitReason: '',
    submitting: false,
    error: null
  });

  // Load patients and today's appointments for active token resolution
  const loadData = useCallback(async (query = '') => {
    setLoading(true);
    setError(null);
    try {
      const todayStr = getTodayDateString();
      const [patientsRes, apptsRes] = await Promise.all([
        doctorService.getPatients(query),
        doctorService.getAppointments({ date: todayStr }).catch(() => [])
      ]);
      setPatients(Array.isArray(patientsRes) ? patientsRes : []);
      setTodayAppointments(Array.isArray(apptsRes) ? apptsRes : []);
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to load clinic patient directory:', err);
      setError(err.message || 'Could not load patient records from backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(activeQuery);
  }, [loadData, activeQuery]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setActiveQuery(searchTerm.trim());
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setActiveQuery('');
  };

  // Check appointment/token status for a patient today
  const getPatientTodayStatus = useCallback((patient) => {
    if (!patient) return null;
    const patientNumericId = patient.id;
    const patientCode = patient.patient_id;

    // Find any appointment for this patient today
    const appts = todayAppointments.filter((a) => {
      const aPid = a.patient?.id || a.patient;
      const aCode = a.patient_id || a.patient?.patient_id;
      return (
        String(aPid) === String(patientNumericId) ||
        (patientCode && String(aCode) === String(patientCode))
      );
    });

    if (appts.length === 0) {
      return { type: 'NO_APPOINTMENT', label: 'No Token Today', appointment: null };
    }

    // Check if completed today
    const completedAppt = appts.find((a) => a.status === 'COMPLETED');
    if (completedAppt) {
      return { type: 'COMPLETED', label: 'Consulted Today', appointment: completedAppt };
    }

    // Check for appointment with genuinely issued, non-cancelled token
    const apptWithToken = appts.find(
      (a) =>
        ['CONFIRMED', 'BOOKED', 'SCHEDULED', 'IN_CONSULTATION'].includes(a.status) &&
        a.token_number &&
        a.token_status !== 'CANCELLED'
    );
    if (apptWithToken) {
      return {
        type: 'ACTIVE_TOKEN',
        label: `Token #${apptWithToken.token_number}`,
        tokenNumber: apptWithToken.token_number,
        appointment: apptWithToken
      };
    }

    // Appointment exists today, but NO token has been issued yet by reception
    const pendingTokenAppt = appts.find(
      (a) => ['CONFIRMED', 'BOOKED', 'SCHEDULED', 'IN_CONSULTATION'].includes(a.status)
    );
    if (pendingTokenAppt) {
      return {
        type: 'APPOINTMENT_AWAITING_TOKEN',
        label: `Appt #${pendingTokenAppt.id} (Awaiting Token)`,
        appointment: pendingTokenAppt
      };
    }

    // Cancelled or No-show
    const otherAppt = appts[0];
    return { type: 'INACTIVE', label: otherAppt.status, appointment: otherAppt };
  }, [todayAppointments]);

  // Open unscheduled consultation confirmation modal
  const handleOpenUnscheduledModal = (patient, pendingAppt = null) => {
    setUnscheduledModal({
      isOpen: true,
      patient,
      pendingAppt,
      visitReason: '',
      submitting: false,
      error: null
    });
  };

  // Submit start unscheduled consultation
  const handleConfirmUnscheduled = async (e) => {
    e.preventDefault();
    if (!unscheduledModal.patient) return;

    setUnscheduledModal((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      const res = await doctorService.startUnscheduledConsultation({
        patient: unscheduledModal.patient.id,
        visit_reason: unscheduledModal.visitReason.trim()
      });

      // Close modal and navigate directly to consultation recording page
      setUnscheduledModal({ isOpen: false, patient: null, pendingAppt: null, visitReason: '', submitting: false, error: null });
      navigate(`/doctor/consultations?consultation=${res.id}`);
    } catch (err) {
      console.error('Failed to start unscheduled consultation:', err);
      const data = err?.data || err?.response?.data;
      let errMsg = err?.message || 'Failed to initiate unscheduled consultation.';
      if (data) {
        if (typeof data === 'string') errMsg = data;
        else if (data.detail) errMsg = data.detail;
        else if (data.message) errMsg = data.message;
        else {
          const fieldMsgs = Object.entries(data).map(
            ([f, m]) => `${f}: ${Array.isArray(m) ? m.join(' ') : String(m)}`
          );
          if (fieldMsgs.length > 0) errMsg = fieldMsgs.join(' | ');
        }
      }
      setUnscheduledModal((prev) => ({ ...prev, submitting: false, error: errMsg }));
    }
  };

  // Pagination calculations
  const totalItems = patients.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return patients.slice(start, start + pageSize);
  }, [patients, currentPage, pageSize]);

  const columns = [
    {
      header: 'Patient ID',
      key: 'patient_id',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
          {row.patient_id || `#${row.id}`}
        </span>
      )
    },
    {
      header: 'Full Name',
      key: 'first_name',
      render: (row) => {
        const age = calculateAge(row.date_of_birth);
        return (
          <div>
            <span
              style={{
                fontWeight: 600,
                color: 'var(--text-main)',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
              onClick={() => navigate(`/doctor/patients/${row.id}`)}
              title="View full medical dossier"
            >
              {row.first_name} {row.last_name}
            </span>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {row.gender || '—'} {age !== null ? `• ${age} yrs` : ''} • DOB: {formatDate(row.date_of_birth)}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Contact Phone',
      key: 'phone',
      render: (row) => <span>{row.phone || '—'}</span>
    },
    {
      header: 'Blood Group',
      key: 'blood_group',
      render: (row) => (
        <span
          style={{
            fontWeight: 600,
            color: '#b91c1c',
            background: '#fee2e2',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '0.8rem'
          }}
        >
          {row.blood_group || 'Unknown'}
        </span>
      )
    },
    {
      header: "Today's Queue / Status",
      key: 'today_status',
      render: (row) => {
        const status = getPatientTodayStatus(row);
        if (status?.type === 'ACTIVE_TOKEN') {
          return (
            <span
              className="badge"
              style={{
                background: '#dcfce7',
                color: '#15803d',
                border: '1px solid #bbf7d0',
                fontSize: '0.78rem'
              }}
              title="Patient has an active appointment and queue token issued at reception"
            >
              🎫 {status.label}
            </span>
          );
        }
        if (status?.type === 'APPOINTMENT_AWAITING_TOKEN') {
          return (
            <span
              className="badge"
              style={{
                background: '#fffbeb',
                color: '#b45309',
                border: '1px solid #fde68a',
                fontSize: '0.78rem'
              }}
              title="Appointment scheduled today, but queue token not issued yet at reception"
            >
              ⏳ {status.label}
            </span>
          );
        }
        if (status?.type === 'COMPLETED') {
          return (
            <span
              className="badge"
              style={{ background: '#e2e8f0', color: '#475569', fontSize: '0.78rem' }}
            >
              ✓ Consulted Today
            </span>
          );
        }
        return (
          <span
            className="badge"
            style={{
              background: '#f8fafc',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              fontSize: '0.78rem'
            }}
            title="No token issued today — eligible for unscheduled direct consultation"
          >
            No Queue Token
          </span>
        );
      }
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => {
        const status = getPatientTodayStatus(row);
        const hasToken = status?.type === 'ACTIVE_TOKEN';
        const isCompleted = status?.type === 'COMPLETED';

        return (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => navigate(`/doctor/patients/${row.id}`)}
              title="View full medical dossier, prior consults, and vitals"
            >
              View Details ↗
            </button>

            {hasToken ? (
              // Workflow A: Token-Based Consultation (only when valid token genuinely exists)
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate(`/doctor/consultations?appointment=${status.appointment.id}`)}
                title={`Start token-based consultation (${status.label})`}
              >
                🎫 Start Consultation
              </button>
            ) : isCompleted ? (
              // Already completed consultation today
              <button
                className="btn btn-outline btn-sm"
                disabled
                title="Consultation already completed for this patient today"
              >
                ✓ Consulted
              </button>
            ) : (
              // Workflow B: Unscheduled Tokenless Consultation
              <button
                className="btn btn-sm"
                style={{
                  background: '#f59e0b',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 500
                }}
                onClick={() =>
                  handleOpenUnscheduledModal(
                    row,
                    status?.type === 'APPOINTMENT_AWAITING_TOKEN' ? status.appointment : null
                  )
                }
                title={
                  status?.type === 'APPOINTMENT_AWAITING_TOKEN'
                    ? 'Patient has an appointment but no queue token yet. Click to start unscheduled consultation.'
                    : 'Start unscheduled consultation directly without a queue token'
                }
              >
                ⚡ Start Unscheduled
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
          <h1 className="page-title">Registered Patients</h1>
          <p className="page-subtitle">
            Search registered clinic patients, view medical dossiers, and initiate token-based or unscheduled consultations.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Error:</strong> {error}
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => loadData(activeQuery)}>
            Retry
          </button>
        </div>
      )}

      {/* Search Toolbar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <form onSubmit={handleSearchSubmit} className="filter-toolbar" style={{ margin: 0, display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', flex: '1 1 340px', maxWidth: '520px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by Patient ID, Name, or Phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              Search
            </button>
            {(searchTerm || activeQuery) && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleClearSearch}
              >
                Clear
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => loadData(activeQuery)}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh List'}
          </button>
        </form>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={paginatedPatients}
        loading={loading}
        emptyMessage={
          activeQuery
            ? `No registered patients matching "${activeQuery}". Try searching by patient ID, name, or phone number.`
            : 'No registered patients found in clinic records.'
        }
      />

      {/* Pagination Controls */}
      {!loading && totalItems > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '16px',
            padding: '12px 16px',
            background: 'var(--surface, #fff)',
            borderRadius: 'var(--radius-sm, 6px)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            fontSize: '0.88rem'
          }}
        >
          <div style={{ color: 'var(--text-muted, #64748b)' }}>
            Showing {Math.min((currentPage - 1) * pageSize + 1, totalItems)} to{' '}
            {Math.min(currentPage * pageSize, totalItems)} of {totalItems} registered patients
            {activeQuery ? ` (filtered from all records)` : ''}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="btn btn-outline btn-sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            >
              Previous
            </button>
            <span style={{ padding: '0 8px', fontWeight: 600 }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="btn btn-outline btn-sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Unscheduled Consultation Confirmation Modal */}
      <Modal
        isOpen={unscheduledModal.isOpen}
        onClose={() =>
          !unscheduledModal.submitting &&
          setUnscheduledModal({ isOpen: false, patient: null, visitReason: '', submitting: false, error: null })
        }
        title="Start Unscheduled Consultation"
      >
        <form onSubmit={handleConfirmUnscheduled}>
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '6px',
              padding: '14px',
              marginBottom: '16px',
              color: '#92400e',
              fontSize: '0.9rem',
              lineHeight: '1.5'
            }}
          >
            <strong>⚡ Workflow B: Unscheduled (Tokenless) Consultation</strong>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem' }}>
              Patient <strong>{unscheduledModal.patient?.first_name} {unscheduledModal.patient?.last_name}</strong> has no queue token or appointment scheduled for today. Starting this consultation will record a tokenless clinical visit and automatically generate a pending consultation invoice.
            </p>
          </div>

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              borderRadius: '6px',
              padding: '12px 14px',
              marginBottom: '16px',
              fontSize: '0.88rem'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Patient ID:</span>{' '}
                <strong>{unscheduledModal.patient?.patient_id || `#${unscheduledModal.patient?.id}`}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Phone:</span>{' '}
                <strong>{unscheduledModal.patient?.phone || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Gender:</span>{' '}
                <strong>{unscheduledModal.patient?.gender || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Blood Group:</span>{' '}
                <strong>{unscheduledModal.patient?.blood_group || '—'}</strong>
              </div>
            </div>
          </div>

          {unscheduledModal.error && (
            <div className="alert alert-danger" style={{ marginBottom: '14px', fontSize: '0.88rem' }}>
              {unscheduledModal.error}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>
              Visit Reason / Chief Complaint <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
            </label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="e.g. Walk-in emergency visit, severe headache and high fever for 2 days..."
              value={unscheduledModal.visitReason}
              onChange={(e) =>
                setUnscheduledModal((prev) => ({ ...prev, visitReason: e.target.value }))
              }
              disabled={unscheduledModal.submitting}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline"
              disabled={unscheduledModal.submitting}
              onClick={() =>
                setUnscheduledModal({ isOpen: false, patient: null, visitReason: '', submitting: false, error: null })
              }
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={unscheduledModal.submitting}
              style={{ minWidth: '150px' }}
            >
              {unscheduledModal.submitting ? 'Initiating...' : 'Confirm & Start 🩺'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DoctorPatients;
