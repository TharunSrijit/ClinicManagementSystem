from rest_framework import serializers

from .models import (
    User,
    ReceptionistProfile,
    DoctorProfile,
    LabTechnicianProfile,
    PharmacistProfile,
    Patient,
    MedicalHistory,
    Appointment,
    ConsultationInvoice,
    ConsultationPayment,
    Token,
    Consultation,
    MasterDosage,
    MasterMedicine,
    Prescription,
    PrescriptionItem,
    MasterLabTest,
    LabTestOrder,
    LabTestResult,
    Dispense,
    DispenseItem,
    StockMaster,
    StockTransaction,
    PriceList,
    LabInvoice,
    LabPayment,
    PharmacyInvoice,
    PharmacyPayment,
)


# ============================================================================
# USER & ROLE PROFILES
# ============================================================================

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name', 'email',
            'phone', 'role', 'is_active', 'is_staff', 'date_joined',
            'password',
        ]
        read_only_fields = ['id', 'is_staff', 'date_joined']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class ReceptionistProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='user', write_only=True
    )
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = ReceptionistProfile
        fields = ['id', 'user', 'user_id', 'employee_id', 'phone', 'full_name']

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class DoctorProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='user', write_only=True
    )
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = DoctorProfile
        fields = [
            'id', 'user', 'user_id', 'doctor_id', 'specialization',
            'qualification', 'registration_number', 'consultation_fee',
            'available_from', 'available_to', 'full_name',
        ]

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class LabTechnicianProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='user', write_only=True
    )

    class Meta:
        model = LabTechnicianProfile
        fields = ['id', 'user', 'user_id', 'employee_id', 'qualification', 'phone']


class PharmacistProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='user', write_only=True
    )

    class Meta:
        model = PharmacistProfile
        fields = ['id', 'user', 'user_id', 'employee_id', 'qualification', 'phone']


# ============================================================================
# PATIENT
# ============================================================================

class PatientSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            'id', 'patient_id', 'first_name', 'last_name', 'full_name',
            'date_of_birth', 'gender', 'blood_group', 'phone', 'email',
            'address', 'emergency_contact_name', 'emergency_contact_phone',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'patient_id', 'created_at', 'updated_at']

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"


class MedicalHistorySerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.__str__', read_only=True)

    class Meta:
        model = MedicalHistory
        fields = [
            'id', 'patient', 'patient_name', 'medical_condition', 'description',
            'diagnosed_date', 'allergies', 'previous_surgeries',
            'current_medications', 'family_history', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


# ============================================================================
# APPOINTMENT
# ============================================================================

class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.__str__', read_only=True)
    doctor_name = serializers.CharField(source='doctor.__str__', read_only=True)
    receptionist_name = serializers.CharField(
        source='receptionist.__str__', read_only=True, default=None
    )

    class Meta:
        model = Appointment
        fields = [
            'id', 'patient', 'patient_name', 'doctor', 'doctor_name',
            'receptionist', 'receptionist_name', 'appointment_date',
            'appointment_time', 'reason', 'status', 'created_at',
        ]
        read_only_fields = ['id', 'receptionist', 'created_at']


# ============================================================================
# CONSULTATION BILLING
# ============================================================================

class ConsultationInvoiceSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.__str__', read_only=True)
    balance_due = serializers.SerializerMethodField()
    # patient and consultation_fee are auto-filled from the appointment/doctor
    # if not supplied; total_amount is always computed server-side.
    patient = serializers.PrimaryKeyRelatedField(
        queryset=Patient.objects.all(), required=False
    )
    consultation_fee = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False
    )

    class Meta:
        model = ConsultationInvoice
        fields = [
            'id', 'invoice_number', 'patient', 'patient_name', 'appointment',
            'consultation_fee', 'discount', 'tax', 'total_amount', 'status',
            'balance_due', 'created_at',
        ]
        read_only_fields = ['id', 'invoice_number', 'total_amount', 'created_at']

    def get_balance_due(self, obj):
        paid = sum(p.amount for p in obj.payments.all())
        return obj.total_amount - paid


class ConsultationPaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)

    class Meta:
        model = ConsultationPayment
        fields = [
            'id', 'invoice', 'invoice_number', 'amount', 'payment_method',
            'transaction_id', 'payment_date',
        ]
        read_only_fields = ['id', 'payment_date']


class TokenSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='appointment.patient.__str__', read_only=True)
    doctor_name = serializers.CharField(source='appointment.doctor.__str__', read_only=True)

    class Meta:
        model = Token
        fields = [
            'id', 'appointment', 'patient_name', 'doctor_name', 'token_number',
            'token_date', 'status', 'created_at',
        ]
        read_only_fields = ['id', 'token_number', 'created_at']


class ConsultationSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.__str__', read_only=True)
    doctor_name = serializers.CharField(source='doctor.__str__', read_only=True)

    class Meta:
        model = Consultation
        fields = [
            'id', 'appointment', 'doctor', 'doctor_name', 'patient', 'patient_name',
            'symptoms', 'diagnosis', 'clinical_notes', 'treatment_plan',
            'consultation_date',
        ]
        read_only_fields = ['id', 'consultation_date']


