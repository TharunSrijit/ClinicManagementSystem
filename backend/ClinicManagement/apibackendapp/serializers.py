from datetime import date as date_cls, timedelta
from decimal import Decimal
import re
from django.db import transaction

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
    ClinicConfiguration,
    ConsultationInvoice,
    ConsultationPayment,
    LabInvoice,
    PharmacyInvoice,
    default_doctor_available_days,
)


def _validate_letters_and_spaces(value, field_name):
    if value and any(not character.isalpha() and character != ' ' for character in value):
        raise serializers.ValidationError(
            f'{field_name} may contain letters and spaces only.'
        )
    return value


def validate_letters_only_text(value, field_name):
    if value and (
        not isinstance(value, str)
        or not re.fullmatch(r'[A-Za-z ]+', value)
    ):
        raise serializers.ValidationError(
            f'{field_name} contains letters only.'
        )
    return value


def validate_registration_number(value):
    if value and not re.fullmatch(r'[A-Za-z]{3}-[0-9]+', value):
        raise serializers.ValidationError(
            'Registration number must be 3 letters followed by a hyphen and numbers (for example, REG-1234).'
        )
    return value


def validate_qualification_text(value):
    if value and (
        not isinstance(value, str)
        or not re.fullmatch(r'[A-Za-z., ]+', value)
    ):
        raise serializers.ValidationError(
            'Qualification contains letters, spaces,commas and periods .'
        )
    return value


def _validate_numeric_phone(value):
    if value and not re.fullmatch(r'[0-9]+', value):
        raise serializers.ValidationError('Contact number must contain numbers only.')
    return value


def validate_staff_contact_number(value):
    if value and not re.fullmatch(r'[6-9][0-9]{9}', value):
        raise serializers.ValidationError(
            'Contact number must be exactly 10 digits and start with 6, 7, 8, or 9.'
        )
    return value



# AUTH SERIALIZERS


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

    def validate_first_name(self, value):
        return _validate_letters_and_spaces(value, 'First name')

    def validate_last_name(self, value):
        return _validate_letters_and_spaces(value, 'Last name')

    def validate_phone(self, value):
        return validate_staff_contact_number(value)

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
        username = attrs.get(self.username_field)
        password = attrs.get('password')
        if username and password:
            user = User.objects.filter(**{self.username_field: username}).first()
            if user and user.check_password(password) and not user.is_active:
                raise serializers.ValidationError("User account is deactivated. Please contact an administrator.")
        data = super().validate(attrs)
        data['role']      = self.user.role
        data['username']  = self.user.username
        data['full_name'] = self.user.get_full_name()
        data['user_id']   = self.user.id
        return data



# 1. USER & STAFF PROFILE SERIALIZERS
# Used by: adminapp (CRUD), adminapp/serializers (staff onboarding)

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

    def validate_first_name(self, value):
        role = None
        if hasattr(self, 'initial_data') and hasattr(self.initial_data, 'get'):
            role = self.initial_data.get('role')
        role = role or getattr(self.instance, 'role', None)

        if role == 'DOCTOR' and value:
            # Doctors may start their first name with the title "Dr."
            _validate_letters_and_spaces(
                re.sub(r'^Dr\.[ ]*', '', value, flags=re.IGNORECASE),
                'First name',
            )
            return value
        return _validate_letters_and_spaces(value, 'First name')

    def validate_last_name(self, value):
        return _validate_letters_and_spaces(value, 'Last name')

    def validate_phone(self, value):
        return validate_staff_contact_number(value)

    def validate_password(self, value):
        if value is not None and len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long.")
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
        fields = ['id', 'user', 'full_name', 'email', 'employee_id', 'phone', 'qualification', 'date_of_joining']
        read_only_fields = ['employee_id']

    def validate_qualification(self, value):
        return validate_qualification_text(value)

    def validate_phone(self, value):
        return validate_staff_contact_number(value)


class DoctorProfileSerializer(serializers.ModelSerializer):
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

    def validate_specialization(self, value):
        return validate_letters_only_text(value, 'Specialization')

    def validate_registration_number(self, value):
        return validate_registration_number(value)

    def validate_qualification(self, value):
        return validate_qualification_text(value)


class LabTechnicianProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(
        source='user.get_full_name', read_only=True
    )
    email = serializers.EmailField(
        source='user.email', read_only=True
    )

    class Meta:
        model  = LabTechnicianProfile
        fields = ['id', 'user', 'full_name', 'email', 'employee_id', 'qualification', 'phone', 'date_of_joining']
        read_only_fields = ['employee_id']

    def validate_qualification(self, value):
        return validate_qualification_text(value)

    def validate_phone(self, value):
        return validate_staff_contact_number(value)


class PharmacistProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(
        source='user.get_full_name', read_only=True
    )
    email = serializers.EmailField(
        source='user.email', read_only=True
    )

    class Meta:
        model  = PharmacistProfile
        fields = ['id', 'user', 'full_name', 'email', 'employee_id', 'qualification', 'phone', 'date_of_joining']
        read_only_fields = ['employee_id']

    def validate_qualification(self, value):
        return validate_qualification_text(value)

    def validate_phone(self, value):
        return validate_staff_contact_number(value)



# 2. PATIENT & MEDICAL HISTORY
# Used by: adminapp, receptionist

class PatientSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(max_length=50, required=True, allow_blank=True)
    last_name = serializers.CharField(max_length=50, required=True, allow_blank=True)
    is_existing = serializers.SerializerMethodField()

    def get_is_existing(self, obj):
        from receptionist.views import is_existing_patient
        return is_existing_patient(obj)

    class Meta:
        model  = Patient
        fields = [
            'id', 'patient_id', 'first_name', 'last_name',
            'date_of_birth', 'gender', 'blood_group',
            'phone', 'email', 'address',
            'emergency_contact_name', 'emergency_contact_phone',
            'created_at', 'is_existing',
        ]
        read_only_fields = ['patient_id', 'created_at', 'is_existing']

    def validate_first_name(self, value):
        trimmed = (value or '').strip()
        if len(trimmed) < 2:
            raise serializers.ValidationError("Name must contain at least 2 characters.")
        return value

    def validate_last_name(self, value):
        trimmed = (value or '').strip()
        if len(trimmed) < 2:
            raise serializers.ValidationError("Name must contain at least 2 characters.")
        return value

    def validate_date_of_birth(self, value):
        if value:
            from django.utils import timezone
            today = timezone.localdate()
            if value > today:
                raise serializers.ValidationError("Date of birth cannot be in the future.")
        return value


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



# 3. APPOINTMENTS & TOKENS
# Used by: adminapp, receptionist


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source='patient.__str__', read_only=True
    )
    doctor_name = serializers.CharField(
        source='doctor.__str__', read_only=True
    )
    appointment_time = serializers.TimeField(required=True)
    token_number = serializers.SerializerMethodField()
    token_status = serializers.SerializerMethodField()
    token_id = serializers.SerializerMethodField()
    invoice_id = serializers.SerializerMethodField()
    invoice_number = serializers.SerializerMethodField()
    invoice_status = serializers.SerializerMethodField()
    consultation_fee = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()
    is_paid = serializers.SerializerMethodField()
    arrival_status = serializers.SerializerMethodField()
    is_existing_patient = serializers.BooleanField(required=False, write_only=True)
    is_new_patient = serializers.BooleanField(required=False, write_only=True)

    def get_token_number(self, obj):
        if hasattr(obj, 'token') and obj.token:
            return obj.token.token_number
        return None

    def get_token_status(self, obj):
        if hasattr(obj, 'token') and obj.token:
            return obj.token.status
        return None

    def get_token_id(self, obj):
        if hasattr(obj, 'token') and obj.token:
            return obj.token.id
        return None

    def get_invoice_id(self, obj):
        inv = getattr(obj, 'consultation_invoice', None)
        return inv.id if inv else None

    def get_invoice_number(self, obj):
        inv = getattr(obj, 'consultation_invoice', None)
        return inv.invoice_number if inv else None

    def get_invoice_status(self, obj):
        inv = getattr(obj, 'consultation_invoice', None)
        return inv.status if inv else None

    def get_consultation_fee(self, obj):
        inv = getattr(obj, 'consultation_invoice', None)
        if inv:
            return str(inv.consultation_fee)
        if obj.doctor:
            return str(obj.doctor.consultation_fee)
        return "0.00"

    def get_total_amount(self, obj):
        inv = getattr(obj, 'consultation_invoice', None)
        if inv:
            return str(inv.total_amount)
        if obj.doctor:
            return str(obj.doctor.consultation_fee)
        return "0.00"

    def get_is_paid(self, obj):
        inv = getattr(obj, 'consultation_invoice', None)
        return bool(inv and inv.status == 'PAID')

    def get_arrival_status(self, obj):
        return 'ARRIVED' if obj.status == 'CONFIRMED' else obj.status

    class Meta:
        model  = Appointment
        fields = [
            'id', 'patient', 'patient_name',
            'doctor', 'doctor_name',
            'appointment_type', 'visit_category',
            'appointment_date', 'appointment_time',
            'reason', 'status',
            'token_number', 'token_status', 'token_id',
            'invoice_id', 'invoice_number', 'invoice_status',
            'consultation_fee', 'total_amount', 'is_paid', 'arrival_status',
            'is_existing_patient', 'is_new_patient',
            'created_at',
        ]
        read_only_fields = [
            'created_at', 'token_number', 'token_status', 'token_id',
            'invoice_id', 'invoice_number', 'invoice_status',
            'consultation_fee', 'total_amount', 'is_paid', 'arrival_status',
        ]

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
        is_existing_flag = validated_data.pop('is_existing_patient', None)
        is_new_flag = validated_data.pop('is_new_patient', None)
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
            instance = super().create(validated_data)
            if is_existing_flag is not None:
                instance.is_existing_patient = is_existing_flag
            if is_new_flag is not None:
                instance.is_new_patient = is_new_flag
            return instance


