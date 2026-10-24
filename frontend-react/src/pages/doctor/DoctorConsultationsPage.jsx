import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import doctorService from '../../services/doctorService';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/formatters';

export const DoctorConsultationsPage = () => {
  const [searchParams] = useSearchParams();
  const preselectedApptId = searchParams.get('appointment') || '';
  const preselectedPatientId = searchParams.get('patient') || '';

  const [consultations, setConsultations] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [dosages, setDosages] = useState([]);
  const [labTests, setLabTests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(Boolean(preselectedApptId || preselectedPatientId));
  const [selectedApptId, setSelectedApptId] = useState(preselectedApptId);
  const [patientId, setPatientId] = useState(preselectedPatientId);
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
      const [consults, appts, meds, dsgs, tests] = await Promise.all([
        doctorService.getConsultations().catch(() => []),
        doctorService.getAppointments().catch(() => []),
        doctorService.getMedicines().catch(() => []),
        doctorService.getDosages().catch(() => []),
        doctorService.getLabTests().catch(() => [])
      ]);
      setConsultations(Array.isArray(consults) ? consults : []);
      setAppointments(Array.isArray(appts) ? appts : []);
      setMedicines(Array.isArray(meds) ? meds : []);
      setDosages(Array.isArray(dsgs) ? dsgs : []);
      setLabTests(Array.isArray(tests) ? tests : []);

      // If preselected appointment was passed, set patient and reason
      if (preselectedApptId && Array.isArray(appts)) {
        const found = appts.find(a => String(a.id) === String(preselectedApptId));
        if (found) {
          setPatientId(String(found.patient));
          setSymptoms(found.reason || '');
        }
      }
    } catch (err) {
      console.error('Failed to load consultation records:', err);
      showFeedback('Could not load clinical consultation data.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [preselectedApptId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApptSelect = (apptId) => {
    setSelectedApptId(apptId);
    const found = appointments.find(a => String(a.id) === String(apptId));
    if (found) {
      setPatientId(String(found.patient));
      setSymptoms(found.reason || '');
    }
  };

  const handleAddItem = () => {
    if (!curMedId || !curDosageId) {
      alert('Please choose both a medicine and a dosage.');
      return;
    }
    const med = medicines.find(m => String(m.id) === String(curMedId));
    const dsg = dosages.find(d => String(d.id) === String(curDosageId));

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
    if (!selectedApptId || !patientId) {
      alert('Please select an active appointment.');
      return;
    }
    if (!diagnosis.trim()) {
      alert('Please enter a clinical diagnosis.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create Consultation
      const consultData = {
        appointment: Number(selectedApptId),
        patient: Number(patientId),
        diagnosis: diagnosis.trim(),
        symptoms: symptoms.trim() || 'General presentation',
        clinical_notes: clinicalNotes.trim(),
        treatment_plan: treatmentPlan.trim()
      };
      const consultRes = await doctorService.createConsultation(consultData);

      // 2. If prescription items exist, create Prescription and PrescriptionItems
      if (prescribedItems.length > 0) {
        const rxRes = await doctorService.createPrescription({
          consultation: consultRes.id,
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

      // 3. If lab test selected, order it
      if (selectedLabTestId) {
        await doctorService.createLabOrder({
          consultation: consultRes.id,
          patient: Number(patientId),
          test: Number(selectedLabTestId)
        });
      }

      // 4. Mark appointment completed
      await doctorService.completeAppointment(selectedApptId).catch(() => {});

      showFeedback('Consultation, prescription, and lab orders saved successfully!');
      setIsModalOpen(false);
      // Reset form
      setDiagnosis('');
      setSymptoms('');
      setClinicalNotes('');
      setTreatmentPlan('');
      setPrescribedItems([]);
      setSelectedLabTestId('');
      setSelectedApptId('');
      await loadData();
    } catch (err) {
      console.error('Failed to submit consultation:', err);
      showFeedback(err.message || 'Consultation submission failed.', 'danger');
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
      render: (row) => <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{row.patient_name || `Patient #${row.patient}`}</span>
    },
    {
      header: 'Clinical Diagnosis',
      key: 'diagnosis',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--text-main)', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
          {row.diagnosis}
        </span>
      )
    },
    {
      header: 'Reported Symptoms',
      key: 'symptoms',
      render: (row) => <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{row.symptoms || '—'}</span>
    },
    {
      header: 'Clinical Notes',
      key: 'clinical_notes',
      render: (row) => <span style={{ fontSize: '0.85rem' }}>{row.clinical_notes || row.treatment_plan || '—'}</span>
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clinical Consultations</h1>
          <p className="page-subtitle">Medical examination notes, primary diagnoses, and treatment plans recorded by you.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setSelectedApptId(preselectedApptId || '');
            setIsModalOpen(true);
          }}
        >
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

      {/* New Consultation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Clinical Consultation & Prescriptions"
        maxWidth="800px"
      >
        <form onSubmit={handleSubmitConsultation}>
          {/* Appointment Selection */}
          <div className="form-group">
            <label className="form-label">Select Patient / Appointment *</label>
            <select
              className="form-select"
              value={selectedApptId}
              onChange={(e) => handleApptSelect(e.target.value)}
              required
            >
              <option value="">-- Choose Assigned Appointment --</option>
              {appointments
                .filter(a => a.status !== 'COMPLETED' && a.status !== 'CANCELLED')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    Appt #{a.id} (Tkn #{a.token_number || 'N/A'}) — {a.patient_name || `Patient #${a.patient}`} ({a.appointment_date} {a.appointment_time})
                  </option>
                ))}
            </select>
          </div>

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
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
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
                            style={{ color: 'var(--danger)', fontWeight: 600, cursor: 'pointer' }}
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
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Saving Consultation...' : 'Complete & Save Consultation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DoctorConsultationsPage;
