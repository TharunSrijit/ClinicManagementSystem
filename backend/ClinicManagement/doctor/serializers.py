from rest_framework import serializers

from apibackendapp.models import (
    DoctorProfile,
    default_doctor_available_days,
    Patient,
    MedicalHistory,
    Appointment,
    Consultation,
    Prescription,
    PrescriptionItem,
    MasterMedicine,
    MasterDosage,
    MasterLabTest,
    LabTestOrder,
    LabTestResult,
)


# ---------------------------------------------------------------------------
# REFERENCE / LOOKUP SERIALIZERS
# Used as nested read-only representations inside other serializers
# ---------------------------------------------------------------------------

class MasterDosageSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MasterDosage
        fields = ['id', 'dosage_name', 'description']


class MasterMedicineSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MasterMedicine
        fields = [
            'id', 'medicine_name', 'generic_name',
            'manufacturer', 'category', 'unit',
            'description', 'is_active',
        ]


class MasterLabTestSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MasterLabTest
        fields = [
            'id', 'test_code', 'test_name', 'category', 'description',
            'normal_range', 'unit', 'price', 'is_active',
        ]


# ---------------------------------------------------------------------------
# DOCTOR PROFILE
# ---------------------------------------------------------------------------

class DoctorProfileSerializer(serializers.ModelSerializer):
    """
    Full doctor profile. 'full_name' and 'email' are read-only
    fields pulled from the related User.
    """
    full_name = serializers.CharField(
        source='user.get_full_name', read_only=True
    )
    email = serializers.EmailField(
        source='user.email', read_only=True
    )
    available_days = serializers.ListField(
        child=serializers.ChoiceField(
            choices=('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN')
        ),
        allow_empty=False,
        required=False,
        default=default_doctor_available_days,
    )

    class Meta:
        model  = DoctorProfile
        fields = [
            'id', 'doctor_id', 'full_name', 'email',
            'specialization', 'qualification',
            'date_of_joining', 'registration_number', 'consultation_fee',
            'available_from', 'available_to', 'available_days', 'slot_minutes',
        ]
        read_only_fields = ['doctor_id']

    def validate_available_days(self, value):
        if not value:
            raise serializers.ValidationError('Select at least one available day.')
        return list(dict.fromkeys(value))

    def validate_registration_number(self, value):
        if value and not __import__('re').fullmatch(r'[A-Za-z]{3}-[0-9]+', value):
            raise serializers.ValidationError(
                'Registration number must be 3 letters followed by a hyphen and numbers (for example, REG-1234).'
            )
        return value


# ---------------------------------------------------------------------------
# PATIENT  (read-only for the doctor)
# ---------------------------------------------------------------------------

class PatientSerializer(serializers.ModelSerializer):
    appointments = serializers.SerializerMethodField()

    class Meta:
        model  = Patient
        fields = [
            'id', 'patient_id', 'first_name', 'last_name',
            'date_of_birth', 'gender', 'blood_group',
            'phone', 'email', 'address',
            'emergency_contact_name', 'emergency_contact_phone',
            'appointments',
            'created_at',
        ]
        read_only_fields = fields

    def get_appointments(self, obj):
        request = self.context.get('request')
        doctor = getattr(request.user, 'doctor_profile', None) if request and request.user.is_authenticated else None
        if doctor:
            qs = obj.appointments.filter(doctor=doctor)
        else:
            qs = obj.appointments.all()
        return AppointmentSerializer(qs, many=True, context=self.context).data


class MedicalHistorySerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source='patient.__str__', read_only=True
    )

    class Meta:
        model  = MedicalHistory
        fields = [
            'id', 'patient', 'patient_name',
            'medical_condition', 'description', 'diagnosed_date',
            'allergies', 'previous_surgeries',
            'current_medications', 'family_history', 'created_at',
        ]
        read_only_fields = ['patient', 'created_at']


# ---------------------------------------------------------------------------
# APPOINTMENT
# ---------------------------------------------------------------------------