class TokenSerializer(serializers.ModelSerializer):
    patient_id = serializers.SerializerMethodField()
    patient_name = serializers.SerializerMethodField()
    doctor_id = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()
    appointment_type = serializers.CharField(
        source='appointment.appointment_type', read_only=True
    )
    appointment_time = serializers.TimeField(
        source='appointment.appointment_time', read_only=True
    )
    token_date = serializers.DateField(required=False)

    class Meta:
        model  = Token
        fields = [
            'id', 'appointment', 'patient_id', 'patient_name',
            'doctor_id', 'doctor_name',
            'appointment_type', 'appointment_time',
            'token_number', 'token_date', 'status', 'created_at',
        ]
        read_only_fields = ['token_number', 'created_at']

    def get_patient_id(self, obj):
        if obj.appointment and obj.appointment.patient:
            return obj.appointment.patient.patient_id or f"PAT{obj.appointment.patient.id:04d}"
        return None

    def get_patient_name(self, obj):
        if obj.appointment and obj.appointment.patient:
            p = obj.appointment.patient
            full_name = f"{p.first_name} {p.last_name}".strip()
            return full_name or str(p)
        return ""

    def get_doctor_id(self, obj):
        if obj.appointment and obj.appointment.doctor_id:
            return obj.appointment.doctor_id
        return None

    def get_doctor_name(self, obj):
        if obj.appointment and obj.appointment.doctor:
            return str(obj.appointment.doctor)
        return "Not Assigned"



# 4. MASTER DATA (medicines, dosages, lab tests)
# Used by: adminapp (full CRUD)


class MasterDosageSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MasterDosage
        fields = ['id', 'dosage_name', 'description']


class InitialStockBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockMaster
        fields = [
            'batch_number', 'expiry_date', 'quantity',
            'purchase_price', 'selling_price',
        ]

    def validate_expiry_date(self, value):
        if value:
            min_date = date_cls.today() + timedelta(days=15)
            if value < min_date:
                raise serializers.ValidationError(
                    f'Expiry date must be at least 15 calendar days from today (on or after {min_date.isoformat()}).'
                )
        return value


