from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apibackendapp.permissions import IsDoctor

from apibackendapp.models import (
    DoctorProfile,
    Appointment,
    Consultation,
    Prescription,
    PrescriptionItem,
    MasterMedicine,
    MasterDosage,
    MasterLabTest,
    LabTestOrder,
    LabTestResult,
    Patient,
    MedicalHistory,
)

from .serializers import (
    DoctorProfileSerializer,
    AppointmentSerializer,
    ConsultationSerializer,
    PrescriptionSerializer,
    PrescriptionItemSerializer,
    MasterMedicineSerializer,
    MasterDosageSerializer,
    MasterLabTestSerializer,
    LabTestOrderSerializer,
    LabTestResultSerializer,
    PatientSerializer,
    MedicalHistorySerializer,
)



# ---------------------------------------------------------------------------
# Helper — get the DoctorProfile of the currently logged-in user
# ---------------------------------------------------------------------------

def get_doctor_profile(request):
    """Returns the DoctorProfile for the logged-in user, or None."""
    try:
        return request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return None


# ============================================================================
# DOCTOR PROFILE
# ============================================================================

class DoctorProfileView(viewsets.ModelViewSet):
    """
    Allows the logged-in doctor to view and update their own profile only.
    """
    serializer_class = DoctorProfileSerializer
    permission_classes = [IsDoctor]

    def get_queryset(self):
        return DoctorProfile.objects.filter(user=self.request.user)


# ============================================================================
# APPOINTMENTS
# ============================================================================

class DoctorAppointmentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Doctor can view only their own appointments (read-only).
    Explicit actions: complete (only from CONFIRMED) and no-show.
    Doctor cannot create or edit appointments directly.
    Supports filtering by ?status= and ?date=YYYY-MM-DD.
    """
    serializer_class = AppointmentSerializer
    permission_classes = [IsDoctor]

    def get_queryset(self):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            return Appointment.objects.none()

        queryset = Appointment.objects.filter(doctor=doctor).select_related(
            'patient', 'doctor', 'receptionist'
        )

        status_param = self.request.query_params.get('status')
        date_param = self.request.query_params.get('date')
        patient_param = self.request.query_params.get('patient')

        if status_param:
            queryset = queryset.filter(status=status_param)

        if date_param:
            queryset = queryset.filter(appointment_date=date_param)

        if patient_param:
            queryset = queryset.filter(patient_id=patient_param)

        return queryset

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """POST /appointments/{id}/complete/ — complete appointment from CONFIRMED."""
        appointment = self.get_object()
        from apibackendapp.scheduling import validate_status_transition, SchedulingValidationError
        try:
            validate_status_transition(appointment.status, 'COMPLETED', request.user.role)
        except SchedulingValidationError as e:
            msg = e.detail if hasattr(e, 'detail') else str(e)
            return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)

        appointment.status = 'COMPLETED'
        appointment.save(update_fields=['status'])
        return Response(self.get_serializer(appointment).data)


# ============================================================================
# CONSULTATION
# ============================================================================

class DoctorConsultationViewSet(viewsets.ModelViewSet):
    """
    Doctor can create and view consultations for their own patients.
    Supports filtering by ?patient=<id>.
    """
    serializer_class = ConsultationSerializer
    permission_classes = [IsDoctor]

    def get_queryset(self):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            return Consultation.objects.none()

        queryset = Consultation.objects.filter(doctor=doctor).select_related(
            'patient', 'doctor', 'appointment'
        )

        patient = self.request.query_params.get('patient')
        if patient:
            queryset = queryset.filter(patient_id=patient)

        return queryset

    def perform_create(self, serializer):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            raise serializers.ValidationError({"detail": "Doctor profile required."})

        visit_type = serializer.validated_data.get('visit_type', 'TOKEN_BASED')
        appointment = serializer.validated_data.get('appointment')
        patient = serializer.validated_data.get('patient')

        if visit_type == 'UNSCHEDULED':
            # WORKFLOW B: UNSCHEDULED / TOKENLESS CONSULTATION
            if not patient:
                raise serializers.ValidationError({"patient": "Patient is required for an unscheduled consultation."})
            if appointment is not None:
                raise serializers.ValidationError({"appointment": "Unscheduled consultations must not have an appointment."})

            existing_active = Consultation.objects.filter(
                doctor=doctor,
                patient=patient,
                status='IN_PROGRESS'
            ).first()
            if existing_active:
                raise serializers.ValidationError({
                    "detail": f"An active unscheduled consultation (#{existing_active.id}) is already in progress for this patient."
                })

            with transaction.atomic():
                consultation = serializer.save(
                    doctor=doctor,
                    patient=patient,
                    appointment=None,
                    visit_type='UNSCHEDULED',
                    status=serializer.validated_data.get('status', 'COMPLETED')
                )
                from apibackendapp.models import ConsultationInvoice
                from receptionist.views import generate_invoice_number
                fee = doctor.consultation_fee
                ConsultationInvoice.objects.create(
                    invoice_number=generate_invoice_number(),
                    patient=patient,
                    consultation=consultation,
                    consultation_fee=fee,
                    total_amount=fee,
                    status='PENDING'
                )
        else:
            # WORKFLOW A: TOKEN-BASED CONSULTATION
            if not appointment:
                raise serializers.ValidationError({"appointment": "Appointment is required."})
            if appointment.doctor != doctor:
                raise serializers.ValidationError({"appointment": "This appointment does not belong to you."})
            if appointment.status in ['CANCELLED', 'NO_SHOW']:
                raise serializers.ValidationError({"appointment": "Cannot create consultation for a cancelled appointment."})
            if patient and appointment.patient != patient:
                raise serializers.ValidationError({"patient": "Patient does not match the appointment patient."})

            # Token validation
            if not hasattr(appointment, 'token') or not appointment.token:
                raise serializers.ValidationError({
                    "token": "A valid queue token is required for a token-based consultation. Patient must check in at reception first."
                })
            if appointment.token.status == 'CANCELLED':
                raise serializers.ValidationError({"token": "Cannot start consultation with a cancelled token."})

            # Prevent duplicate consultation for same appointment
            if hasattr(appointment, 'consultation') and appointment.consultation:
                raise serializers.ValidationError({"appointment": "A consultation has already been recorded for this appointment."})

            with transaction.atomic():
                serializer.save(
                    doctor=doctor,
                    patient=appointment.patient,
                    appointment=appointment,
                    visit_type='TOKEN_BASED',
                    status=serializer.validated_data.get('status', 'COMPLETED')
                )

    @action(detail=False, methods=['post'])
    def start_unscheduled(self, request):
        """
        POST /api/doctor/consultations/start_unscheduled/
        Doctor explicitly initiates an unscheduled consultation for a registered patient without a token.
        Body: { patient: <id>, visit_reason: "..." }
        """
        doctor = get_doctor_profile(request)
        if not doctor:
            return Response({"detail": "Doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        patient_id = request.data.get('patient')
        if not patient_id:
            return Response({"patient": "Patient is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            patient = Patient.objects.get(pk=patient_id)
        except Patient.DoesNotExist:
            return Response({"patient": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        existing_active = Consultation.objects.filter(
            doctor=doctor,
            patient=patient,
            status='IN_PROGRESS'
        ).first()
        if existing_active:
            return Response(self.get_serializer(existing_active).data, status=status.HTTP_200_OK)

        visit_reason = request.data.get('visit_reason', '').strip()

        with transaction.atomic():
            consultation = Consultation.objects.create(
                doctor=doctor,
                patient=patient,
                appointment=None,
                visit_type='UNSCHEDULED',
                status='IN_PROGRESS',
                visit_reason=visit_reason,
            )
            from apibackendapp.models import ConsultationInvoice
            from receptionist.views import generate_invoice_number
            fee = doctor.consultation_fee
            ConsultationInvoice.objects.create(
                invoice_number=generate_invoice_number(),
                patient=patient,
                consultation=consultation,
                consultation_fee=fee,
                total_amount=fee,
                status='PENDING'
            )

        return Response(self.get_serializer(consultation).data, status=status.HTTP_201_CREATED)


# ============================================================================
# PRESCRIPTION
# ============================================================================

class DoctorPrescriptionViewSet(viewsets.ModelViewSet):
    """
    Doctor can create and view prescriptions they have written.
    Supports filtering by ?patient=<id>.
    """
    serializer_class = PrescriptionSerializer
    permission_classes = [IsDoctor]

    def get_queryset(self):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            return Prescription.objects.none()

        queryset = Prescription.objects.filter(doctor=doctor).select_related(
            'patient', 'doctor', 'consultation'
        )

        patient = self.request.query_params.get('patient')
        if patient:
            queryset = queryset.filter(patient_id=patient)

        return queryset

    def perform_create(self, serializer):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            raise serializers.ValidationError({"detail": "Doctor profile required."})
        consultation = serializer.validated_data.get('consultation')
        patient = serializer.validated_data.get('patient')
        if consultation:
            if consultation.doctor != doctor:
                raise serializers.ValidationError({"consultation": "This consultation does not belong to you."})
            if consultation.appointment and consultation.appointment.status == 'CANCELLED':
                raise serializers.ValidationError({"consultation": "Cannot create prescription for a cancelled appointment."})
            if patient and consultation.patient != patient:
                raise serializers.ValidationError({"patient": "Patient does not match consultation patient."})
            patient = consultation.patient
        if not patient:
            raise serializers.ValidationError({"patient": "Patient is required."})
        if not (consultation and consultation.visit_type == 'UNSCHEDULED'):
            has_active = Appointment.objects.filter(
                patient=patient, doctor=doctor
            ).exclude(status='CANCELLED').exists()
            if not has_active:
                raise serializers.ValidationError({"patient": "You do not have an active appointment with this patient."})
        serializer.save(doctor=doctor, patient=patient)


class DoctorPrescriptionItemViewSet(viewsets.ModelViewSet):
    """
    Doctor can manage items (medicines) within their prescriptions.
    Supports filtering by ?prescription=<id>.
    """
    serializer_class = PrescriptionItemSerializer
    permission_classes = [IsDoctor]

    def get_queryset(self):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            return PrescriptionItem.objects.none()

        queryset = PrescriptionItem.objects.filter(
            prescription__doctor=doctor
        ).select_related('prescription', 'medicine', 'dosage')

        prescription = self.request.query_params.get('prescription')
        if prescription:
            queryset = queryset.filter(prescription_id=prescription)

        return queryset

    def perform_create(self, serializer):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            raise serializers.ValidationError({"detail": "Doctor profile required."})
        prescription = serializer.validated_data.get('prescription')
        if not prescription or prescription.doctor != doctor:
            raise serializers.ValidationError({"prescription": "This prescription does not belong to you."})
        serializer.save()


# ============================================================================
# LAB TEST ORDERS
# ============================================================================

class DoctorLabTestOrderViewSet(viewsets.ModelViewSet):
    """
    Doctor can order and track lab tests for their patients.
    Supports filtering by ?patient=<id> and ?status=ORDERED.
    """
    serializer_class = LabTestOrderSerializer
    permission_classes = [IsDoctor]

    def get_queryset(self):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            return LabTestOrder.objects.none()

        queryset = LabTestOrder.objects.filter(doctor=doctor).select_related(
            'patient', 'doctor', 'test', 'consultation'
        )

        patient = self.request.query_params.get('patient')
        status  = self.request.query_params.get('status')

        if patient:
            queryset = queryset.filter(patient_id=patient)

        if status:
            queryset = queryset.filter(status=status)

        return queryset

    def perform_create(self, serializer):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            raise serializers.ValidationError({"detail": "Doctor profile required."})
        consultation = serializer.validated_data.get('consultation')
        patient = serializer.validated_data.get('patient')
        if consultation:
            if consultation.doctor != doctor:
                raise serializers.ValidationError({"consultation": "This consultation does not belong to you."})
            if consultation.appointment and consultation.appointment.status == 'CANCELLED':
                raise serializers.ValidationError({"consultation": "Cannot order lab test for a cancelled appointment."})
            if patient and consultation.patient != patient:
                raise serializers.ValidationError({"patient": "Patient does not match consultation patient."})
            patient = consultation.patient
        if not patient:
            raise serializers.ValidationError({"patient": "Patient is required."})
        if not (consultation and consultation.visit_type == 'UNSCHEDULED'):
            has_active = Appointment.objects.filter(
                patient=patient, doctor=doctor
            ).exclude(status='CANCELLED').exists()
            if not has_active:
                raise serializers.ValidationError({"patient": "You do not have an active appointment with this patient."})
        serializer.save(doctor=doctor, patient=patient)


class DoctorLabTestResultViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Doctor can VIEW lab results for tests they ordered (read-only).
    Supports filtering by ?order=<id>.
    """
    serializer_class = LabTestResultSerializer
    permission_classes = [IsDoctor]

    def get_queryset(self):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            return LabTestResult.objects.none()

        queryset = LabTestResult.objects.filter(
            order__doctor=doctor
        ).select_related('order', 'technician')

        order = self.request.query_params.get('order')
        if order:
            queryset = queryset.filter(order_id=order)

        return queryset


