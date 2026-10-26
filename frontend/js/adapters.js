// ============================================================
// CMS - FRONTEND <-> BACKEND DATA ADAPTERS
// File: js/adapters.js
// Provides bidirectional translation between Django REST API
// representations and legacy frontend UI model shapes.
// ============================================================

(function () {
    const CMSAdapters = {};

    // ---------------- Time & Date Helpers ----------------
    function time24To12(timeStr) {
        if (!timeStr) return '';
        const parts = String(timeStr).split(':');
        let hours = parseInt(parts[0], 10);
        const minutes = parts[1] || '00';
        if (isNaN(hours)) return timeStr;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        if (hours === 0) hours = 12;
        return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    }

    function time12To24(timeStr) {
        if (!timeStr) return '';
        const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
        if (!match) return timeStr;
        let hours = parseInt(match[1], 10);
        const minutes = match[2];
        const seconds = match[3] || '00';
        const ampm = match[4] ? match[4].toUpperCase() : null;

        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;

        return `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
    }

    function calculateAge(dobStr) {
        if (!dobStr) return 30;
        const dob = new Date(dobStr);
        if (isNaN(dob.getTime())) return 30;
        const diff = Date.now() - dob.getTime();
        const ageDate = new Date(diff);
        return Math.abs(ageDate.getUTCFullYear() - 1970) || 30;
    }

    // ---------------- Status Mappings ----------------
    const STATUS_API_TO_UI = {
        BOOKED: 'Booked',
        CONFIRMED: 'Confirmed',
        COMPLETED: 'Completed',
        CANCELLED: 'Cancelled',
        NO_SHOW: 'No Show',
        WAITING: 'Waiting',
        IN_PROGRESS: 'In Progress',
        ORDERED: 'Pending',
        SAMPLE_COLLECTED: 'Sample Collected',
        PROCESSING: 'In Progress',
        PENDING: 'Pending',
        DISPENSED: 'Dispensed',
        PAID: 'Paid',
        UNPAID: 'Unpaid',
        PARTIAL: 'Partial'
    };

    const STATUS_UI_TO_API = {
        'Booked': 'BOOKED',
        'Confirmed': 'CONFIRMED',
        'Completed': 'COMPLETED',
        'Cancelled': 'CANCELLED',
        'No Show': 'NO_SHOW',
        'Waiting': 'CONFIRMED',      // Active queue maps to backend CONFIRMED
        'In Progress': 'CONFIRMED',
        'Pending': 'ORDERED',
        'Sample Collected': 'SAMPLE_COLLECTED',
        'Dispensed': 'DISPENSED',
        'Paid': 'PAID',
        'Unpaid': 'PENDING'
    };

    function statusFromApi(status) {
        if (!status) return 'Booked';
        return STATUS_API_TO_UI[status.toUpperCase()] || status;
    }

    function statusToApi(status) {
        if (!status) return 'BOOKED';
        return STATUS_UI_TO_API[status] || status.toUpperCase();
    }

    // ---------------- Appointment Adapters ----------------
    function adaptAppointment(apiAppt) {
        if (!apiAppt) return null;
        const patientName = apiAppt.patient_name || (apiAppt.patient && apiAppt.patient.first_name ? `${apiAppt.patient.first_name} ${apiAppt.patient.last_name || ''}`.trim() : `Patient #${apiAppt.patient}`);
        const doctorName = apiAppt.doctor_name || (apiAppt.doctor && apiAppt.doctor.full_name ? apiAppt.doctor.full_name : `Doctor #${apiAppt.doctor}`);
        const patientIdStr = apiAppt.patient_code || (apiAppt.patient && apiAppt.patient.patient_id) || `PAT${String(apiAppt.patient || apiAppt.id).padStart(3, '0')}`;

        return {
            id: apiAppt.id,
            rawId: apiAppt.id,
            patientId: patientIdStr,
            patientNumericId: apiAppt.patient,
            patientName: patientName,
            doctor: doctorName,
            doctorId: apiAppt.doctor,
            doctorNumericId: apiAppt.doctor,
            date: apiAppt.appointment_date,
            time: time24To12(apiAppt.appointment_time),
            time24: apiAppt.appointment_time,
            type: apiAppt.visit_category || (apiAppt.appointment_type === 'WALK_IN' ? 'Walk-in' : 'General'),
            appointmentType: apiAppt.appointment_type || 'ADVANCE',
            visitCategory: apiAppt.visit_category || 'General',
            status: statusFromApi(apiAppt.status),
            rawStatus: apiAppt.status,
            complaint: apiAppt.reason || 'General Consultation',
            reason: apiAppt.reason || '',
            token: apiAppt.token_number || apiAppt.token || (apiAppt.id % 20 + 1),
            age: apiAppt.patient_age || 32,
            gender: apiAppt.patient_gender || 'Male',
            blood: apiAppt.patient_blood || 'O+',
            phone: apiAppt.patient_phone || '',
            allergies: apiAppt.patient_allergies || 'None',
            bookedOn: apiAppt.created_at ? apiAppt.created_at.slice(0, 10) : apiAppt.appointment_date
        };
    }

    // ---------------- Patient Adapters ----------------
    function adaptPatient(apiPatient) {
        if (!apiPatient) return null;
        const firstName = apiPatient.first_name || '';
        const lastName = apiPatient.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim() || `Patient #${apiPatient.id}`;
        const patientIdStr = apiPatient.patient_id || `PAT${String(apiPatient.id).padStart(3, '0')}`;
        const gender = apiPatient.gender ? (apiPatient.gender.charAt(0).toUpperCase() + apiPatient.gender.slice(1).toLowerCase()) : 'Male';

        return {
            id: apiPatient.id,
            rawId: apiPatient.id,
            patientId: patientIdStr,
            name: fullName,
            firstName: firstName,
            lastName: lastName,
            age: calculateAge(apiPatient.date_of_birth),
            dateOfBirth: apiPatient.date_of_birth,
            gender: gender,
            blood: apiPatient.blood_group || 'O+',
            bloodGroup: apiPatient.blood_group || 'O+',
            phone: apiPatient.phone || '',
            email: apiPatient.email || '',
            address: apiPatient.address || '',
            emergencyContactName: apiPatient.emergency_contact_name || '',
            emergencyContactPhone: apiPatient.emergency_contact_phone || '',
            allergies: 'None',
            status: 'Active',
            registeredOn: apiPatient.created_at ? apiPatient.created_at.slice(0, 10) : '',
            isExisting: apiPatient.is_existing !== undefined ? apiPatient.is_existing : (apiPatient.created_at && apiPatient.created_at.slice(0, 10) !== TODAY),
            appointments: (apiPatient.appointments || []).map(adaptAppointment)
        };
    }

    // ---------------- Doctor Profile Adapter ----------------
    function adaptDoctor(apiDoctor) {
        if (!apiDoctor) return null;
        const name = apiDoctor.full_name || (apiDoctor.user ? apiDoctor.user.full_name || apiDoctor.user.username : `Doctor #${apiDoctor.id}`);
        const doctorIdStr = apiDoctor.doctor_id || `DOC${String(apiDoctor.id).padStart(3, '0')}`;

        return {
            id: apiDoctor.id,
            rawId: apiDoctor.id,
            doctorId: doctorIdStr,
            name: name.startsWith('Dr.') ? name : `Dr. ${name}`,
            fullName: name,
            email: apiDoctor.email || (apiDoctor.user ? apiDoctor.user.email : ''),
            specialization: apiDoctor.specialization || 'General Physician',
            qualification: apiDoctor.qualification || 'MBBS',
            registrationNumber: apiDoctor.registration_number || '',
            consultationFee: apiDoctor.consultation_fee ? parseFloat(apiDoctor.consultation_fee) : 500,
            availableFrom: apiDoctor.available_from || '09:00:00',
            availableTo: apiDoctor.available_to || '17:00:00',
            slotMinutes: apiDoctor.slot_minutes || 15,
            status: 'Active'
        };
    }

    // ---------------- Consultation Adapter ----------------
    function adaptConsultation(apiConsultation) {
        if (!apiConsultation) return null;
        return {
            id: apiConsultation.id,
            rawId: apiConsultation.id,
            appointmentId: apiConsultation.appointment,
            patientId: apiConsultation.patient,
            patientName: apiConsultation.patient_name,
            doctorId: apiConsultation.doctor,
            doctorName: apiConsultation.doctor_name,
            symptoms: apiConsultation.symptoms || '',
            diagnosis: apiConsultation.diagnosis || '',
            notes: apiConsultation.clinical_notes || apiConsultation.notes || '',
            clinicalNotes: apiConsultation.clinical_notes || '',
            treatmentPlan: apiConsultation.treatment_plan || '',
            date: apiConsultation.consultation_date ? apiConsultation.consultation_date.slice(0, 10) : ''
        };
    }

    // ---------------- Prescription Adapter ----------------
    function adaptPrescription(apiRx) {
        if (!apiRx) return null;
        return {
            id: apiRx.id,
            rawId: apiRx.id,
            prescriptionNumber: apiRx.prescription_number || `RX${String(apiRx.id).padStart(5, '0')}`,
            consultationId: apiRx.consultation,
            patientId: apiRx.patient,
            patientName: apiRx.patient_name,
            doctorId: apiRx.doctor,
            doctorName: apiRx.doctor_name,
            notes: apiRx.notes || '',
            date: apiRx.prescription_date,
            items: (apiRx.items || []).map(function (item) {
                return {
                    id: item.id,
                    medicineId: item.medicine,
                    medicineName: item.medicine_name || `Medicine #${item.medicine}`,
                    dosageId: item.dosage,
                    dosageName: item.dosage_name || '',
                    frequency: item.frequency || '1-0-1',
                    duration: item.duration || '5 days',
                    quantity: item.quantity || 10,
                    instructions: item.instructions || 'After meals'
                };
            })
        };
    }

    // ---------------- Lab Order Adapter ----------------
    function adaptLabOrder(apiOrder) {
        if (!apiOrder) return null;
        return {
            id: apiOrder.id,
            rawId: apiOrder.id,
            orderNumber: apiOrder.order_number || `LAB${String(apiOrder.id).padStart(5, '0')}`,
            patientId: apiOrder.patient,
            patientName: apiOrder.patient_name,
            doctorId: apiOrder.doctor,
            consultationId: apiOrder.consultation,
            testId: apiOrder.test,
            testName: apiOrder.test_name || `Test #${apiOrder.test}`,
            status: statusFromApi(apiOrder.status),
            rawStatus: apiOrder.status,
            orderedDate: apiOrder.ordered_date ? apiOrder.ordered_date.slice(0, 10) : '',
            priority: apiOrder.priority || 'Normal',
            result: apiOrder.result ? {
                id: apiOrder.result.id,
                resultValue: apiOrder.result.result_value,
                resultStatus: apiOrder.result.result_status,
                remarks: apiOrder.result.remarks,
                resultDate: apiOrder.result.result_date
            } : null
        };
    }

    // ---------------- Token Adapter ----------------
    function adaptToken(apiToken) {
        if (!apiToken) return null;
        return {
            id: apiToken.id,
            rawId: apiToken.id,
            appointmentId: apiToken.appointment,
            tokenNumber: apiToken.token_number,
            token: apiToken.token_number,
            patientName: apiToken.patient_name || 'Patient',
            doctorName: apiToken.doctor_name || 'Doctor',
            status: statusFromApi(apiToken.status),
            rawStatus: apiToken.status,
            date: apiToken.token_date,
            createdAt: apiToken.created_at
        };
    }

    // ---------------- Invoice & Payment Adapters ----------------
    function adaptInvoice(apiInv) {
        if (!apiInv) return null;
        return {
            id: apiInv.id,
            rawId: apiInv.id,
            invoiceNumber: apiInv.invoice_number || `INV${String(apiInv.id).padStart(5, '0')}`,
            patientId: apiInv.patient,
            patientName: apiInv.patient_name || 'Patient',
            appointmentId: apiInv.appointment,
            amount: parseFloat(apiInv.total_amount || apiInv.consultation_fee || 0),
            consultationFee: parseFloat(apiInv.consultation_fee || 0),
            discount: parseFloat(apiInv.discount || 0),
            tax: parseFloat(apiInv.tax || 0),
            totalAmount: parseFloat(apiInv.total_amount || 0),
            status: statusFromApi(apiInv.status),
            rawStatus: apiInv.status,
            date: apiInv.created_at ? apiInv.created_at.slice(0, 10) : '',
            createdAt: apiInv.created_at
        };
    }

    function adaptPayment(apiPay) {
        if (!apiPay) return null;
        return {
            id: apiPay.id,
            rawId: apiPay.id,
            invoiceId: apiPay.invoice,
            invoiceNumber: apiPay.invoice_number,
            amount: parseFloat(apiPay.amount || 0),
            method: apiPay.payment_method || 'CASH',
            transactionId: apiPay.transaction_id || '',
            date: apiPay.payment_date ? apiPay.payment_date.slice(0, 10) : ''
        };
    }

    // Export to global window.CMSAdapters
    CMSAdapters.time24To12 = time24To12;
    CMSAdapters.time12To24 = time12To24;
    CMSAdapters.calculateAge = calculateAge;
    CMSAdapters.statusFromApi = statusFromApi;
    CMSAdapters.statusToApi = statusToApi;
    CMSAdapters.adaptAppointment = adaptAppointment;
    CMSAdapters.adaptPatient = adaptPatient;
    CMSAdapters.adaptDoctor = adaptDoctor;
    CMSAdapters.adaptConsultation = adaptConsultation;
    CMSAdapters.adaptPrescription = adaptPrescription;
    CMSAdapters.adaptLabOrder = adaptLabOrder;
    CMSAdapters.adaptToken = adaptToken;
    CMSAdapters.adaptInvoice = adaptInvoice;
    CMSAdapters.adaptPayment = adaptPayment;

    window.CMSAdapters = CMSAdapters;
})();
