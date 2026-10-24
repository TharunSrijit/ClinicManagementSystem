import React, { useState, useEffect, useCallback, useMemo } from 'react';
import receptionistService from '../../services/receptionistService';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { formatDate, formatTime, formatCurrency } from '../../utils/formatters';

export const ReceptionistDashboard = () => {
  // Navigation Tabs: 'appointments' | 'queue' | 'patients' | 'billing'
  const [activeTab, setActiveTab] = useState('appointments');

  // Core Data States
  const [appointments, setAppointments] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [patientSearch, setPatientSearch] = useState('');
  const [filterDoctor, setFilterDoctor] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Booking Modal States
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [bookingType, setBookingType] = useState('WALK_IN'); // 'WALK_IN' or 'ADVANCE'
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [visitCategory, setVisitCategory] = useState('CONSULTATION');
  const [reason, setReason] = useState('General medical checkup');
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // Patient Registration Modal States
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [submittingPatient, setSubmittingPatient] = useState(false);
  const [patientForm, setPatientForm] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '1995-05-15',
    gender: 'MALE',
    blood_group: 'B+',
    phone: '',
    email: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: ''
  });

  // Billing / Payment Modal States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Action status message
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [apptsData, tokensData, patientsData, doctorsData, invoicesData] = await Promise.all([
        receptionistService.getAppointments().catch(() => []),
        receptionistService.getTokens().catch(() => []),
        receptionistService.getPatients().catch(() => []),
        receptionistService.getDoctors().catch(() => []),
        receptionistService.getConsultationInvoices().catch(() => [])
      ]);
      setAppointments(Array.isArray(apptsData) ? apptsData : []);
      setTokens(Array.isArray(tokensData) ? tokensData : []);
      setPatients(Array.isArray(patientsData) ? patientsData : []);
      setDoctors(Array.isArray(doctorsData) ? doctorsData : []);
      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
    } catch (err) {
      console.error('Failed to load receptionist data:', err);
      showFeedback('Failed to load clinic records from server.', 'danger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Handle Workflow Switching (Walk-in vs Advance)
  const handleWorkflowChange = (type) => {
    setBookingType(type);
    setSelectedSlot('');
    setSlotError('');
    const today = new Date();
    if (type === 'WALK_IN') {
      setBookingDate(today.toISOString().split('T')[0]);
    } else {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      setBookingDate(tomorrow.toISOString().split('T')[0]);
    }
  };

  // Fetch Slots whenever Doctor, Type, or Date changes
  useEffect(() => {
    if (!selectedDoctorId || !bookingDate || !isBookModalOpen) {
      setAvailableSlots([]);
      return;
    }

    const fetchSlots = async () => {
      setLoadingSlots(true);
      setSlotError('');
      setSelectedSlot('');
      try {
        const slots = await receptionistService.getDoctorSlots(
          selectedDoctorId,
          bookingType,
          bookingDate
        );
        if (Array.isArray(slots)) {
          setAvailableSlots(slots);
        } else {
          setAvailableSlots([]);
        }
      } catch (err) {
        console.warn('Slot lookup warning:', err.message);
        setSlotError(err.message || 'Could not fetch available slots for this date/doctor.');
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [selectedDoctorId, bookingType, bookingDate, isBookModalOpen]);

  // Appointment Booking Submit
  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedDoctorId || !selectedSlot) {
      showFeedback('Please select patient, doctor, and an available slot.', 'danger');
      return;
    }

    setSubmittingBooking(true);
    try {
      await receptionistService.bookAppointment({
        patient: Number(selectedPatientId),
        doctor: Number(selectedDoctorId),
        appointment_type: bookingType,
        visit_category: visitCategory,
        appointment_date: bookingDate,
        appointment_time: selectedSlot,
        reason: reason || 'Routine visit'
      });
      setIsBookModalOpen(false);
      showFeedback(`Appointment booked successfully for ${formatDate(bookingDate)} at ${selectedSlot}.`);
      await loadAllData();
    } catch (err) {
      showFeedback(`Booking failed: ${err.message}`, 'danger');
    } finally {
      setSubmittingBooking(false);
    }
  };

  // Arrival Confirmation / Check-in
  const handleCheckIn = async (appointmentId) => {
    try {
      const res = await receptionistService.checkInAppointment(appointmentId);
      const tokenNum = res.token?.token_number ? `#${res.token.token_number}` : '';
      showFeedback(`Patient checked in! Queue token ${tokenNum} issued.`);
      await loadAllData();
    } catch (err) {
      showFeedback(`Check-in failed: ${err.message}`, 'danger');
    }
  };

  // Cancellation
  const handleCancel = async (appointmentId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      await receptionistService.cancelAppointment(appointmentId);
      showFeedback('Appointment has been cancelled.');
      await loadAllData();
    } catch (err) {
      showFeedback(`Cancellation failed: ${err.message}`, 'danger');
    }
  };

  // Patient Registration Submit
  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    setSubmittingPatient(true);
    try {
      const newPatient = await receptionistService.createPatient(patientForm);
      setIsPatientModalOpen(false);
      showFeedback(`Patient ${newPatient.first_name} ${newPatient.last_name} (${newPatient.patient_id || 'ID ' + newPatient.id}) registered successfully!`);
      // Reset form
      setPatientForm({
        first_name: '',
        last_name: '',
        date_of_birth: '1995-05-15',
        gender: 'MALE',
        blood_group: 'B+',
        phone: '',
        email: '',
        address: '',
        emergency_contact_name: '',
        emergency_contact_phone: ''
      });
      await loadAllData();
    } catch (err) {
      showFeedback(`Patient registration failed: ${err.message}`, 'danger');
    } finally {
      setSubmittingPatient(false);
    }
  };

  // Payment Submit
  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setSubmittingPayment(true);
    try {
      await receptionistService.createConsultationPayment({
        invoice: selectedInvoice.id,
        amount: selectedInvoice.total_amount || selectedInvoice.amount,
        payment_mode: paymentMethod,
        transaction_reference: `PAY-${Date.now()}`
      });
      setIsPaymentModalOpen(false);
      showFeedback(`Payment recorded for Invoice #${selectedInvoice.invoice_number || selectedInvoice.id}`);
      await loadAllData();
    } catch (err) {
      showFeedback(`Payment recording failed: ${err.message}`, 'danger');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Allowed Date Range Boundaries
  const { todayIso, tomorrowIso, maxAdvanceIso } = useMemo(() => {
    const today = new Date();
    const tIso = today.toISOString().split('T')[0];
    const tm = new Date(today);
    tm.setDate(tm.getDate() + 1);
    const tmIso = tm.toISOString().split('T')[0];
    const ma = new Date(today);
    ma.setDate(ma.getDate() + 7);
    const maIso = ma.toISOString().split('T')[0];
    return { todayIso: tIso, tomorrowIso: tmIso, maxAdvanceIso: maIso };
  }, []);

  // Filtering Appointments
  const filteredAppointments = appointments.filter((appt) => {
    if (filterDoctor && String(appt.doctor) !== String(filterDoctor)) return false;
    if (filterStatus !== 'ALL' && String(appt.status).toUpperCase() !== filterStatus) return false;
    return true;
  });

  // Table Columns
  const appointmentColumns = [
    {
      header: 'Appt ID',
      key: 'id',
      render: (r) => <span style={{ fontWeight: 600 }}>#{r.id}</span>
    },
    {
      header: 'Patient Details',
      key: 'patient_name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            {r.patient_name || `Patient #${r.patient}`}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Type: {r.appointment_type || 'STANDARD'}
          </div>
        </div>
      )
    },
    {
      header: 'Consulting Doctor',
      key: 'doctor_name',
      render: (r) => (
        <span style={{ fontWeight: 500 }}>
          {r.doctor_name || `Doctor #${r.doctor}`}
        </span>
      )
    },
    {
      header: 'Schedule',
      key: 'appointment_date',
      render: (r) => (
        <div>
          <div>{formatDate(r.appointment_date)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {formatTime(r.appointment_time)}
          </div>
        </div>
      )
    },
    {
      header: 'Status',
      key: 'status',
      render: (r) => <Badge status={r.status} />
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => {
        const isBooked = String(r.status).toUpperCase() === 'BOOKED';
        const isConfirmed = String(r.status).toUpperCase() === 'CONFIRMED';
        const isCancelable = !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(String(r.status).toUpperCase());

        return (
          <div style={{ display: 'flex', gap: '6px' }}>
            {isBooked && (
              <button
                className="btn btn-outline"
                style={{ padding: '4px 10px', fontSize: '0.78rem', borderColor: 'var(--success)', color: 'var(--success)' }}
                onClick={() => handleCheckIn(r.id)}
                title="Confirm patient arrival and allocate token"
              >
                ✓ Check-In
              </button>
            )}
            {isConfirmed && (
              <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>
                Arrived
              </span>
            )}
            {isCancelable && (
              <button
                className="btn btn-outline"
                style={{ padding: '4px 10px', fontSize: '0.78rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                onClick={() => handleCancel(r.id)}
              >
                Cancel
              </button>
            )}
          </div>
        );
      }
    }
  ];

  const tokenColumns = [
    {
      header: 'Token #',
      key: 'token_number',
      render: (t) => (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'var(--primary-light)',
          color: 'var(--primary-dark)',
          fontWeight: 700,
          fontSize: '0.95rem'
        }}>
          {t.token_number}
        </span>
      )
    },
    {
      header: 'Patient Name',
      key: 'patient_name',
      render: (t) => t.patient_name || t.appointment_details?.patient_name || `Patient #${t.patient || t.appointment}`
    },
    {
      header: 'Doctor',
      key: 'doctor_name',
      render: (t) => t.doctor_name || t.appointment_details?.doctor_name || '-'
    },
    {
      header: 'Date',
      key: 'token_date',
      render: (t) => formatDate(t.token_date)
    },
    {
      header: 'Queue Status',
      key: 'status',
      render: (t) => <Badge status={t.status || 'WAITING'} />
    }
  ];

  const patientColumns = [
    {
      header: 'ID / Code',
      key: 'patient_id',
      render: (p) => <span style={{ fontWeight: 600 }}>{p.patient_id || `#${p.id}`}</span>
    },
    {
      header: 'Name',
      key: 'full_name',
      render: (p) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            {p.first_name} {p.last_name}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {p.gender} • DOB: {p.date_of_birth}
          </div>
        </div>
      )
    },
    {
      header: 'Contact',
      key: 'phone',
      render: (p) => (
        <div>
          <div>📞 {p.phone || p.phone_number || '-'}</div>
          {p.email && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>✉️ {p.email}</div>}
        </div>
      )
    },
    {
      header: 'Blood Group',
      key: 'blood_group',
      render: (p) => <Badge variant="info">{p.blood_group || 'Unknown'}</Badge>
    },
    {
      header: 'Quick Action',
      key: 'action',
      render: (p) => (
        <button
          className="btn btn-outline"
          style={{ padding: '4px 10px', fontSize: '0.78rem' }}
          onClick={() => {
            setSelectedPatientId(p.id);
            setIsBookModalOpen(true);
          }}
        >
          📅 Book Visit
        </button>
      )
    }
  ];

  const invoiceColumns = [
    {
      header: 'Invoice #',
      key: 'invoice_number',
      render: (i) => <span style={{ fontWeight: 600 }}>{i.invoice_number || `#${i.id}`}</span>
    },
    {
      header: 'Patient',
      key: 'patient_name',
      render: (i) => i.patient_name || `Patient #${i.patient}`
    },
    {
      header: 'Total Amount',
      key: 'total_amount',
      render: (i) => <span style={{ fontWeight: 600 }}>{formatCurrency(i.total_amount || i.amount || 0)}</span>
    },
    {
      header: 'Status',
      key: 'status',
      render: (i) => <Badge status={i.status || (i.is_paid ? 'PAID' : 'PENDING')} />
    },
    {
      header: 'Action',
      key: 'action',
      render: (i) => {
        const isPaid = String(i.status || '').toUpperCase() === 'PAID' || i.is_paid;
        return (
          <div>
            {!isPaid ? (
              <button
                className="btn btn-primary"
                style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                onClick={() => {
                  setSelectedInvoice(i);
                  setIsPaymentModalOpen(true);
                }}
              >
                💳 Settle Bill
              </button>
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>
                Receipt Settled
              </span>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div>
      {/* Alert Feedback Banner */}
      {feedback.message && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '20px',
            background: feedback.type === 'danger' ? 'var(--danger-light)' : 'var(--success-light)',
            color: feedback.type === 'danger' ? 'var(--danger)' : 'var(--success)',
            border: `1px solid ${feedback.type === 'danger' ? '#fecaca' : '#bbf7d0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback({ message: '', type: '' })} style={{ fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reception & Patient Operations</h1>
          <p className="page-subtitle">Walk-in bookings, advance appointments, queue management, and billing desk.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setIsPatientModalOpen(true)} className="btn btn-outline">
            👤 New Patient
          </button>
          <button onClick={() => setIsBookModalOpen(true)} className="btn btn-primary">
            📅 Book Appointment
          </button>
          <button onClick={loadAllData} className="btn btn-outline" title="Refresh data">
            🔄
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid-stats">
        <StatCard
          title="Scheduled Visits"
          value={appointments.length}
          subtitle="All recorded bookings"
          icon="📅"
          color="primary"
        />
        <StatCard
          title="Active Tokens"
          value={tokens.filter(t => ['WAITING', 'IN_CONSULTATION'].includes(String(t.status).toUpperCase())).length}
          subtitle="Waiting in reception"
          icon="🎫"
          color="warning"
        />
        <StatCard
          title="Patients Registered"
          value={patients.length}
          subtitle="Active clinic members"
          icon="👥"
          color="info"
        />
        <StatCard
          title="Available Doctors"
          value={doctors.length}
          subtitle="Duty specialists"
          icon="🩺"
          color="success"
        />
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '24px', gap: '24px' }}>
        {[
          { key: 'appointments', label: `Appointments (${appointments.length})`, icon: '📅' },
          { key: 'queue', label: `Front Desk Queue (${tokens.length})`, icon: '🎫' },
          { key: 'patients', label: `Patients Directory (${patients.length})`, icon: '👤' },
          { key: 'billing', label: `Billing & Invoices (${invoices.length})`, icon: '🧾' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '12px 6px',
              fontSize: '0.95rem',
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.key ? '3px solid var(--primary)' : '3px solid transparent',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Appointments List */}
      {activeTab === 'appointments' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Scheduled Appointments</h2>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select
                value={filterDoctor}
                onChange={(e) => setFilterDoctor(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
              >
                <option value="">All Doctors</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.full_name || d.name || `Dr. #${d.id}`}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
              >
                <option value="ALL">All Statuses</option>
                <option value="BOOKED">Booked</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <DataTable
            columns={appointmentColumns}
            data={filteredAppointments}
            loading={loading}
            emptyMessage="No appointments matched the specified filter criteria."
          />
        </div>
      )}

      {/* Tab 2: Queue & Tokens */}
      {activeTab === 'queue' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Live Reception Queue</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tokens issued upon arrival confirmation for today's consultations.</p>
            </div>
          </div>

          <DataTable
            columns={tokenColumns}
            data={tokens}
            loading={loading}
            emptyMessage="No active tokens issued for today."
          />
        </div>
      )}

      {/* Tab 3: Patients Directory */}
      {activeTab === 'patients' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Patients Directory</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Search patient by name / phone..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.88rem',
                  minWidth: '240px'
                }}
              />
            </div>
          </div>

          <DataTable
            columns={patientColumns}
            data={patients.filter(p => {
              if (!patientSearch) return true;
              const q = patientSearch.toLowerCase();
              return (
                (p.first_name && p.first_name.toLowerCase().includes(q)) ||
                (p.last_name && p.last_name.toLowerCase().includes(q)) ||
                (p.phone && p.phone.includes(q)) ||
                (p.patient_id && p.patient_id.toLowerCase().includes(q))
              );
            })}
            loading={loading}
            emptyMessage="No patients found in directory."
          />
        </div>
      )}

      {/* Tab 4: Billing & Invoices */}
      {activeTab === 'billing' && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '18px' }}>
            Consultation Invoices & Payments
          </h2>
          <DataTable
            columns={invoiceColumns}
            data={invoices}
            loading={loading}
            emptyMessage="No consultation invoices on file."
          />
        </div>
      )}

      {/* Modal 1: Appointment Booking (Strictly enforces WALK_IN vs ADVANCE rules) */}
      <Modal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        title="Schedule Clinical Appointment"
        maxWidth="620px"
      >
        <form onSubmit={handleBookAppointment}>
          {/* Workflow Toggle */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>
              Appointment Type Workflow:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleWorkflowChange('WALK_IN')}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${bookingType === 'WALK_IN' ? 'var(--primary)' : 'var(--border-subtle)'}`,
                  background: bookingType === 'WALK_IN' ? 'var(--primary-light)' : 'white',
                  color: bookingType === 'WALK_IN' ? 'var(--primary-dark)' : 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  textAlign: 'center'
                }}
              >
                🚶 Walk-in (Today Only)
              </button>

              <button
                type="button"
                onClick={() => handleWorkflowChange('ADVANCE')}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${bookingType === 'ADVANCE' ? 'var(--primary)' : 'var(--border-subtle)'}`,
                  background: bookingType === 'ADVANCE' ? 'var(--primary-light)' : 'white',
                  color: bookingType === 'ADVANCE' ? 'var(--primary-dark)' : 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  textAlign: 'center'
                }}
              >
                📅 Advance (1 – 7 Days Ahead)
              </button>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              {bookingType === 'WALK_IN'
                ? '• Walk-in bookings apply strictly to today. Past or expired slots cannot be booked.'
                : '• Advance bookings are restricted to tomorrow through the next 7 days.'}
            </div>
          </div>

          {/* Patient Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Select Patient *
            </label>
            <select
              required
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'white',
                fontSize: '0.92rem'
              }}
            >
              <option value="">-- Choose Patient from Directory --</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name} ({p.patient_id || '#' + p.id}) — {p.phone || 'No phone'}
                </option>
              ))}
            </select>
          </div>

          {/* Doctor Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Consulting Doctor *
            </label>
            <select
              required
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'white',
                fontSize: '0.92rem'
              }}
            >
              <option value="">-- Choose Doctor --</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name || d.name || `Dr. #${d.id}`} ({d.specialization || 'General'}) — Fee: {formatCurrency(d.consultation_fee || 500)}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Appointment Date *
            </label>
            <input
              type="date"
              required
              value={bookingDate}
              min={bookingType === 'WALK_IN' ? todayIso : tomorrowIso}
              max={bookingType === 'WALK_IN' ? todayIso : maxAdvanceIso}
              disabled={bookingType === 'WALK_IN'}
              onChange={(e) => setBookingDate(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: bookingType === 'WALK_IN' ? '#f1f5f9' : 'white',
                fontSize: '0.92rem'
              }}
            />
          </div>

          {/* Time Slots Grid (from backend scheduling) */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Available Time Slot * {selectedSlot && <span style={{ color: 'var(--primary)' }}>({selectedSlot})</span>}
            </label>

            {!selectedDoctorId ? (
              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Please select a doctor to load available time slots.
              </div>
            ) : loadingSlots ? (
              <div style={{ padding: '14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                Loading doctor schedule from server...
              </div>
            ) : slotError ? (
              <div style={{ padding: '12px', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                {slotError}
              </div>
            ) : availableSlots.length === 0 ? (
              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No slots configured for this doctor on {formatDate(bookingDate)}.
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                gap: '8px',
                maxHeight: '160px',
                overflowY: 'auto',
                padding: '4px'
              }}>
                {availableSlots.map((slot) => {
                  const isSelected = selectedSlot === slot.time;
                  const isAvailable = slot.available;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => setSelectedSlot(slot.time)}
                      style={{
                        padding: '8px 4px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                        background: !isAvailable ? '#f1f5f9' : (isSelected ? 'var(--primary)' : 'white'),
                        color: !isAvailable ? '#94a3b8' : (isSelected ? 'white' : 'var(--text-main)'),
                        cursor: isAvailable ? 'pointer' : 'not-allowed',
                        transition: 'all 0.1s ease'
                      }}
                      title={isAvailable ? 'Click to select slot' : 'Slot unavailable / already booked'}
                    >
                      {slot.time}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Visit Category & Reason */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Visit Category *
              </label>
              <select
                value={visitCategory}
                onChange={(e) => setVisitCategory(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'white', fontSize: '0.9rem' }}
              >
                <option value="CONSULTATION">Consultation</option>
                <option value="FOLLOW_UP">Follow Up</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Reason for Visit
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Chest pain, Fever, Prescription renewal..."
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.9rem'
                }}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsBookModalOpen(false)}
              disabled={submittingBooking}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submittingBooking || !selectedSlot}
            >
              {submittingBooking ? 'Reserving...' : `Confirm ${bookingType === 'WALK_IN' ? 'Walk-in' : 'Advance'} Booking`}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: New Patient Registration */}
      <Modal
        isOpen={isPatientModalOpen}
        onClose={() => setIsPatientModalOpen(false)}
        title="Register New Clinic Patient"
        maxWidth="600px"
      >
        <form onSubmit={handleRegisterPatient}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>First Name *</label>
              <input
                type="text"
                required
                value={patientForm.first_name}
                onChange={(e) => setPatientForm({ ...patientForm, first_name: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Last Name *</label>
              <input
                type="text"
                required
                value={patientForm.last_name}
                onChange={(e) => setPatientForm({ ...patientForm, last_name: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Date of Birth *</label>
              <input
                type="date"
                required
                value={patientForm.date_of_birth}
                onChange={(e) => setPatientForm({ ...patientForm, date_of_birth: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Gender *</label>
              <select
                value={patientForm.gender}
                onChange={(e) => setPatientForm({ ...patientForm, gender: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'white' }}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Blood Group</label>
              <select
                value={patientForm.blood_group}
                onChange={(e) => setPatientForm({ ...patientForm, blood_group: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'white' }}
              >
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Phone Number *</label>
              <input
                type="tel"
                required
                placeholder="10-digit mobile"
                value={patientForm.phone}
                onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Email Address</label>
              <input
                type="email"
                placeholder="patient@email.com"
                value={patientForm.email}
                onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Residential Address</label>
            <input
              type="text"
              placeholder="Street address, city"
              value={patientForm.address}
              onChange={(e) => setPatientForm({ ...patientForm, address: e.target.value })}
              style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Emergency Contact Name</label>
              <input
                type="text"
                placeholder="Spouse / Parent / Next of kin"
                value={patientForm.emergency_contact_name}
                onChange={(e) => setPatientForm({ ...patientForm, emergency_contact_name: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Emergency Phone</label>
              <input
                type="tel"
                placeholder="Emergency contact phone"
                value={patientForm.emergency_contact_phone}
                onChange={(e) => setPatientForm({ ...patientForm, emergency_contact_phone: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsPatientModalOpen(false)}
              disabled={submittingPatient}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submittingPatient}
            >
              {submittingPatient ? 'Registering...' : 'Complete Registration'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 3: Payment Settlement */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Settle Invoice #${selectedInvoice?.invoice_number || selectedInvoice?.id}`}
      >
        <form onSubmit={handleProcessPayment}>
          <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div><strong>Patient:</strong> {selectedInvoice?.patient_name || `Patient #${selectedInvoice?.patient}`}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)', marginTop: '8px' }}>
              Amount Due: {formatCurrency(selectedInvoice?.total_amount || selectedInvoice?.amount || 0)}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Payment Mode
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'white' }}
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Debit / Credit Card</option>
              <option value="UPI">UPI / Digital QR</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsPaymentModalOpen(false)}
              disabled={submittingPayment}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submittingPayment}
            >
              {submittingPayment ? 'Processing...' : 'Confirm Payment & Print Receipt'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ReceptionistDashboard;
