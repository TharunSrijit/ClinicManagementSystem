import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import doctorService from '../../services/doctorService';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/formatters';

export const DoctorConsultationsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedConsultId = searchParams.get('consultation') || '';
  const preselectedApptId = searchParams.get('appointment') || '';
  const preselectedPatientId = searchParams.get('patient') || '';

  const [consultations, setConsultations] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [dosages, setDosages] = useState([]);
  const [labTests, setLabTests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(
    Boolean(preselectedConsultId || preselectedApptId || preselectedPatientId)
  );

  // Workflow: 'TOKEN_BASED' or 'UNSCHEDULED'
  const [workflowType, setWorkflowType] = useState(
    preselectedConsultId ? 'UNSCHEDULED' : preselectedApptId ? 'TOKEN_BASED' : 'TOKEN_BASED'
  );

  // Active existing consultation ID (if resuming/completing an in-progress consultation)
  const [activeConsultationId, setActiveConsultationId] = useState(preselectedConsultId);
  const [activeConsultationData, setActiveConsultationData] = useState(null);

  const [selectedApptId, setSelectedApptId] = useState(preselectedApptId);
  const [patientId, setPatientId] = useState(preselectedPatientId);
  const [visitReason, setVisitReason] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');

  // Prescription Items inside consultation
  const [prescribedItems, setPrescribedItems] = useState([]);
  const [curMedId, setCurMedId] = useState('');
  const [curDosageId, setCurDosageId] = useState('');
  const [curQty, setCurQty] = useState(1);
  const [curDuration, setCurDuration] = useState('5 days');
  const [curFrequency, setCurFrequency] = useState('Twice daily');
  const [curInstructions, setCurInstructions] = useState('Take after meals');

  // Lab Test Order inside consultation
  const [selectedLabTestId, setSelectedLabTestId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [consults, appts, pts, meds, dsgs, tests] = await Promise.all([
        doctorService.getConsultations().catch(() => []),
        doctorService.getAppointments().catch(() => []),
        doctorService.getPatients().catch(() => []),
        doctorService.getMedicines().catch(() => []),
        doctorService.getDosages().catch(() => []),
        doctorService.getLabTests().catch(() => [])
      ]);
      setConsultations(Array.isArray(consults) ? consults : []);
      setAppointments(Array.isArray(appts) ? appts : []);
      setPatients(Array.isArray(pts) ? pts : []);
      setMedicines(Array.isArray(meds) ? meds : []);
      setDosages(Array.isArray(dsgs) ? dsgs : []);
      setLabTests(Array.isArray(tests) ? tests : []);

      // Handle preselected consultation if provided in query string
      if (preselectedConsultId) {
        try {
          const consultObj = await doctorService.getConsultation(preselectedConsultId);
          if (consultObj) {
            setActiveConsultationId(consultObj.id);
            setActiveConsultationData(consultObj);
            setWorkflowType(consultObj.visit_type || 'UNSCHEDULED');
            setPatientId(String(consultObj.patient));
            setVisitReason(consultObj.visit_reason || '');
            setSymptoms(consultObj.symptoms || consultObj.visit_reason || '');
            setDiagnosis(consultObj.diagnosis || '');
            setClinicalNotes(consultObj.clinical_notes || '');
            setTreatmentPlan(consultObj.treatment_plan || '');
            setIsModalOpen(true);
          }
        } catch (e) {
          console.warn('Could not fetch preselected consultation:', e);
        }
      } else if (preselectedApptId && Array.isArray(appts)) {
        // Preselected appointment
        const found = appts.find((a) => String(a.id) === String(preselectedApptId));
        if (found) {
          setSelectedApptId(String(found.id));
          setPatientId(String(found.patient?.id || found.patient));
          setSymptoms(found.reason || '');
          setWorkflowType('TOKEN_BASED');
          setIsModalOpen(true);
        }
      }
    } catch (err) {
      console.error('Failed to load consultation records:', err);
      showFeedback('Could not load clinical consultation data.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [preselectedConsultId, preselectedApptId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApptSelect = (apptId) => {
    setSelectedApptId(apptId);
    const found = appointments.find((a) => String(a.id) === String(apptId));
    if (found) {
      setPatientId(String(found.patient?.id || found.patient));
      setSymptoms(found.reason || '');
    }
  };

  const handleResumeConsultation = (consult) => {
    setActiveConsultationId(consult.id);
    setActiveConsultationData(consult);
    setWorkflowType(consult.visit_type || 'UNSCHEDULED');
    setPatientId(String(consult.patient));
    setVisitReason(consult.visit_reason || '');
    setSymptoms(consult.symptoms || consult.visit_reason || '');
    setDiagnosis(consult.diagnosis || '');
    setClinicalNotes(consult.clinical_notes || '');
    setTreatmentPlan(consult.treatment_plan || '');
    setIsModalOpen(true);
  };

  const handleOpenNewModal = () => {
    setActiveConsultationId('');
    setActiveConsultationData(null);
    setSelectedApptId('');
    setPatientId('');
    setVisitReason('');
    setSymptoms('');
    setDiagnosis('');
    setClinicalNotes('');
    setTreatmentPlan('');
    setPrescribedItems([]);
    setSelectedLabTestId('');
    setWorkflowType('TOKEN_BASED');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setActiveConsultationId('');
    setActiveConsultationData(null);
    setSearchParams({});
  };

  const handleAddItem = () => {
    if (!curMedId || !curDosageId) {
      alert('Please choose both a medicine and a dosage.');
      return;
    }
    const med = medicines.find((m) => String(m.id) === String(curMedId));
    const dsg = dosages.find((d) => String(d.id) === String(curDosageId));

    setPrescribedItems([
      ...prescribedItems,
      {
        medicine: Number(curMedId),
        medicine_name: med?.medicine_name || `Med #${curMedId}`,
        dosage: Number(curDosageId),
        dosage_name: dsg?.dosage_name || `Dosage #${curDosageId}`,
        quantity: Number(curQty) || 1,
        frequency: curFrequency,
        duration: curDuration,
        instructions: curInstructions
      }
    ]);

    setCurMedId('');
    setCurDosageId('');
    setCurQty(1);
  };

  const handleRemoveItem = (idx) => {
    setPrescribedItems(prescribedItems.filter((_, i) => i !== idx));
  };

  const handleSubmitConsultation = async (e) => {
    e.preventDefault();

    if (!diagnosis.trim()) {
      alert('Please enter a clinical diagnosis.');
      return;
    }

    if (workflowType === 'TOKEN_BASED' && !activeConsultationId && !selectedApptId) {
      alert('Please select an active appointment with a queue token.');
      return;
    }

    if (workflowType === 'UNSCHEDULED' && !activeConsultationId && !patientId) {
      alert('Please select a registered patient for this unscheduled consultation.');
      return;
    }

    setSubmitting(true);
    try {
      let finalConsultationId = activeConsultationId;

      if (activeConsultationId) {
        // 1A. Update existing active unscheduled consultation
        const updatePayload = {
          diagnosis: diagnosis.trim(),
          symptoms: symptoms.trim() || 'General presentation',
          clinical_notes: clinicalNotes.trim(),
          treatment_plan: treatmentPlan.trim(),
          status: 'COMPLETED'
        };
        const updated = await doctorService.updateConsultation(activeConsultationId, updatePayload);
        finalConsultationId = updated.id;
      } else if (workflowType === 'UNSCHEDULED') {
        // 1B. Create new unscheduled consultation
        const consultData = {
          patient: Number(patientId),
          visit_type: 'UNSCHEDULED',
          visit_reason: visitReason.trim() || symptoms.trim(),
          diagnosis: diagnosis.trim(),
          symptoms: symptoms.trim() || 'General presentation',
          clinical_notes: clinicalNotes.trim(),
          treatment_plan: treatmentPlan.trim(),
          status: 'COMPLETED'
        };
        const res = await doctorService.createConsultation(consultData);
        finalConsultationId = res.id;
      } else {
        // 1C. Create token-based consultation
        const consultData = {
          appointment: Number(selectedApptId),
          patient: Number(patientId),
          visit_type: 'TOKEN_BASED',
          diagnosis: diagnosis.trim(),
          symptoms: symptoms.trim() || 'General presentation',
          clinical_notes: clinicalNotes.trim(),
          treatment_plan: treatmentPlan.trim(),
          status: 'COMPLETED'
        };
        const res = await doctorService.createConsultation(consultData);
        finalConsultationId = res.id;

        // Mark appointment completed
        await doctorService.completeAppointment(selectedApptId).catch(() => {});
      }

      // 2. Prescriptions
      if (prescribedItems.length > 0 && finalConsultationId) {
        const rxRes = await doctorService.createPrescription({
          consultation: finalConsultationId,
          patient: Number(patientId),
          notes: clinicalNotes || 'Prescribed during consultation'
        });

        for (const item of prescribedItems) {
          await doctorService.createPrescriptionItem({
            prescription: rxRes.id,
            medicine: item.medicine,
            dosage: item.dosage,
            quantity: item.quantity,
            frequency: item.frequency,
            duration: item.duration,
            instructions: item.instructions
          });
        }
      }

      // 3. Lab Test Order
      if (selectedLabTestId && finalConsultationId) {
        await doctorService.createLabOrder({
          consultation: finalConsultationId,
          patient: Number(patientId),
          test: Number(selectedLabTestId)
        });
      }

      showFeedback(
        workflowType === 'UNSCHEDULED'
          ? 'Unscheduled consultation completed and invoiced successfully!'
          : 'Token-based consultation completed and appointment closed successfully!'
      );
      handleCloseModal();
      await loadData();
    } catch (err) {
      console.error('Failed to submit consultation:', err);
      const errMsg =
        err.response?.data?.detail ||
        err.response?.data?.token ||
        err.response?.data?.appointment ||
        err.message ||
        'Consultation submission failed.';
      showFeedback(errMsg, 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'ID',
      key: 'id',
      render: (row) => <span style={{ fontWeight: 600 }}>#{row.id}</span>
    },
    {
      header: 'Date',
      key: 'consultation_date',
      render: (row) => <span>{formatDate(row.consultation_date || row.created_at)}</span>
    },
    {
      header: 'Patient Name',
      key: 'patient_name',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
          {row.patient_name || `Patient #${row.patient}`}
        </span>
      )
    },
    {
      header: 'Workflow / Visit Type',
      key: 'visit_type',
      render: (row) => {
        if (row.visit_type === 'UNSCHEDULED') {
          return (
            <span
              className="badge"
              style={{
                background: '#fef3c7',
                color: '#92400e',
                border: '1px solid #fde68a',
                fontSize: '0.78rem'
              }}
              title="Tokenless unscheduled direct consultation"
            >
              ⚡ Unscheduled
            </span>
          );
        }
        return (
          <span
            className="badge"
            style={{
              background: '#e0e7ff',
              color: '#3730a3',
              border: '1px solid #c7d2fe',
              fontSize: '0.78rem'
            }}
            title="Scheduled appointment with queue token"
          >
            🎫 Token #{row.token_number || '—'}
          </span>
        );
      }
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => (
        <span
          className={`badge ${row.status === 'IN_PROGRESS' ? 'badge-warning' : 'badge-success'}`}
          style={{ fontSize: '0.75rem' }}
        >
          {row.status === 'IN_PROGRESS' ? '● In Progress' : '✓ Completed'}
        </span>
      )
    },
    {
      header: 'Clinical Diagnosis',
      key: 'diagnosis',
      render: (row) => (
        <span
          style={{
            fontWeight: 600,
            color: 'var(--text-main)',
            background: '#f1f5f9',
            padding: '2px 8px',
            borderRadius: '4px'
          }}
        >
          {row.diagnosis || '—'}
        </span>
      )
    },
    {
      header: 'Reported Symptoms',
      key: 'symptoms',
      render: (row) => (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {row.symptoms || row.visit_reason || '—'}
        </span>
      )
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => {
        if (row.status === 'IN_PROGRESS') {
          return (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleResumeConsultation(row)}
              title="Resume and complete in-progress clinical consultation"
            >
              Resume 🩺
            </button>
          );
        }
        return null;
      }
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clinical Consultations</h1>
          <p className="page-subtitle">
            Medical examination notes, primary diagnoses, and treatment plans for token-based and unscheduled consultations.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenNewModal}>
          + Record New Consultation
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      <DataTable
        columns={columns}
        data={consultations}
        loading={loading}
        emptyMessage="No consultation records logged yet."
      />

      {/* New / Resume Consultation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={
          activeConsultationId
            ? `Complete Consultation #${activeConsultationId} (${workflowType})`
            : 'Record Clinical Consultation & Prescriptions'
        }
        maxWidth="840px"
      >
        <form onSubmit={handleSubmitConsultation}>
          {/* Active consultation resume banner */}
          {activeConsultationId && (
            <div
              style={{
                background: workflowType === 'UNSCHEDULED' ? '#fffbeb' : '#e0e7ff',
                border: `1px solid ${workflowType === 'UNSCHEDULED' ? '#fde68a' : '#c7d2fe'}`,
                color: workflowType === 'UNSCHEDULED' ? '#92400e' : '#3730a3',
                padding: '12px 16px',
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '0.88rem'
              }}
            >
              <strong>
                {workflowType === 'UNSCHEDULED'
                  ? '⚡ Active Unscheduled Consultation (Tokenless)'
                  : '🎫 Active Token-Based Consultation'}
              </strong>
              <div style={{ marginTop: '4px' }}>
                Patient: <strong>{activeConsultationData?.patient_name || `Patient #${patientId}`}</strong>{' '}
                {visitReason && `• Visit Reason: "${visitReason}"`}
              </div>
            </div>
          )}

          {/* Workflow Selector when creating fresh */}
          {!activeConsultationId && (
            <div style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Select Consultation Workflow *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div
                  style={{
                    border: `2px solid ${workflowType === 'TOKEN_BASED' ? 'var(--primary)' : 'var(--border-subtle)'}`,
                    borderRadius: '8px',
                    padding: '12px',
                    cursor: 'pointer',
                    background: workflowType === 'TOKEN_BASED' ? 'var(--primary-light, #f0fdf4)' : '#fff'
                  }}
                  onClick={() => setWorkflowType('TOKEN_BASED')}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    🎫 Workflow A: Token-Based
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Scheduled appointment with a validated queue token from reception.
                  </div>
                </div>

                <div
                  style={{
                    border: `2px solid ${workflowType === 'UNSCHEDULED' ? '#f59e0b' : 'var(--border-subtle)'}`,
                    borderRadius: '8px',
                    padding: '12px',
                    cursor: 'pointer',
                    background: workflowType === 'UNSCHEDULED' ? '#fffbeb' : '#fff'
                  }}
                  onClick={() => setWorkflowType('UNSCHEDULED')}
                >
                  <div style={{ fontWeight: 600, color: '#92400e' }}>
                    ⚡ Workflow B: Unscheduled
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Direct clinical entry for registered patient without queue token.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Patient / Appointment Selection */}
          {!activeConsultationId && workflowType === 'TOKEN_BASED' && (
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Select Appointment with Token *</label>
              <select
                className="form-select"
                value={selectedApptId}
                onChange={(e) => handleApptSelect(e.target.value)}
                required
              >
                <option value="">-- Choose Assigned Appointment --</option>
                {appointments
                  .filter((a) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED')
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      Appt #{a.id} (Tkn #{a.token_number || a.token?.token_number || 'N/A'}) —{' '}
                      {a.patient_name || `Patient #${a.patient}`} ({a.appointment_date} {a.appointment_time})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {!activeConsultationId && workflowType === 'UNSCHEDULED' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">Select Registered Patient *</label>
                <select
                  className="form-select"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Registered Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patient_id || `#${p.id}`} — {p.first_name} {p.last_name} ({p.phone || 'No phone'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Visit Reason / Chief Complaint</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Walk-in urgent checkup"
                  value={visitReason}
                  onChange={(e) => setVisitReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Reported Symptoms *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. High fever, chills, body ache"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Primary Diagnosis *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Acute Viral Bronchitis"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Clinical Examination Notes</label>
            <textarea
              className="form-control"
              rows="2"
              placeholder="Clinical observations, chest clear, BP 120/80..."
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Treatment Plan / Patient Advice</label>
            <textarea
              className="form-control"
              rows="2"
              placeholder="Adequate hydration, warm saline gargle, follow-up in 5 days..."
              value={treatmentPlan}
              onChange={(e) => setTreatmentPlan(e.target.value)}
            />
          </div>

          {/* Prescriptions Section */}
          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '12px' }}>
              💊 Prescribe Medications
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr auto', gap: '8px', alignItems: 'flex-end', marginBottom: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Medicine</label>
                <select
                  className="form-select"
                  value={curMedId}
                  onChange={(e) => setCurMedId(e.target.value)}
                >
                  <option value="">-- Medicine --</option>
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.medicine_name} ({m.category || 'Drug'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Dosage Form</label>
                <select
                  className="form-select"
                  value={curDosageId}
                  onChange={(e) => setCurDosageId(e.target.value)}
                >
                  <option value="">-- Dosage --</option>
                  {dosages.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.dosage_name || d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Quantity</label>
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  value={curQty}
                  onChange={(e) => setCurQty(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Duration</label>
                <input
                  type="text"
                  className="form-control"
                  value={curDuration}
                  onChange={(e) => setCurDuration(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '8px 12px' }}
                onClick={handleAddItem}
              >
                + Add
              </button>
            </div>

            {prescribedItems.length > 0 && (
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: 'var(--radius-sm, 6px)', marginBottom: '16px' }}>
                <table style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th>Medicine</th>
                      <th>Dosage</th>
                      <th>Qty</th>
                      <th>Duration</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescribedItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{item.medicine_name}</td>
                        <td>{item.dosage_name}</td>
                        <td>{item.quantity}</td>
                        <td>{item.duration}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            style={{ color: 'var(--danger)', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none' }}
                            onClick={() => handleRemoveItem(idx)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Lab Test Order */}
          <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '12px' }}>
              🧪 Order Diagnostic Lab Test (Optional)
            </h4>
            <div className="form-group">
              <select
                className="form-select"
                value={selectedLabTestId}
                onChange={(e) => setSelectedLabTestId(e.target.value)}
              >
                <option value="">-- No Lab Test Required --</option>
                {labTests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.test_name} ({t.test_code || 'LAB'}) — ₹{t.price || 0}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn btn-outline" onClick={handleCloseModal}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving Consultation...' : 'Complete & Save Consultation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DoctorConsultationsPage;
