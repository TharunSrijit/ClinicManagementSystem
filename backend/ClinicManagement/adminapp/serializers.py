import re
from django.db import transaction
from rest_framework import serializers

from apibackendapp.models import (
    User,
    ReceptionistProfile,
    DoctorProfile,
    LabTechnicianProfile,
    PharmacistProfile,
    Specialization,
    default_doctor_available_days,
    validate_date_of_joining_not_future,
)
from django.core.exceptions import ValidationError as DjangoValidationError


def _name_validation_error(value, allow_doctor_title=False):
    if allow_doctor_title and value:
        # Doctors may start their first name with the title "Dr."
        value = re.sub(r'^Dr\.[ ]*', '', value, flags=re.IGNORECASE)
    if value and any(not character.isalpha() and character != ' ' for character in value):
        return 'Name may contain letters and spaces only.'
    return None


def _phone_validation_error(value):
    if value:
        try:
            validate_staff_contact_number(value)
        except serializers.ValidationError as error:
            return error.detail
    return None


from apibackendapp.serializers import (
    UserSerializer,
    ReceptionistProfileSerializer,
    DoctorProfileSerializer,
    LabTechnicianProfileSerializer,
    PharmacistProfileSerializer,
    validate_letters_only_text,
    validate_registration_number,
    validate_staff_contact_number,
    validate_qualification_text,
)


# ============================================================================
# STAFF ONBOARDING
# ----------------------------------------------------------------------------
# Lets an Admin create a User + their role profile (Doctor/Receptionist/
# LabTechnician/Pharmacist) in a single request instead of two separate
# API calls.
# ============================================================================