class MasterMedicineSerializer(serializers.ModelSerializer):
    stock_level = serializers.SerializerMethodField()
    stock_quantity = serializers.SerializerMethodField()
    expiry_date = serializers.SerializerMethodField()
    batch_number = serializers.SerializerMethodField()
    selling_price = serializers.SerializerMethodField()
    purchase_price = serializers.SerializerMethodField()
    initial_stock = InitialStockBatchSerializer(write_only=True, required=False)

    class Meta:
        model  = MasterMedicine
        fields = [
            'id', 'medicine_name', 'generic_name',
            'manufacturer', 'category', 'unit',
            'description', 'is_active', 'reorder_level',
            'stock_level', 'stock_quantity', 'expiry_date',
            'batch_number', 'selling_price', 'purchase_price',
            'initial_stock',
        ]

    def validate_generic_name(self, value):
        trimmed = (value or '').strip()
        if len(trimmed) < 2:
            raise serializers.ValidationError(
                'Medicine name must contain at least 2 characters.'
            )
        if trimmed and trimmed[0].isdigit():
            raise serializers.ValidationError(
                'Medicine name must not start with a number.'
            )
        return value

    def validate_medicine_name(self, value):
        if value is not None:
            trimmed = (value or '').strip()
            if len(trimmed) < 2:
                raise serializers.ValidationError(
                    'Medicine name must contain at least 2 characters.'
                )
        return value

    def get_stock_level(self, obj):
        return sum(batch.quantity for batch in obj.stock.all())

    def get_stock_quantity(self, obj):
        return self.get_stock_level(obj)

    def get_expiry_date(self, obj):
        expiries = [batch.expiry_date for batch in obj.stock.all()]
        return min(expiries).isoformat() if expiries else None

    def get_batch_number(self, obj):
        latest = obj.stock.order_by('-created_at').first()
        return latest.batch_number if latest else None

    def get_selling_price(self, obj):
        latest = obj.stock.order_by('-created_at').first()
        return str(latest.selling_price) if latest else None

    def get_purchase_price(self, obj):
        latest = obj.stock.order_by('-created_at').first()
        return str(latest.purchase_price) if latest else None

    @transaction.atomic
    def create(self, validated_data):
        initial_stock = validated_data.pop('initial_stock', None)
        medicine = super().create(validated_data)
        if initial_stock:
            StockMaster.objects.create(medicine=medicine, **initial_stock)
        return medicine


class MasterLabTestSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MasterLabTest
        fields = [
            'id', 'test_code', 'test_name', 'category', 'description',
            'normal_range', 'unit', 'price', 'is_active',
        ]
        extra_kwargs = {
            'category': {'required': True},
            'unit': {'required': True},
        }

    def validate_test_code(self, value):
        if not re.fullmatch(r'[A-Za-z]+[0-9]+', value):
            raise serializers.ValidationError(
                'Test code must start with a letter and include numbers after it (for example, cg12 or CBC01).'
            )
        return value

    def validate_test_name(self, value):
        trimmed = (value or '').strip()
        if len(trimmed) < 2:
            raise serializers.ValidationError(
                'Test name must contain at least 2 characters.'
            )
        if not re.fullmatch(r'[A-Za-z0-9]+(?: [A-Za-z0-9]+)*', trimmed):
            raise serializers.ValidationError(
                'Test name may contain only letters, numbers, and spaces.'
            )
        return value

    def validate_category(self, value):
        if not re.fullmatch(r'[A-Za-z0-9]+(?: [A-Za-z0-9]+)*', value):
            raise serializers.ValidationError(
                'Category may contain only letters, numbers, and spaces.'
            )
        return value

    def validate_normal_range(self, value):
        if value and not re.fullmatch(
            r'[0-9]+(?:\.[0-9]+)?(?: *- *[0-9]+(?:\.[0-9]+)?)?',
            value,
        ):
            raise serializers.ValidationError(
                'Reference range may contain only numbers, decimals, and a hyphen between values.'
            )
        return value

    def validate_unit(self, value):
        allowed_units = {'ng/mL', 'mg/L', 'mmol/L', 'cells/µL'}
        if value not in allowed_units:
            raise serializers.ValidationError(
                'Choose one of the allowed units: ng/mL, mg/L, mmol/L, or cells/µL.'
            )
        return value



