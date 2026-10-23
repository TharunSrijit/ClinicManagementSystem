from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    User,
    ReceptionistProfile,
    DoctorProfile,
    LabTechnicianProfile,
    PharmacistProfile,
    Patient,
    MedicalHistory,
    Appointment,
    Token,
    MasterDosage,
    MasterMedicine,
    MasterLabTest,
    PriceList,
    StockMaster,
    StockTransaction,
    ConsultationInvoice,
    ConsultationPayment,
    LabInvoice,
    PharmacyInvoice,
)


# ---------------------------------------------------------------------------
# AUTH SERIALIZERS
# ---------------------------------------------------------------------------

class SignupSerializer(serializers.ModelSerializer):
    """
    Handles new user registration.
    - password is write-only (never returned in responses)
    - role defaults to RECEPTIONIST if not provided.
    - email converts blank string to None to avoid unique constraint collisions.
    """
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField(required=False, allow_blank=True, default=None)
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, required=False, default='RECEPTIONIST')

    class Meta:
        model  = User
        fields = ['id', 'username', 'email', 'password', 'role', 'phone',
                  'first_name', 'last_name']

    def validate_email(self, value):
        if value == '' or value is None:
            return None
        return value

    def create(self, validated_data):
        email = validated_data.get('email')
        if email == '':
            email = None
        role = validated_data.get('role', 'RECEPTIONIST')
        return User.objects.create_user(
            username   = validated_data['username'],
            email      = email,
            password   = validated_data['password'],
            role       = role,
            phone      = validated_data.get('phone', ''),
            first_name = validated_data.get('first_name', ''),
            last_name  = validated_data.get('last_name', ''),
        )


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends the default JWT login serializer to include
    the user's role and full name in the token payload and response.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role']      = user.role
        token['username']  = user.username
        token['full_name'] = user.get_full_name()
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['role']      = self.user.role
        data['username']  = self.user.username
        data['full_name'] = self.user.get_full_name()
        data['user_id']   = self.user.id
        return data


# ---------------------------------------------------------------------------
# 1. USER & STAFF PROFILE SERIALIZERS
# Used by: adminapp (CRUD), adminapp/serializers (staff onboarding)
# ---------------------------------------------------------------------------

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    email = serializers.EmailField(required=False, allow_blank=True, default=None)

    class Meta:
        model  = User
        fields = [
            'id', 'username', 'email', 'password', 'role', 'phone',
            'first_name', 'last_name',
            'is_active', 'date_joined',
        ]
        read_only_fields = ['date_joined']

    def validate_email(self, value):
        if value == '' or value is None:
            return None
        return value

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        email = validated_data.get('email')
        if email == '':
            validated_data['email'] = None
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        if 'email' in validated_data and (validated_data['email'] == '' or validated_data['email'] is None):
            validated_data['email'] = None
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user


class ReceptionistProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(
        source='user.get_full_name', read_only=True
    )
    email = serializers.EmailField(
        source='user.email', read_only=True
    )

    class Meta:
        model  = ReceptionistProfile
        fields = ['id', 'user', 'full_name', 'email', 'employee_id', 'phone']
        read_only_fields = ['employee_id']


class DoctorProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(
        source='user.get_full_name', read_only=True
    )
    email = serializers.EmailField(
        source='user.email', read_only=True
    )

    class Meta:
        model  = DoctorProfile
        fields = [
            'id', 'doctor_id', 'full_name', 'email',
            'specialization', 'qualification',
            'registration_number', 'consultation_fee',
            'available_from', 'available_to', 'slot_minutes',
        ]
        read_only_fields = ['doctor_id']


class LabTechnicianProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(
        source='user.get_full_name', read_only=True
    )
    email = serializers.EmailField(
        source='user.email', read_only=True
    )

    class Meta:
        model  = LabTechnicianProfile
        fields = ['id', 'user', 'full_name', 'email', 'employee_id', 'qualification', 'phone']
        read_only_fields = ['employee_id']


class PharmacistProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(
        source='user.get_full_name', read_only=True
    )
    email = serializers.EmailField(
        source='user.email', read_only=True
    )

    class Meta:
        model  = PharmacistProfile
        fields = ['id', 'user', 'full_name', 'email', 'employee_id', 'qualification', 'phone']
        read_only_fields = ['employee_id']


# ---------------------------------------------------------------------------
# 2. PATIENT & MEDICAL HISTORY
# Used by: adminapp, receptionist
# ---------------------------------------------------------------------------

class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Patient
        fields = [
            'id', 'patient_id', 'first_name', 'last_name',
            'date_of_birth', 'gender', 'blood_group',
            'phone', 'email', 'address',
            'emergency_contact_name', 'emergency_contact_phone',
            'created_at',
        ]
        read_only_fields = ['patient_id', 'created_at']


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
        read_only_fields = ['created_at']


# ---------------------------------------------------------------------------
# 3. APPOINTMENTS & TOKENS
# Used by: adminapp, receptionist
# ---------------------------------------------------------------------------