# ============================================================================
# PRESCRIPTION
# ============================================================================

class MasterDosageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MasterDosage
        fields = ['id', 'dosage_name', 'description']


class MasterMedicineSerializer(serializers.ModelSerializer):
    class Meta:
        model = MasterMedicine
        fields = [
            'id', 'medicine_name', 'generic_name', 'manufacturer', 'category',
            'unit', 'description', 'is_active',
        ]


class PrescriptionItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.medicine_name', read_only=True)
    dosage_name = serializers.CharField(source='dosage.dosage_name', read_only=True)

    class Meta:
        model = PrescriptionItem
        fields = [
            'id', 'prescription', 'medicine', 'medicine_name', 'dosage',
            'dosage_name', 'frequency', 'duration', 'quantity', 'instructions',
        ]


class PrescriptionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.__str__', read_only=True)
    doctor_name = serializers.CharField(source='doctor.__str__', read_only=True)
    items = PrescriptionItemSerializer(many=True, read_only=True)

    class Meta:
        model = Prescription
        fields = [
            'id', 'prescription_number', 'consultation', 'patient', 'patient_name',
            'doctor', 'doctor_name', 'notes', 'prescription_date', 'items',
        ]
        read_only_fields = ['id', 'prescription_number', 'prescription_date']


# ============================================================================
# LAB
# ============================================================================

class MasterLabTestSerializer(serializers.ModelSerializer):
    class Meta:
        model = MasterLabTest
        fields = [
            'id', 'test_code', 'test_name', 'description', 'normal_range',
            'unit', 'price', 'is_active',
        ]


class LabTestOrderSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.__str__', read_only=True)
    doctor_name = serializers.CharField(source='doctor.__str__', read_only=True)
    test_name = serializers.CharField(source='test.test_name', read_only=True)

    class Meta:
        model = LabTestOrder
        fields = [
            'id', 'order_number', 'patient', 'patient_name', 'doctor', 'doctor_name',
            'consultation', 'test', 'test_name', 'status', 'ordered_date',
            'sample_collected_at',
        ]
        read_only_fields = ['id', 'order_number', 'ordered_date']


class LabTestResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabTestResult
        fields = [
            'id', 'order', 'technician', 'result_value', 'result_status',
            'remarks', 'result_date',
        ]
        read_only_fields = ['id', 'result_date']


# ============================================================================
# PHARMACY
# ============================================================================

class DispenseItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.medicine_name', read_only=True)

    class Meta:
        model = DispenseItem
        fields = [
            'id', 'dispense', 'medicine', 'medicine_name', 'quantity',
            'unit_price', 'total_price',
        ]


class DispenseSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.__str__', read_only=True)
    items = DispenseItemSerializer(many=True, read_only=True)

    class Meta:
        model = Dispense
        fields = [
            'id', 'dispense_number', 'prescription', 'patient', 'patient_name',
            'pharmacist', 'status', 'dispense_date', 'items',
        ]
        read_only_fields = ['id', 'dispense_number', 'dispense_date']


# ============================================================================
# STOCK / PRICE
# ============================================================================

class StockMasterSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.medicine_name', read_only=True)

    class Meta:
        model = StockMaster
        fields = [
            'id', 'medicine', 'medicine_name', 'batch_number', 'expiry_date',
            'quantity', 'purchase_price', 'selling_price', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class StockTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockTransaction
        fields = [
            'id', 'stock', 'transaction_type', 'quantity', 'reference_number',
            'transaction_date', 'notes',
        ]
        read_only_fields = ['id', 'transaction_date']


class PriceListSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.medicine_name', read_only=True)

    class Meta:
        model = PriceList
        fields = [
            'id', 'medicine', 'medicine_name', 'purchase_price', 'selling_price',
            'effective_from', 'effective_to', 'is_active',
        ]


# ============================================================================
# LAB & PHARMACY BILLING
# ============================================================================

class LabInvoiceSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.__str__', read_only=True)

    class Meta:
        model = LabInvoice
        fields = [
            'id', 'invoice_number', 'patient', 'patient_name', 'lab_order',
            'amount', 'discount', 'total_amount', 'status', 'created_at',
        ]
        read_only_fields = ['id', 'invoice_number', 'created_at']


class LabPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabPayment
        fields = [
            'id', 'invoice', 'amount', 'payment_method', 'transaction_id',
            'payment_date',
        ]
        read_only_fields = ['id', 'payment_date']


class PharmacyInvoiceSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.__str__', read_only=True)

    class Meta:
        model = PharmacyInvoice
        fields = [
            'id', 'invoice_number', 'patient', 'patient_name', 'dispense',
            'subtotal', 'discount', 'tax', 'total_amount', 'status', 'created_at',
        ]
        read_only_fields = ['id', 'invoice_number', 'created_at']


class PharmacyPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PharmacyPayment
        fields = [
            'id', 'invoice', 'amount', 'payment_method', 'transaction_id',
            'payment_date',
        ]
        read_only_fields = ['id', 'payment_date']