# 5. STOCK & PRICING
# Used by: adminapp


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
    reorder_level = serializers.IntegerField(source='medicine.reorder_level', read_only=True)

    class Meta:
        model  = StockMaster
        fields = [
            'id', 'medicine', 'medicine_name',
            'batch_number', 'expiry_date',
            'quantity', 'reorder_level', 'purchase_price', 'selling_price',
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




# 6. CLINIC CONFIGURATION & CONSULTATION BILLING
# Used by: receptionist (create invoices & payments), adminapp (oversight)


class ClinicConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClinicConfiguration
        fields = [
            'id', 'clinic_name', 'clinic_address',
            'clinic_phone', 'clinic_email',
            'registration_fee', 'updated_at',
        ]


class ConsultationInvoiceSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source='patient.__str__', read_only=True
    )
    patient_id = serializers.CharField(
        source='patient.patient_id', read_only=True
    )
    patient_phone = serializers.CharField(
        source='patient.phone', read_only=True
    )
    patient_gender = serializers.CharField(
        source='patient.gender', read_only=True
    )
    doctor_name = serializers.SerializerMethodField()
    doctor_specialization = serializers.SerializerMethodField()
    appointment_date = serializers.SerializerMethodField()
    appointment_time = serializers.SerializerMethodField()
    amount_paid = serializers.SerializerMethodField()
    balance_due = serializers.SerializerMethodField()
    payments = serializers.SerializerMethodField()
    clinic_info = serializers.SerializerMethodField()

    def get_doctor_name(self, obj):
        if obj.appointment and obj.appointment.doctor:
            return str(obj.appointment.doctor)
        if obj.consultation and obj.consultation.doctor:
            return str(obj.consultation.doctor)
        return '—'

    def get_doctor_specialization(self, obj):
        doc = None
        if obj.appointment and obj.appointment.doctor:
            doc = obj.appointment.doctor
        elif obj.consultation and obj.consultation.doctor:
            doc = obj.consultation.doctor
        return doc.specialization if doc else ''

    def get_appointment_date(self, obj):
        if obj.appointment and obj.appointment.appointment_date:
            return str(obj.appointment.appointment_date)
        if obj.consultation and getattr(obj.consultation, 'consultation_date', None):
            return str(obj.consultation.consultation_date.date())
        if getattr(obj, 'created_at', None):
            return str(obj.created_at.date())
        return None

    def get_appointment_time(self, obj):
        if obj.appointment and obj.appointment.appointment_time:
            return str(obj.appointment.appointment_time)
        if obj.consultation and getattr(obj.consultation, 'consultation_date', None):
            return obj.consultation.consultation_date.strftime('%H:%M:%S')
        return None

    def get_amount_paid(self, obj):
        paid = sum(p.amount for p in obj.payments.all())
        return f"{paid:.2f}"

    def get_balance_due(self, obj):
        paid = sum(p.amount for p in obj.payments.all())
        balance = obj.total_amount - paid
        return f"{max(Decimal('0.00'), balance):.2f}"

    def get_payments(self, obj):
        payments_qs = obj.payments.all().order_by('-payment_date')
        return [
            {
                'id': p.id,
                'amount': str(p.amount),
                'payment_method': p.payment_method,
                'transaction_id': p.transaction_id,
                'payment_date': p.payment_date.isoformat(),
            }
            for p in payments_qs
        ]

    def get_clinic_info(self, obj):
        cfg = ClinicConfiguration.get_instance()
        return {
            'clinic_name': cfg.clinic_name,
            'name': cfg.clinic_name,
            'clinic_address': cfg.clinic_address,
            'address': cfg.clinic_address,
            'clinic_phone': cfg.clinic_phone,
            'phone': cfg.clinic_phone,
            'clinic_email': cfg.clinic_email,
            'email': cfg.clinic_email,
        }

    class Meta:
        model = ConsultationInvoice
        fields = [
            'id', 'invoice_number',
            'patient', 'patient_id', 'patient_name', 'patient_phone', 'patient_gender',
            'appointment', 'consultation',
            'doctor_name', 'doctor_specialization',
            'appointment_date', 'appointment_time',
            'consultation_fee', 'registration_fee',
            'discount', 'tax', 'total_amount',
            'amount_paid', 'balance_due',
            'status', 'created_at',
            'payments', 'clinic_info',
        ]
        read_only_fields = ['invoice_number', 'patient', 'total_amount', 'created_at']


class ConsultationPaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(
        source='invoice.invoice_number', read_only=True
    )

    def validate_amount(self, value):
        if value <= Decimal('0.00'):
            raise serializers.ValidationError("Payment amount must be greater than zero.")
        return value

    class Meta:
        model = ConsultationPayment
        fields = [
            'id', 'invoice', 'invoice_number',
            'amount', 'payment_method',
            'transaction_id', 'payment_date',
        ]
        read_only_fields = ['payment_date']



# 7. LAB BILLING
# Used by: adminapp (oversight), lab_tech (future)


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



# 8. PHARMACY BILLING
# Used by: adminapp (oversight), pharmacy (future)

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