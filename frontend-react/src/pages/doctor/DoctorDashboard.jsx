import React, { useState, useEffect, useCallback } from 'react';
import doctorService from '../../services/doctorService';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { formatDate, formatTime } from '../../utils/formatters';

export const DoctorDashboard = () => {
  // Navigation Tabs: 'appointments' | 'consultations' | 'patients' | 'labOrders'
  const [activeTab, setActiveTab] = useState('appointments');

  // Core Data States (Isolated to the logged-in doctor by backend queryset)
  const [appointments, setAppointments] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [patients, setPatients] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [dosages, setDosages] = useState([]);
  const [labTests, setLabTests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [patientSearch, setPatientSearch] = useState('');

  // Consultation & Treatment Modal
  const [isConsultModalOpen, setIsConsultModalOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');
  
  // Prescription items state inside consultation
  const [prescribedItems, setPrescribedItems] = useState([]);
  const [selectedMedId, setSelectedMedId] = useState('');
  const [selectedDosageId, setSelectedDosageId] = useState('');
  const [medQuantity, setMedQuantity] = useState(1);
  const [medInstructions, setMedInstructions] = useState('After meals twice daily');

  // Lab test order inside consultation
  const [selectedLabTestId, setSelectedLabTestId] = useState('');
  const [labInstructions, setLabInstructions] = useState('Fasting blood sample');

  const [savingConsult, setSavingConsult] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadDoctorData = useCallback(async () => {
    setLoading(true);
    try {
      const [apptsData, consultsData, patientsData, medsData, dosagesData, labTestsData] = await Promise.all([
        doctorService.getAppointments().catch(() => []),
        doctorService.getConsultations().catch(() => []),
        doctorService.getPatients().catch(() => []),
        doctorService.getMedicines().catch(() => []),
        doctorService.getDosages().catch(() => []),
        doctorService.getLabTests().catch(() => [])
      ]);
      setAppointments(Array.isArray(apptsData) ? apptsData : []);
      setConsultations(Array.isArray(consultsData) ? consultsData : []);
      setPatients(Array.isArray(patientsData) ? patientsData : []);
      setMedicines(Array.isArray(medsData) ? medsData : []);
      setDosages(Array.isArray(dosagesData) ? dosagesData : []);
      setLabTests(Array.isArray(labTestsData) ? labTestsData : []);
    } catch (err) {
      console.error('Failed to load doctor clinical records:', err);
      showFeedback('Could not load clinical records from backend.', 'danger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoctorData();
  }, [loadDoctorData]);

  // Handle Complete Appointment Action (CONFIRMED -> COMPLETED)
  const handleMarkComplete = async (apptId) => {
    try {
      await doctorService.completeAppointment(apptId);
      showFeedback('Appointment completed successfully.');
      await loadDoctorData();
    } catch (err) {
      showFeedback(`Could not complete appointment: ${err.message}`, 'danger');
    }
  };

  // Open Clinical Consultation Desk for an Appointment
  const handleOpenConsultation = (appt) => {
    setSelectedAppt(appt);
    setDiagnosis('');
    setSymptoms(appt.reason || 'General malaise');
    setNotes('');
    setPrescribedItems([]);
    setSelectedLabTestId('');
    setIsConsultModalOpen(true);
  };

  // Add Item to Prescription List
  const handleAddPrescriptionItem = () => {
    if (!selectedMedId || !selectedDosageId) {
      alert('Please select both a medicine and a dosage.');
      return;
    }
    const med = medicines.find(m => String(m.id) === String(selectedMedId));
    const dosage = dosages.find(d => String(d.id) === String(selectedDosageId));

    setPrescribedItems([
      ...prescribedItems,
      {
        medicine: Number(selectedMedId),
        medicine_name: med?.medicine_name || `Med #${selectedMedId}`,
        dosage: Number(selectedDosageId),
        dosage_name: dosage?.dosage_name || dosage?.name || `Dosage #${selectedDosageId}`,
        quantity: Number(medQuantity) || 1,
        instructions: medInstructions
      }
    ]);
    setSelectedMedId('');
    setSelectedDosageId('');
    setMedQuantity(1);
  };

  const handleRemovePrescriptionItem = (index) => {
    setPrescribedItems(prescribedItems.filter((_, idx) => idx !== index));
  };

  // Save Full Consultation with optional Prescriptions and Lab Orders
  const handleSaveConsultation = async (e) => {
    e.preventDefault();
    if (!selectedAppt || !diagnosis.trim()) {
      alert('Please enter a clinical diagnosis.');
      return;
    }

    setSavingConsult(true);
    try {
      // 1. Create Consultation
      const consult = await doctorService.createConsultation({
        appointment: selectedAppt.id,
        diagnosis,
        symptoms: symptoms || 'Clinical review',
        doctor_notes: notes || 'Consultation concluded'
      });

      // 2. If medicines prescribed, create prescription and its items
      if (prescribedItems.length > 0) {
        const rx = await doctorService.createPrescription({
          consultation: consult.id,
          patient: selectedAppt.patient,
          notes: notes || 'Take as directed'
        });

        for (const item of prescribedItems) {
          await doctorService.createPrescriptionItem({
            prescription: rx.id,
            medicine: item.medicine,
            dosage: item.dosage,
            quantity: item.quantity,
            instructions: item.instructions
          });
        }
      }

      // 3. If lab test selected, order lab test
      if (selectedLabTestId) {
        await doctorService.createLabOrder({
          consultation: consult.id,
          patient: selectedAppt.patient,
          test: Number(selectedLabTestId),
          instructions: labInstructions || 'Standard test protocol'
        });
      }

      // 4. If appointment was CONFIRMED, mark it COMPLETED
      if (String(selectedAppt.status).toUpperCase() === 'CONFIRMED') {
        try {
          await doctorService.completeAppointment(selectedAppt.id);
        } catch (e) {
          console.warn('Auto complete note:', e.message);
        }
      }

      setIsConsultModalOpen(false);
      showFeedback(`Clinical consultation for ${selectedAppt.patient_name || 'Patient'} saved successfully!`);
      await loadDoctorData();
    } catch (err) {
      showFeedback(`Consultation recording failed: ${err.message}`, 'danger');
    } finally {
      setSavingConsult(false);
    }
  };

  // Appointment Table Filtering
  const filteredAppointments = appointments.filter((appt) => {
    if (filterStatus === 'ALL') return true;
    return String(appt.status || '').toUpperCase() === filterStatus;
  });

  const totalAppts = appointments.length;
  const completedAppts = appointments.filter(a => String(a.status).toUpperCase() === 'COMPLETED').length;
  const inQueue = appointments.filter(a => ['CONFIRMED', 'WAITING'].includes(String(a.status).toUpperCase())).length;

  const apptColumns = [
    {
      header: 'Appt #',
      key: 'id',
      render: (r) => <span style={{ fontWeight: 600 }}>#{r.id}</span>
    },
    {
      header: 'Patient Name',
      key: 'patient_name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            {r.patient_name || `Patient #${r.patient}`}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Category: {r.visit_category || 'General'}
          </div>
        </div>
      )
    },
    {
      header: 'Scheduled Slot',
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
      header: 'Clinical Actions',
      key: 'actions',
      render: (r) => {
        const isCompleted = String(r.status).toUpperCase() === 'COMPLETED';
        const isCancelled = String(r.status).toUpperCase() === 'CANCELLED';
        const isConfirmed = String(r.status).toUpperCase() === 'CONFIRMED';

        return (
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isCancelled && !isCompleted && (
              <button
                className="btn btn-primary"
                style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                onClick={() => handleOpenConsultation(r)}
              >
                🩺 Conduct Visit
              </button>
            )}

            {isConfirmed && (
              <button
                className="btn btn-outline"
                style={{ padding: '4px 8px', fontSize: '0.78rem', borderColor: 'var(--success)', color: 'var(--success)' }}
                onClick={() => handleMarkComplete(r.id)}
                title="Mark visit finished"
              >
                ✓ Complete
              </button>
            )}

            {isCompleted && (
              <span style={{ fontSize: '0.82rem', color: 'var(--success)', fontWeight: 600 }}>
                ✓ Completed
              </span>
            )}
          </div>
        );
      }
    }
  ];

  const consultColumns = [
    {
      header: 'Consult #',
      key: 'id',
      render: (c) => <span style={{ fontWeight: 600 }}>#{c.id}</span>
    },
    {
      header: 'Patient',
      key: 'patient_name',
      render: (c) => c.patient_name || `Patient #${c.patient}`
    },
    {
      header: 'Diagnosis',
      key: 'diagnosis',
      render: (c) => (
        <div>
          <div style={{ fontWeight: 600 }}>{c.diagnosis}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.symptoms}</div>
        </div>
      )
    },
    {
      header: 'Doctor Notes',
      key: 'doctor_notes',
      render: (c) => c.doctor_notes || '-'
    },
    {
      header: 'Date',
      key: 'created_at',
      render: (c) => formatDate(c.created_at)
    }
  ];

  const patientColumns = [
    {
      header: 'Patient ID',
      key: 'patient_id',
      render: (p) => <span style={{ fontWeight: 600 }}>{p.patient_id || `#${p.id}`}</span>
    },
    {
      header: 'Full Name',
      key: 'name',
      render: (p) => (
        <div>
          <div style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.gender} • Blood Group: {p.blood_group || 'N/A'}</div>
        </div>
      )
    },
    {
      header: 'Contact Phone',
      key: 'phone',
      render: (p) => p.phone || '-'
    },
    {
      header: 'Date of Birth',
      key: 'date_of_birth',
      render: (p) => p.date_of_birth || '-'
    }
  ];

  return (
    <div>
      {/* Feedback Banner */}
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

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Physician Consultation Desk</h1>
          <p className="page-subtitle">Assigned patient appointments, clinical notes, digital prescriptions, and diagnostic orders.</p>
        </div>
        <button onClick={loadDoctorData} className="btn btn-outline">
          🔄 Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid-stats">
        <StatCard
          title="Assigned Appointments"
          value={totalAppts}
          subtitle="All assigned visits"
          icon="📅"
          color="primary"
        />
        <StatCard
          title="Ready In Queue"
          value={inQueue}
          subtitle="Patient arrived / waiting"
          icon="⏳"
          color="warning"
        />
        <StatCard
          title="Completed Visits"
          value={completedAppts}
          subtitle="Finished clinical reviews"
          icon="✅"
          color="success"
        />
        <StatCard
          title="Assigned Patients"
          value={patients.length}
          subtitle="Direct clinical history"
          icon="👥"
          color="info"
        />
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '24px', gap: '24px' }}>
        {[
          { key: 'appointments', label: `My Appointments (${appointments.length})`, icon: '📅' },
          { key: 'consultations', label: `Recorded Consultations (${consultations.length})`, icon: '🩺' },
          { key: 'patients', label: `Assigned Patients (${patients.length})`, icon: '👤' }
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

      {/* Tab 1: Doctor Appointments */}
      {activeTab === 'appointments' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Assigned Appointments Queue</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['ALL', 'CONFIRMED', 'BOOKED', 'COMPLETED', 'CANCELLED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`btn ${filterStatus === st ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <DataTable
            columns={apptColumns}
            data={filteredAppointments}
            loading={loading}
            emptyMessage="No assigned appointments found for this filter."
          />
        </div>
      )}

      {/* Tab 2: Past Consultations */}
      {activeTab === 'consultations' && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '18px' }}>
            Clinical Consultations Log
          </h2>
          <DataTable
            columns={consultColumns}
            data={consultations}
            loading={loading}
            emptyMessage="No clinical visits recorded yet."
          />
        </div>
      )}

      {/* Tab 3: Assigned Patients */}
      {activeTab === 'patients' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Patients with Active or Past Consultations</h2>
            <input
              type="text"
              placeholder="Search by first name..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.88rem'
              }}
            />
          </div>

          <DataTable
            columns={patientColumns}
            data={patients.filter(p => !patientSearch || p.first_name.toLowerCase().includes(patientSearch.toLowerCase()))}
            loading={loading}
            emptyMessage="No matching patients found in clinical history."
          />
        </div>
      )}

      {/* Full Clinical Consultation Desk Modal */}
      <Modal
        isOpen={isConsultModalOpen}
        onClose={() => setIsConsultModalOpen(false)}
        title={`Clinical Visit — Appointment #${selectedAppt?.id}`}
        maxWidth="720px"
      >
        <form onSubmit={handleSaveConsultation}>
          {/* Patient Overview */}
          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{selectedAppt?.patient_name || `Patient #${selectedAppt?.patient}`}</strong>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Scheduled for {formatDate(selectedAppt?.appointment_date)} at {formatTime(selectedAppt?.appointment_time)}
                </div>
              </div>
              <Badge status={selectedAppt?.status} />
            </div>
          </div>

          {/* Clinical Findings & Symptoms */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Reported Symptoms *
              </label>
              <input
                type="text"
                required
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="e.g. High fever, headache, body aches"
                style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.9rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Primary Diagnosis *
              </label>
              <input
                type="text"
                required
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g. Acute Viral Bronchitis"
                style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          {/* Notes & Advice */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Doctor Notes & Care Instructions
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Advice on rest, hydration, diet, and follow-up warning signs..."
              style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.9rem' }}
            />
          </div>

          {/* Prescription Writing Section */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginBottom: '18px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '10px' }}>
              💊 Prescription / Medication (Optional)
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Medicine</label>
                <select
                  value={selectedMedId}
                  onChange={(e) => setSelectedMedId(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'white', fontSize: '0.85rem' }}
                >
                  <option value="">-- Choose Medicine --</option>
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.medicine_name} ({m.generic_name || m.category || 'Drug'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Dosage</label>
                <select
                  value={selectedDosageId}
                  onChange={(e) => setSelectedDosageId(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'white', fontSize: '0.85rem' }}
                >
                  <option value="">-- Choose Dosage --</option>
                  {dosages.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.dosage_name || d.name || `Dosage #${d.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Quantity</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={medQuantity}
                  onChange={(e) => setMedQuantity(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Instructions (e.g. 1 tablet after meals for 5 days)"
                value={medInstructions}
                onChange={(e) => setMedInstructions(e.target.value)}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
              />
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleAddPrescriptionItem}
                style={{ padding: '8px 14px', fontSize: '0.82rem' }}
              >
                + Add Medicine
              </button>
            </div>

            {/* Prescribed Items Preview */}
            {prescribedItems.length > 0 && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {prescribedItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: '#f8fafc',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.85rem'
                    }}
                  >
                    <div>
                      <strong>{item.medicine_name}</strong> • {item.dosage_name} (Qty: {item.quantity})
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.instructions}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePrescriptionItem(idx)}
                      style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Diagnostic Lab Order Section */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginBottom: '22px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '10px' }}>
              🔬 Diagnostic Lab Order (Optional)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Lab Test</label>
                <select
                  value={selectedLabTestId}
                  onChange={(e) => setSelectedLabTestId(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'white', fontSize: '0.85rem' }}
                >
                  <option value="">-- No Lab Test Required --</option>
                  {labTests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.test_name} ({t.test_code || 'LAB'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Technician Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. Fasting sample required"
                  value={labInstructions}
                  onChange={(e) => setLabInstructions(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsConsultModalOpen(false)}
              disabled={savingConsult}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingConsult}
            >
              {savingConsult ? 'Submitting...' : 'Sign & Complete Clinical Consultation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DoctorDashboard;