# ============================================================================
# PATIENT & MEDICAL HISTORY (read-only for doctor)
# ============================================================================

class DoctorPatientViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Doctor can view patients they have had an appointment or consultation with.
    Supports filtering by ?name=<search>.
    """
    serializer_class = PatientSerializer
    permission_classes = [IsDoctor]

    def get_queryset(self):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            return Patient.objects.none()

        # One filter() call so doctor and status conditions apply to the same appointment row
        queryset = Patient.objects.filter(
            appointments__doctor=doctor,
            appointments__status__in=['BOOKED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW']
        ).distinct()

        name = self.request.query_params.get('name')
        if name:
            queryset = queryset.filter(first_name__icontains=name)

        return queryset


class DoctorMedicalHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Doctor can view medical histories of their patients (read-only).
    Supports filtering by ?patient=<id>.
    """
    serializer_class = MedicalHistorySerializer
    permission_classes = [IsDoctor]

    def get_queryset(self):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            return MedicalHistory.objects.none()

        # One filter() call so doctor and status conditions apply to the same appointment row
        queryset = MedicalHistory.objects.filter(
            patient__appointments__doctor=doctor,
            patient__appointments__status__in=['BOOKED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW']
        ).distinct().select_related('patient')

        patient = self.request.query_params.get('patient')
        if patient:
            queryset = queryset.filter(patient_id=patient)

        return queryset


class DoctorPatientDirectoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Doctor can search and view all registered clinic patients (read-only directory).
    Allows doctor to look up walk-in patients arriving without prior appointments.
    Supports search by patient_id, first_name, last_name, or phone via ?search= or ?name=.
    """
    serializer_class = PatientSerializer
    permission_classes = [IsDoctor]

    def get_queryset(self):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            return Patient.objects.none()

        queryset = Patient.objects.all().order_by('-id')

        search = self.request.query_params.get('search') or self.request.query_params.get('name')
        if search:
            search = search.strip()
            from django.db.models import Q
            queryset = queryset.filter(
                Q(patient_id__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(phone__icontains=search)
            )

        phone = self.request.query_params.get('phone')
        if phone:
            queryset = queryset.filter(phone__icontains=phone.strip())

        patient_id = self.request.query_params.get('patient_id')
        if patient_id:
            queryset = queryset.filter(patient_id__icontains=patient_id.strip())

        return queryset

    @action(detail=True, methods=['get'])
    def medical_history(self, request, pk=None):
        """Allows doctor to view clinical conditions/allergies for a directory patient."""
        patient = self.get_object()
        histories = MedicalHistory.objects.filter(patient=patient)
        return Response(MedicalHistorySerializer(histories, many=True).data)



# ============================================================================
# REFERENCE / LOOKUP (read-only)
# ============================================================================

class DoctorMasterMedicineViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Doctor can browse the medicine list when writing prescriptions (read-only).
    Supports filtering by ?name=<search> and ?category=<search>.
    """
    serializer_class = MasterMedicineSerializer
    permission_classes = [IsDoctor]

    def get_queryset(self):
        queryset = MasterMedicine.objects.filter(is_active=True)

        name     = self.request.query_params.get('name')
        category = self.request.query_params.get('category')

        if name:
            queryset = queryset.filter(medicine_name__icontains=name)

        if category:
            queryset = queryset.filter(category__icontains=category)

        return queryset


class DoctorMasterDosageViewSet(viewsets.ReadOnlyModelViewSet):
    """Doctor can browse available dosage options (read-only)."""
    serializer_class = MasterDosageSerializer
    permission_classes = [IsDoctor]
    queryset = MasterDosage.objects.all()


class DoctorMasterLabTestViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Doctor can browse available lab tests when ordering (read-only).
    Supports filtering by ?name=<search>.
    """
    serializer_class = MasterLabTestSerializer
    permission_classes = [IsDoctor]

    def get_queryset(self):
        queryset = MasterLabTest.objects.filter(is_active=True)

        name = self.request.query_params.get('name')
        if name:
            queryset = queryset.filter(test_name__icontains=name)

        return queryset

