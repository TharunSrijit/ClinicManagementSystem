from django.db import transaction
from rest_framework import serializers

from apibackendapp.models import (
    User,
    ReceptionistProfile,
    DoctorProfile,
    LabTechnicianProfile,
    PharmacistProfile,
)

from apibackendapp.serializers import (
    UserSerializer,
    ReceptionistProfileSerializer,
    DoctorProfileSerializer,
    LabTechnicianProfileSerializer,
    PharmacistProfileSerializer,
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
        'RECEPTIONIST': ['employee_id', 'phone'],
        'LAB_TECHNICIAN': ['employee_id', 'qualification', 'phone'],
        'PHARMACIST': ['employee_id', 'qualification', 'phone'],
        'DOCTOR': ['doctor_id', 'specialization', 'qualification', 'registration_number'],
    }

    role = serializers.ChoiceField(choices=STAFF_ROLE_CHOICES)
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=False, allow_blank=True, default='')
    last_name = serializers.CharField(required=False, allow_blank=True, default='')
    email = serializers.EmailField()
    phone = serializers.CharField(required=False, allow_blank=True, default='')

    # Role-specific fields, e.g.:
    #   RECEPTIONIST/LAB_TECHNICIAN/PHARMACIST: employee_id, qualification, phone
    #   DOCTOR: doctor_id, specialization, qualification, registration_number,
    #           consultation_fee, available_from, available_to
    profile = serializers.DictField(write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate(self, attrs):
        role = attrs['role']
        profile = attrs.get('profile') or {}
        required = self.ROLE_REQUIRED_PROFILE_FIELDS[role]
        missing = [field for field in required if not profile.get(field)]

        if missing:
            raise serializers.ValidationError({
                'profile': f"Missing required field(s) for {role}: {', '.join(missing)}"
            })

        return attrs

    def create(self, validated_data):
        profile_data = validated_data.pop('profile')
        password = validated_data.pop('password')
        role = validated_data['role']

        with transaction.atomic():
            user = User(**validated_data)
            user.set_password(password)
            user.is_staff = True
            user.save()

            if role == 'RECEPTIONIST':
                profile = ReceptionistProfile.objects.create(
                    user=user,
                    employee_id=profile_data['employee_id'],
                    phone=profile_data['phone'],
                )
                profile_serializer = ReceptionistProfileSerializer(profile)

            elif role == 'DOCTOR':
                profile = DoctorProfile.objects.create(
                    user=user,
                    doctor_id=profile_data['doctor_id'],
                    specialization=profile_data['specialization'],
                    qualification=profile_data['qualification'],
                    registration_number=profile_data['registration_number'],
                    consultation_fee=profile_data.get('consultation_fee') or 0,
                    available_from=profile_data.get('available_from') or None,
                    available_to=profile_data.get('available_to') or None,
                )
                profile_serializer = DoctorProfileSerializer(profile)

            elif role == 'LAB_TECHNICIAN':
                profile = LabTechnicianProfile.objects.create(
                    user=user,
                    employee_id=profile_data['employee_id'],
                    qualification=profile_data['qualification'],
                    phone=profile_data['phone'],
                )
                profile_serializer = LabTechnicianProfileSerializer(profile)

            else:  # PHARMACIST
                profile = PharmacistProfile.objects.create(
                    user=user,
                    employee_id=profile_data['employee_id'],
                    qualification=profile_data['qualification'],
                    phone=profile_data['phone'],
                )
                profile_serializer = PharmacistProfileSerializer(profile)

        return {
            'user': UserSerializer(user).data,
            'profile': profile_serializer.data,
        }


# ============================================================================
# DASHBOARD
# ============================================================================

class RevenueBreakdownSerializer(serializers.Serializer):
    consultation = serializers.DecimalField(max_digits=12, decimal_places=2)
    lab = serializers.DecimalField(max_digits=12, decimal_places=2)
    pharmacy = serializers.DecimalField(max_digits=12, decimal_places=2)


class DashboardStatsSerializer(serializers.Serializer):
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
    low_stock_items = serializers.IntegerField()