class AppointmentSerializer(serializers.ModelSerializer):
    """
    On READ  → shows patient name, doctor name as readable strings.
    Read-only for doctors.
    """
    patient_name = serializers.CharField(
        source='patient.__str__', read_only=True
    )
    doctor_name = serializers.CharField(
        source='doctor.__str__', read_only=True
    )

    class Meta:
        model  = Appointment
        fields = [
            'id', 'patient', 'patient_name',
            'doctor', 'doctor_name',
            'appointment_type',
            'appointment_date', 'appointment_time',
            'reason', 'status', 'created_at',
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# CONSULTATION
# ---------------------------------------------------------------------------

class ConsultationSerializer(serializers.ModelSerializer):
    """
    Doctors fill in symptoms, diagnosis, clinical_notes, treatment_plan.
    appointment, doctor, patient are set by the view based on context.
    """
    patient_name = serializers.CharField(
        source='patient.__str__', read_only=True
    )
    doctor_name = serializers.CharField(
        source='doctor.__str__', read_only=True
    )

    class Meta:
        model  = Consultation
        fields = [
            'id', 'appointment',
            'patient', 'patient_name',
            'doctor', 'doctor_name',
            'symptoms', 'diagnosis',
            'clinical_notes', 'treatment_plan',
            'consultation_date',
        ]
        read_only_fields = ['consultation_date']


# ---------------------------------------------------------------------------
# PRESCRIPTION  &  PRESCRIPTION ITEMS
# ---------------------------------------------------------------------------

class PrescriptionItemSerializer(serializers.ModelSerializer):
    """
    One medicine line inside a prescription.
    READ  → shows medicine name and dosage name.
    WRITE → accepts medicine and dosage by id.
    """
    medicine_name = serializers.CharField(
        source='medicine.medicine_name', read_only=True
    )
    dosage_name = serializers.CharField(
        source='dosage.dosage_name', read_only=True
    )

    class Meta:
        model  = PrescriptionItem
        fields = [
            'id', 'prescription',
            'medicine', 'medicine_name',
            'dosage', 'dosage_name',
            'frequency', 'duration',
            'quantity', 'instructions',
        ]


class PrescriptionSerializer(serializers.ModelSerializer):
    """
    A prescription written by the doctor.
    'items' is a nested list of all PrescriptionItems — read-only here.
    Use PrescriptionItemSerializer endpoints to add/edit items.
    """
    patient_name = serializers.CharField(
        source='patient.__str__', read_only=True
    )
    doctor_name = serializers.CharField(
        source='doctor.__str__', read_only=True
    )
    items = PrescriptionItemSerializer(many=True, read_only=True)

    class Meta:
        model  = Prescription
        fields = [
            'id', 'prescription_number',
            'consultation',
            'patient', 'patient_name',
            'doctor', 'doctor_name',
            'notes', 'prescription_date',
            'items',
        ]
        read_only_fields = ['prescription_number', 'prescription_date']


# ---------------------------------------------------------------------------
# LAB TEST ORDERS  &  RESULTS
# ---------------------------------------------------------------------------

class LabTestResultSerializer(serializers.ModelSerializer):
    """
    Read-only for doctors — results are filled in by lab technicians.
    """
    test_name = serializers.CharField(
        source='order.test.test_name', read_only=True
    )
    technician_name = serializers.CharField(
        source='technician.__str__', read_only=True
    )

    class Meta:
        model  = LabTestResult
        fields = [
            'id', 'order', 'test_name',
            'technician', 'technician_name',
            'result_value', 'result_status',
            'remarks', 'result_date',
        ]
        read_only_fields = fields


class LabTestOrderSerializer(serializers.ModelSerializer):
    """
    Doctor orders a lab test.
    READ  → shows test name, patient name, result (if available).
    WRITE → accepts patient, doctor, test, consultation by id.
    """
    test_name = serializers.CharField(
        source='test.test_name', read_only=True
    )
    patient_name = serializers.CharField(
        source='patient.__str__', read_only=True
    )
    result = LabTestResultSerializer(read_only=True)

    class Meta:
        model  = LabTestOrder
        fields = [
            'id', 'order_number',
            'patient', 'patient_name',
            'doctor',
            'consultation',
            'test', 'test_name',
            'status',
            'ordered_date', 'sample_collected_at',
            'result',
        ]
        read_only_fields = ['order_number', 'ordered_date']