class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source='patient.__str__', read_only=True
    )
    doctor_name = serializers.CharField(
        source='doctor.__str__', read_only=True
    )
    appointment_time = serializers.TimeField(required=True)

    class Meta:
        model  = Appointment
        fields = [
            'id', 'patient', 'patient_name',
            'doctor', 'doctor_name',
            'appointment_type', 'visit_category',
            'appointment_date', 'appointment_time',
            'reason', 'status', 'created_at',
        ]
        read_only_fields = ['created_at']

    def validate(self, attrs):
        doctor = attrs.get('doctor') or (self.instance.doctor if self.instance else None)
        patient = attrs.get('patient') or (self.instance.patient if self.instance else None)
        appointment_type = attrs.get('appointment_type') or (getattr(self.instance, 'appointment_type', 'ADVANCE') if self.instance else 'ADVANCE')
        appointment_date = attrs.get('appointment_date') or (self.instance.appointment_date if self.instance else None)
        appointment_time = attrs.get('appointment_time') or (self.instance.appointment_time if self.instance else None)

        if self.instance and 'status' in attrs:
            from apibackendapp.scheduling import validate_status_transition
            request = self.context.get('request')
            role = request.user.role if request and request.user and request.user.is_authenticated else 'RECEPTIONIST'
            validate_status_transition(self.instance.status, attrs['status'], role)

        if not self.instance or any(f in attrs for f in ('doctor', 'appointment_date', 'appointment_time', 'appointment_type')):
            from apibackendapp.scheduling import validate_appointment_booking
            validate_appointment_booking(
                doctor=doctor,
                patient=patient,
                appointment_type=appointment_type,
                appointment_date=appointment_date,
                appointment_time=appointment_time,
                appointment_id=self.instance.id if self.instance else None,
            )
        return attrs

    def create(self, validated_data):
        from django.db import transaction
        doctor = validated_data['doctor']
        with transaction.atomic():
            DoctorProfile.objects.select_for_update().get(id=doctor.id)
            from apibackendapp.scheduling import validate_appointment_booking
            validate_appointment_booking(
                doctor=doctor,
                patient=validated_data['patient'],
                appointment_type=validated_data.get('appointment_type', 'ADVANCE'),
                appointment_date=validated_data['appointment_date'],
                appointment_time=validated_data['appointment_time'],
            )
            return super().create(validated_data)


class TokenSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source='appointment.patient.__str__', read_only=True
    )
    doctor_name = serializers.CharField(
        source='appointment.doctor.__str__', read_only=True
    )

    class Meta:
        model  = Token
        fields = [
            'id', 'appointment', 'patient_name', 'doctor_name',
            'token_number', 'token_date', 'status', 'created_at',
        ]
        read_only_fields = ['token_number', 'created_at']


# ---------------------------------------------------------------------------
# 4. MASTER DATA (medicines, dosages, lab tests)
# Used by: adminapp (full CRUD)
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
            'id', 'test_code', 'test_name', 'description',
            'normal_range', 'unit', 'price', 'is_active',
        ]


# ---------------------------------------------------------------------------
# 5. STOCK & PRICING
# Used by: adminapp
# ---------------------------------------------------------------------------

class PriceListSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(
        source='medicine.medicine_name', read_only=True
    )

    class Meta:
        model  = PriceList
        fields = [
            'id', 'medicine', 'medicine_name',
            'purchase_price', 'selling_price',
            'effective_from', 'effective_to', 'is_active',
        ]


class StockMasterSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(
        source='medicine.medicine_name', read_only=True
    )

    class Meta:
        model  = StockMaster
        fields = [
            'id', 'medicine', 'medicine_name',
            'batch_number', 'expiry_date',
            'quantity', 'purchase_price', 'selling_price',
            'created_at',
        ]
        read_only_fields = ['created_at']


class StockTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = StockTransaction
        fields = [
            'id', 'stock', 'transaction_type',
            'quantity', 'reference_number',
            'transaction_date', 'notes',
        ]
        read_only_fields = ['transaction_date']


# ---------------------------------------------------------------------------
# 6. CONSULTATION BILLING
# Used by: receptionist (create invoices & payments), adminapp (oversight)
# ---------------------------------------------------------------------------

class ConsultationInvoiceSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source='patient.__str__', read_only=True
    )

    class Meta:
        model  = ConsultationInvoice
        fields = [
            'id', 'invoice_number',
            'patient', 'patient_name',
            'appointment',
            'consultation_fee', 'discount', 'tax', 'total_amount',
            'status', 'created_at',
        ]
        read_only_fields = ['invoice_number', 'patient', 'total_amount', 'created_at']


class ConsultationPaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(
        source='invoice.invoice_number', read_only=True
    )

    class Meta:
        model  = ConsultationPayment
        fields = [
            'id', 'invoice', 'invoice_number',
            'amount', 'payment_method',
            'transaction_id', 'payment_date',
        ]
        read_only_fields = ['payment_date']


# ---------------------------------------------------------------------------
# 7. LAB BILLING
# Used by: adminapp (oversight), lab_tech (future)
# ---------------------------------------------------------------------------

class LabInvoiceSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source='patient.__str__', read_only=True
    )

    class Meta:
        model  = LabInvoice
        fields = [
            'id', 'invoice_number',
            'patient', 'patient_name',
            'lab_order',
            'amount', 'discount', 'total_amount',
            'status', 'created_at',
        ]
        read_only_fields = ['invoice_number', 'patient', 'total_amount', 'created_at']


# ---------------------------------------------------------------------------
# 8. PHARMACY BILLING
# Used by: adminapp (oversight), pharmacy (future)
# ---------------------------------------------------------------------------

class PharmacyInvoiceSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source='patient.__str__', read_only=True
    )

    class Meta:
        model  = PharmacyInvoice
        fields = [
            'id', 'invoice_number',
            'patient', 'patient_name',
            'dispense',
            'subtotal', 'discount', 'tax', 'total_amount',
            'status', 'created_at',
        ]
        read_only_fields = ['invoice_number', 'patient', 'total_amount', 'created_at']
