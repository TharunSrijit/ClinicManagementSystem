from datetime import date as date_cls

from django.db import transaction
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apibackendapp.models import (
    ReceptionistProfile,
    DoctorProfile,
    Patient,
    MedicalHistory,
    Appointment,
    Token,
    ConsultationInvoice,
    ConsultationPayment,
)

from apibackendapp.serializers import (
    ReceptionistProfileSerializer,
    DoctorProfileSerializer,
    PatientSerializer,
    MedicalHistorySerializer,
    AppointmentSerializer,
    TokenSerializer,
    ConsultationInvoiceSerializer,
    ConsultationPaymentSerializer,
)


# ---------------------------------------------------------------------------
# Helper — get the ReceptionistProfile of the currently logged-in user
# ---------------------------------------------------------------------------

def get_receptionist_profile(request):
    """Returns the ReceptionistProfile for the logged-in user, or None."""
    try:
        return request.user.receptionist_profile
    except ReceptionistProfile.DoesNotExist:
        return None


def generate_patient_id():
    """PAT0001, PAT0002, ... based on the highest existing numeric suffix."""
    last = Patient.objects.order_by('-id').first()
    next_number = (last.id + 1) if last else 1
    return f"PAT{next_number:04d}"


def generate_invoice_number():
    last = ConsultationInvoice.objects.order_by('-id').first()
    next_number = (last.id + 1) if last else 1
    return f"CINV{next_number:05d}"


# ============================================================================
# RECEPTIONIST PROFILE
# ============================================================================

class ReceptionistProfileView(viewsets.ModelViewSet):
    """
    Allows the logged-in receptionist to view and update their own profile only.
    """
    serializer_class = ReceptionistProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ReceptionistProfile.objects.filter(user=self.request.user)


# ============================================================================
# PATIENT REGISTRATION & SEARCH
# ============================================================================

class ReceptionistPatientViewSet(viewsets.ModelViewSet):
    """
    Receptionist registers new patients and searches/updates existing ones.
    Supports filtering by ?search=<name/phone/patient_id>.
    """
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Patient.objects.all().order_by('-created_at')

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(phone__icontains=search) |
                Q(patient_id__icontains=search)
            )

        return queryset

    def perform_create(self, serializer):
        serializer.save(patient_id=generate_patient_id())


class ReceptionistMedicalHistoryViewSet(viewsets.ModelViewSet):
    """
    Receptionist can record/view basic medical history collected at the desk
    (e.g. known allergies) filtered by ?patient=<id>.
    """
    serializer_class = MedicalHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = MedicalHistory.objects.all().select_related('patient')

        patient = self.request.query_params.get('patient')
        if patient:
            queryset = queryset.filter(patient_id=patient)

        return queryset


# ============================================================================
# DOCTOR DIRECTORY (read-only, for scheduling)
# ============================================================================

class ReceptionistDoctorViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Receptionist can browse doctors and their availability when booking
    appointments. Supports filtering by ?specialization=<search>.
    """
    serializer_class = DoctorProfileSerializer
    permission_classes = [IsAuthenticated]
    queryset = DoctorProfile.objects.all().select_related('user')

    def get_queryset(self):
        queryset = super().get_queryset()

        specialization = self.request.query_params.get('specialization')
        if specialization:
            queryset = queryset.filter(
                specialization__icontains=specialization
            )

        return queryset


# ============================================================================
# APPOINTMENTS
# ============================================================================

class ReceptionistAppointmentViewSet(viewsets.ModelViewSet):
    """
    Receptionist books and manages appointments across all doctors.
    Supports filtering by ?doctor=<id>, ?patient=<id>, ?status=BOOKED,
    ?date=YYYY-MM-DD.
    """
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Appointment.objects.all().select_related(
            'patient', 'doctor', 'doctor__user', 'receptionist'
        )

        doctor = self.request.query_params.get('doctor')
        patient = self.request.query_params.get('patient')
        status_param = self.request.query_params.get('status')
        appt_date = self.request.query_params.get('date')

        if doctor:
            queryset = queryset.filter(doctor_id=doctor)

        if patient:
            queryset = queryset.filter(patient_id=patient)

        if status_param:
            queryset = queryset.filter(status=status_param)

        if appt_date:
            queryset = queryset.filter(appointment_date=appt_date)

        return queryset.order_by('appointment_date', 'appointment_time')

    def perform_create(self, serializer):
        receptionist = get_receptionist_profile(self.request)
        serializer.save(receptionist=receptionist)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """POST /appointments/{id}/cancel/ — mark an appointment as cancelled."""
        appointment = self.get_object()
        appointment.status = 'CANCELLED'
        appointment.save(update_fields=['status'])
        return Response(self.get_serializer(appointment).data)

    @action(detail=True, methods=['post'])
    def check_in(self, request, pk=None):
        """
        POST /appointments/{id}/check_in/ — confirm the patient has arrived
        and issue them the next queue token for the day.
        """
        appointment = self.get_object()
        appointment.status = 'CONFIRMED'
        appointment.save(update_fields=['status'])

        if hasattr(appointment, 'token'):
            token = appointment.token
        else:
            with transaction.atomic():
                today = appointment.appointment_date
                last_token = (
                    Token.objects.select_for_update()
                    .filter(token_date=today)
                    .order_by('-token_number')
                    .first()
                )
                next_number = (last_token.token_number + 1) if last_token else 1
                token = Token.objects.create(
                    appointment=appointment,
                    token_number=next_number,
                    token_date=today,
                )

        return Response({
            'appointment': self.get_serializer(appointment).data,
            'token': TokenSerializer(token).data,
        })


# ============================================================================
# TOKEN / QUEUE MANAGEMENT
# ============================================================================

class ReceptionistTokenViewSet(viewsets.ModelViewSet):
    """
    Receptionist manages the front-desk queue.
    Supports filtering by ?date=YYYY-MM-DD (defaults to today) and ?status=.
    """
    serializer_class = TokenSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Token.objects.all().select_related(
            'appointment', 'appointment__patient', 'appointment__doctor',
            'appointment__doctor__user',
        )

        token_date = self.request.query_params.get('date', date_cls.today().isoformat())
        status_param = self.request.query_params.get('status')

        queryset = queryset.filter(token_date=token_date)

        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset.order_by('token_number')

    def perform_create(self, serializer):
        appointment = serializer.validated_data['appointment']
        token_date = serializer.validated_data.get('token_date') or appointment.appointment_date

        with transaction.atomic():
            last_token = (
                Token.objects.select_for_update()
                .filter(token_date=token_date)
                .order_by('-token_number')
                .first()
            )
            next_number = (last_token.token_number + 1) if last_token else 1
            serializer.save(token_number=next_number, token_date=token_date)

    @action(detail=True, methods=['post'])
    def call_next(self, request, pk=None):
        """POST /tokens/{id}/call_next/ — mark this token as CALLED."""
        token = self.get_object()
        token.status = 'CALLED'
        token.save(update_fields=['status'])
        return Response(self.get_serializer(token).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """POST /tokens/{id}/complete/ — mark this token as COMPLETED."""
        token = self.get_object()
        token.status = 'COMPLETED'
        token.save(update_fields=['status'])
        return Response(self.get_serializer(token).data)


# ============================================================================
# CONSULTATION BILLING
# ============================================================================

class ReceptionistConsultationInvoiceViewSet(viewsets.ModelViewSet):
    """
    Receptionist raises and views consultation invoices.
    Supports filtering by ?patient=<id> and ?status=.
    """
    serializer_class = ConsultationInvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = ConsultationInvoice.objects.all().select_related(
            'patient', 'appointment'
        )

        patient = self.request.query_params.get('patient')
        status_param = self.request.query_params.get('status')

        if patient:
            queryset = queryset.filter(patient_id=patient)

        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        appointment = serializer.validated_data['appointment']
        fee = serializer.validated_data.get('consultation_fee') or appointment.doctor.consultation_fee
        discount = serializer.validated_data.get('discount', 0)
        tax = serializer.validated_data.get('tax', 0)
        total = fee - discount + tax

        serializer.save(
            invoice_number=generate_invoice_number(),
            patient=appointment.patient,
            consultation_fee=fee,
            total_amount=total,
        )


class ReceptionistConsultationPaymentViewSet(viewsets.ModelViewSet):
    """
    Receptionist records payments against a consultation invoice and keeps
    the invoice status (PENDING / PARTIAL / PAID) in sync.
    Supports filtering by ?invoice=<id>.
    """
    serializer_class = ConsultationPaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = ConsultationPayment.objects.all().select_related('invoice')

        invoice = self.request.query_params.get('invoice')
        if invoice:
            queryset = queryset.filter(invoice_id=invoice)

        return queryset.order_by('-payment_date')

    def perform_create(self, serializer):
        with transaction.atomic():
            payment = serializer.save()
            invoice = payment.invoice
            total_paid = sum(p.amount for p in invoice.payments.all())

            if total_paid >= invoice.total_amount:
                invoice.status = 'PAID'
            elif total_paid > 0:
                invoice.status = 'PARTIAL'
            else:
                invoice.status = 'PENDING'

            invoice.save(update_fields=['status'])