class AdminStaffCreateSerializer(serializers.Serializer):
    STAFF_ROLE_CHOICES = [
        c for c in User.ROLE_CHOICES if c[0] != 'ADMIN'
    ]

    ROLE_REQUIRED_PROFILE_FIELDS = {
        'RECEPTIONIST': ['phone'],
        'LAB_TECHNICIAN': ['qualification', 'phone'],
        'PHARMACIST': ['qualification', 'phone'],
        'DOCTOR': ['doctor_id', 'specialization', 'qualification', 'registration_number'],
    }

    role = serializers.ChoiceField(choices=STAFF_ROLE_CHOICES)
    existing_user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, write_only=True
    )
    username = serializers.CharField(required=False)
    password = serializers.CharField(write_only=True, required=False)
    first_name = serializers.CharField(required=False, allow_blank=True, default='')
    last_name = serializers.CharField(required=False, allow_blank=True, default='')
    email = serializers.EmailField(required=False, allow_blank=True, default=None)
    phone = serializers.CharField(required=False, allow_blank=True, default='')

    # Role-specific fields, e.g.:
    #   RECEPTIONIST/LAB_TECHNICIAN/PHARMACIST: employee_id, qualification, phone
    #   DOCTOR: doctor_id, specialization, qualification, registration_number,
    #           consultation_fee, available_from, available_to, slot_minutes
    profile = serializers.DictField(write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_email(self, value):
        if value == '' or value is None:
            return None
        return value

    def validate_password(self, value):
        if value is not None and len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long.")
        return value

    def validate(self, attrs):
        role = attrs['role']
        profile = attrs.get('profile') or {}
        field_errors = {}
        for name_field in ('first_name', 'last_name'):
            error = _name_validation_error(attrs.get(name_field, ''),
               allow_doctor_title=(role =='DOCTOR' and name_field =='first_name'),
            )                            
            if error:
                field_errors[name_field] = error
        for phone_field in ('phone',):
            error = _phone_validation_error(attrs.get(phone_field, ''))
            if error:
                field_errors[phone_field] = error

        profile_phone_field = 'contact_number' if role == 'DOCTOR' else 'phone'
        if profile_phone_field in profile:
            error = _phone_validation_error(profile[profile_phone_field])
            if error:
                field_errors.setdefault('profile', {})[profile_phone_field] = error
        if profile.get('specialization'):
            try:
                validate_letters_only_text(profile['specialization'], 'Specialization')
            except serializers.ValidationError as error:
                field_errors.setdefault('profile', {})['specialization'] = error.detail
        if profile.get('qualification'):
            try:
                validate_qualification_text(profile['qualification'])
            except serializers.ValidationError as error:
                field_errors.setdefault('profile', {})['qualification'] = error.detail
        if field_errors:
            raise serializers.ValidationError(field_errors)

        required = self.ROLE_REQUIRED_PROFILE_FIELDS[role]
        missing = [field for field in required if not profile.get(field)]

        if missing:
            raise serializers.ValidationError({
                'profile': f"Missing required field(s) for {role}: {', '.join(missing)}"
            })

        if profile.get('date_of_joining') not in (None, ''):
            date_of_joining = serializers.DateField().run_validation(
                profile['date_of_joining']
            )
            try:
                validate_date_of_joining_not_future(date_of_joining)
            except DjangoValidationError as error:
                raise serializers.ValidationError({
                    'profile': {'date_of_joining': error.messages}
                }) from error
            profile['date_of_joining'] = date_of_joining

        existing_user = attrs.get('existing_user')
        if existing_user:
            if existing_user.role != role:
                raise serializers.ValidationError({
                    'existing_user': f"Selected account must have the {role} role."
                })
            profile_models = {
                'RECEPTIONIST': ReceptionistProfile,
                'DOCTOR': DoctorProfile,
                'LAB_TECHNICIAN': LabTechnicianProfile,
                'PHARMACIST': PharmacistProfile,
            }
            if profile_models[role].objects.filter(user=existing_user).exists():
                raise serializers.ValidationError({
                    'existing_user': 'This account already has a staff profile.'
                })
        else:
            account_errors = {}
            if not attrs.get('username'):
                account_errors['username'] = 'This field is required for a new account.'
            if not attrs.get('password'):
                account_errors['password'] = 'This field is required for a new account.'
            elif len(attrs['password']) < 8:
                account_errors['password'] = 'Password must be at least 8 characters long.'
            if account_errors:
                raise serializers.ValidationError(account_errors)

        return attrs

    def create(self, validated_data):
        profile_data = validated_data.pop('profile')
        existing_user = validated_data.pop('existing_user', None)
        password = validated_data.pop('password', None)
        role = validated_data['role']

        with transaction.atomic():
            if existing_user:
                user = existing_user
            else:
                if validated_data.get('email') == '':
                    validated_data['email'] = None
                user = User(**validated_data)
                user.set_password(password)
                user.is_staff = True
                user.save()

            if role == 'RECEPTIONIST':
                profile = ReceptionistProfile.objects.create(
                    user=user,
                    employee_id=self._employee_id(ReceptionistProfile, 'REC', user),
                    phone=profile_data['phone'],
                    qualification=profile_data.get('qualification', ''),
                    date_of_joining=profile_data.get('date_of_joining') or None,
                )
                profile_serializer = ReceptionistProfileSerializer(profile)

            elif role == 'DOCTOR':
                if profile_data.get('contact_number') is not None:
                    user.phone = profile_data['contact_number']
                    user.save(update_fields=['phone'])
                profile = DoctorProfile.objects.create(
                    user=user,
                    doctor_id=profile_data['doctor_id'],
                    specialization=profile_data['specialization'],
                    qualification=profile_data['qualification'],
                    date_of_joining=profile_data.get('date_of_joining') or None,
                    registration_number=profile_data['registration_number'],
                    consultation_fee=profile_data.get('consultation_fee') or 0,
                    available_from=profile_data.get('available_from') or None,
                    available_to=profile_data.get('available_to') or None,
                    slot_minutes=profile_data.get('slot_minutes') or 15,
                )
                profile_serializer = DoctorProfileSerializer(profile)

            elif role == 'LAB_TECHNICIAN':
                profile = LabTechnicianProfile.objects.create(
                    user=user,
                    employee_id=self._employee_id(LabTechnicianProfile, 'LAB', user),
                    qualification=profile_data['qualification'],
                    phone=profile_data['phone'],
                    date_of_joining=profile_data.get('date_of_joining') or None,
                )
                profile_serializer = LabTechnicianProfileSerializer(profile)

            else:  # PHARMACIST
                profile = PharmacistProfile.objects.create(
                    user=user,
                    employee_id=self._employee_id(PharmacistProfile, 'PHARM', user),
                    qualification=profile_data['qualification'],
                    phone=profile_data['phone'],
                    date_of_joining=profile_data.get('date_of_joining') or None,
                )
                profile_serializer = PharmacistProfileSerializer(profile)

        return {
            'user': UserSerializer(user).data,
            'profile': profile_serializer.data,
        }

    @staticmethod
    def _employee_id(profile_model, prefix, user):
        base_id = f'{prefix}{user.pk:04d}'
        employee_id = base_id
        suffix = 1
        while profile_model.objects.filter(employee_id=employee_id).exists():
            employee_id = f'{base_id}-{suffix}'
            suffix += 1
        return employee_id


class AdminDoctorProfileSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role='DOCTOR')
    )
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    contact_number = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=15,
        write_only=True,
    )
    is_active = serializers.BooleanField(source='user.is_active', read_only=True)
    available_days = serializers.ListField(
        child=serializers.ChoiceField(
            choices=('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN')
        ),
        allow_empty=False,
        required=False,
        default=default_doctor_available_days,
    )

    class Meta:
        model = DoctorProfile
        fields = [
            'id', 'user', 'doctor_id', 'full_name', 'email', 'is_active',
            'specialization', 'qualification', 'registration_number',
            'date_of_joining', 'contact_number', 'consultation_fee', 'available_from', 'available_to',
            'available_days', 'slot_minutes',
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

    def validate_contact_number(self, value):
        error = _phone_validation_error(value)
        if error:
            raise serializers.ValidationError(error)
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['contact_number'] = instance.user.phone
        return data

    def validate_user(self, value):
        profiles = DoctorProfile.objects.filter(user=value)
        if self.instance:
            profiles = profiles.exclude(pk=self.instance.pk)
        if profiles.exists():
            raise serializers.ValidationError('This doctor already has a profile.')
        return value

    def create(self, validated_data):
        contact_number = validated_data.pop('contact_number', None)
        user = validated_data['user']
        doctor_id = f'DOC{user.pk:04d}'
        suffix = 1
        while DoctorProfile.objects.filter(doctor_id=doctor_id).exists():
            doctor_id = f'DOC{user.pk:04d}-{suffix}'
            suffix += 1

        validated_data['doctor_id'] = doctor_id
        profile = super().create(validated_data)
        if contact_number is not None:
            user.phone = contact_number
            user.save(update_fields=['phone'])
        return profile

    def update(self, instance, validated_data):
        contact_number = validated_data.pop('contact_number', None)
        profile = super().update(instance, validated_data)
        if contact_number is not None:
            profile.user.phone = contact_number
            profile.user.save(update_fields=['phone'])
        return profile


class SpecializationSerializer(serializers.ModelSerializer):
    doctors_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Specialization
        fields = [
            'id', 'name', 'description', 'is_active',
            'created_at', 'updated_at', 'doctors_count',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'doctors_count']

    def get_doctors_count(self, obj):
        return DoctorProfile.objects.filter(specialization__iexact=obj.name).count()

    def validate_name(self, value):
        trimmed = (value or '').strip()
        if not trimmed:
            raise serializers.ValidationError('Specialization name cannot be empty.')
        if len(trimmed) < 2:
            raise serializers.ValidationError('Specialization name must contain at least 2 characters.')
        if not re.fullmatch(r'[A-Za-z &,-]+', trimmed):
            raise serializers.ValidationError('Specialization name contains letters only.')
        qs = Specialization.objects.filter(name__iexact=trimmed)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A specialization with this name already exists.')
        return trimmed


# ============================================================================
# DASHBOARD
# ============================================================================

class RevenueBreakdownSerializer(serializers.Serializer):
    consultation = serializers.DecimalField(max_digits=12, decimal_places=2)
    lab = serializers.DecimalField(max_digits=12, decimal_places=2)
    pharmacy = serializers.DecimalField(max_digits=12, decimal_places=2)


class DashboardStatsSerializer(serializers.Serializer):
    total_users = serializers.IntegerField(required=False)
    total_patients = serializers.IntegerField()
    total_doctors = serializers.IntegerField()
    total_receptionists = serializers.IntegerField()
    total_lab_technicians = serializers.IntegerField()
    total_pharmacists = serializers.IntegerField()

    appointments_today = serializers.IntegerField()
    appointments_pending = serializers.IntegerField()

    pending_consultation_invoices = serializers.IntegerField()
    pending_lab_invoices = serializers.IntegerField()
    pending_pharmacy_invoices = serializers.IntegerField()

    revenue_this_month = RevenueBreakdownSerializer()
    consultation_revenue = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    low_stock_items = serializers.IntegerField()