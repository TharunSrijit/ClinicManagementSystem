from datetime import date as date_cls

from django.db import transaction
from django.db.models import Q
from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from decimal import Decimal
from apibackendapp.permissions import IsReceptionist

from apibackendapp.models import (
    ReceptionistProfile,
    DoctorProfile,
    Patient,
    MedicalHistory,
    Appointment,
    Token,
    ClinicConfiguration,
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
    ClinicConfigurationSerializer,
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
    import uuid
    last = ConsultationInvoice.objects.order_by('-id').first()
    next_number = (last.id + 1) if last else 1
    candidate = f"CINV{next_number:05d}"
    if ConsultationInvoice.objects.filter(invoice_number=candidate).exists():
        candidate = f"CINV{next_number:05d}_{uuid.uuid4().hex[:4].upper()}"
    return candidate


def get_or_create_consultation_invoice(appointment):
    """
    Retrieves or creates a single combined ConsultationInvoice for an appointment.
    Ensures that an appointment has at most one consultation invoice.
    Combines registration fee (for new patients without a prior registration fee charge)
    and consultation fee (from doctor's configured fee).
    Preserves fee amounts on previously created invoices and prevents duplicate charges.
    """
    if hasattr(appointment, 'consultation_invoice') and appointment.consultation_invoice:
        return appointment.consultation_invoice, False

    existing = ConsultationInvoice.objects.filter(appointment=appointment).first()
    if existing:
        return existing, False

    consult_fee = Decimal(str(appointment.doctor.consultation_fee)) if appointment.doctor else Decimal('0.00')

    # Charge registration fee if patient has never been assessed a registration fee on any prior non-cancelled invoice
    has_prior_reg = ConsultationInvoice.objects.filter(
        patient=appointment.patient,
        registration_fee__gt=0
    ).exclude(status='CANCELLED').exists()

    if not has_prior_reg:
        config = ClinicConfiguration.get_instance()
        reg_fee = Decimal(str(config.registration_fee))
    else:
        reg_fee = Decimal('0.00')

    total_amount = consult_fee + reg_fee

    invoice = ConsultationInvoice.objects.create(
        invoice_number=generate_invoice_number(),
        patient=appointment.patient,
        appointment=appointment,
        consultation_fee=consult_fee,
        registration_fee=reg_fee,
        discount=Decimal('0.00'),
        tax=Decimal('0.00'),
        total_amount=total_amount,
        status='PAID' if total_amount == 0 else 'PENDING'
    )
    return invoice, True


def assign_next_token_number(appointment, token_date):
    """
    Assigns the next sequential token number for an appointment on token_date.
    Advance appointments receive lower numbers (1 - 99).
    Walk-in appointments receive higher numbers (101 onwards), even if issued earlier.
    Never renumbers previously issued tokens or creates duplicates.
    """
    if appointment.appointment_type == 'ADVANCE':
        last_token = (
            Token.objects.select_for_update()
            .filter(token_date=token_date, token_number__lt=100)
            .order_by('-token_number')
            .first()
        )
        return (last_token.token_number + 1) if last_token else 1
    else:  # WALK_IN
        last_token = (
            Token.objects.select_for_update()
            .filter(token_date=token_date, token_number__gte=101)
            .order_by('-token_number')
            .first()
        )
        return (last_token.token_number + 1) if last_token else 101


# ============================================================================
# RECEPTIONIST PROFILE
# ============================================================================

class ReceptionistProfileView(viewsets.ModelViewSet):
    """
    Allows the logged-in receptionist to view and update their own profile only.
    """
    serializer_class = ReceptionistProfileSerializer
    permission_classes = [IsReceptionist]

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
    permission_classes = [IsReceptionist]

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
    permission_classes = [IsReceptionist]

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
    permission_classes = [IsReceptionist]
    queryset = DoctorProfile.objects.all().select_related('user')

    def get_queryset(self):
        queryset = super().get_queryset()

        specialization = self.request.query_params.get('specialization')
        if specialization:
            queryset = queryset.filter(
                specialization__icontains=specialization
            )

        return queryset

    @action(detail=True, methods=['get'])
    def slots(self, request, pk=None):
        doctor = self.get_object()
        appt_type = request.query_params.get('type')
        date_str = request.query_params.get('date')

        if not appt_type:
            return Response(
                {'detail': "Query parameter 'type' is required (WALK_IN or ADVANCE)."},
                status=status.HTTP_400_BAD_REQUEST
            )
        appt_type = appt_type.upper()
        if appt_type not in ('WALK_IN', 'ADVANCE', 'BOOKED'):
            return Response(
                {'detail': "Query parameter 'type' must be 'WALK_IN' or 'ADVANCE'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not date_str:
            return Response(
                {'detail': "Query parameter 'date' is required (YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from datetime import datetime
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'detail': "Invalid date format. Expected YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from apibackendapp.scheduling import get_doctor_slots_availability, SchedulingValidationError
        try:
            slot_data = get_doctor_slots_availability(
                doctor=doctor,
                appointment_type=appt_type,
                date=target_date,
            )
            return Response(slot_data, status=status.HTTP_200_OK)
        except SchedulingValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


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
    permission_classes = [IsReceptionist]

    def get_queryset(self):
        queryset = Appointment.objects.all().select_related(
            'patient', 'doctor', 'doctor__user', 'receptionist', 'token', 'consultation_invoice'
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
        if not receptionist:
            raise serializers.ValidationError(
                {'detail': 'A ReceptionistProfile is required to create an appointment.'}
            )

        doctor = serializer.validated_data['doctor']
        appt_type = serializer.validated_data.get('appointment_type', 'ADVANCE')

        with transaction.atomic():
            DoctorProfile.objects.select_for_update().get(id=doctor.id)
            appointment = serializer.save(receptionist=receptionist, status='PENDING')
            # Create combined invoice for all appointments (walk-in and advance)
            invoice, _ = get_or_create_consultation_invoice(appointment)
            if invoice.total_amount <= Decimal('0.00'):
                invoice.status = 'PAID'
                invoice.save(update_fields=['status'])
                appointment.status = 'CONFIRMED' if appt_type == 'WALK_IN' else 'BOOKED'
                appointment.save(update_fields=['status'])

    def perform_update(self, serializer):
        receptionist = get_receptionist_profile(self.request)
        if not receptionist:
            raise serializers.ValidationError(
                {'detail': 'A ReceptionistProfile is required to update an appointment.'}
            )
        serializer.save()

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """POST /appointments/{id}/cancel/ — mark an appointment as cancelled."""
        receptionist = get_receptionist_profile(request)
        if not receptionist:
            return Response(
                {'detail': 'A ReceptionistProfile is required.'},
                status=status.HTTP_403_FORBIDDEN
            )
        appointment = self.get_object()
        from apibackendapp.scheduling import validate_status_transition, SchedulingValidationError
        try:
            validate_status_transition(appointment.status, 'CANCELLED', request.user.role)
        except SchedulingValidationError as e:
            msg = e.detail if hasattr(e, 'detail') else str(e)
            return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)

        appointment.status = 'CANCELLED'
        appointment.save(update_fields=['status'])

        # Cancel linked unpaid invoice if present
        if hasattr(appointment, 'consultation_invoice') and appointment.consultation_invoice:
            inv = appointment.consultation_invoice
            if inv.status in ['PENDING', 'PARTIAL']:
                inv.status = 'CANCELLED'
                inv.save(update_fields=['status'])

        # Also cancel active queue token if present
        if hasattr(appointment, 'token') and appointment.token:
            if appointment.token.status != 'COMPLETED':
                appointment.token.status = 'CANCELLED'
                appointment.token.save(update_fields=['status'])

        return Response(self.get_serializer(appointment).data)

    @action(detail=True, methods=['post'])
    def confirm_arrival(self, request, pk=None):
        """
        POST /appointments/{id}/confirm_arrival/ — confirm the patient has arrived at the clinic.
        Transitions appointment from BOOKED to CONFIRMED.
        """
        receptionist = get_receptionist_profile(request)
        if not receptionist:
            return Response(
                {'detail': 'A ReceptionistProfile is required.'},
                status=status.HTTP_403_FORBIDDEN
            )
        appointment = self.get_object()
        from apibackendapp.scheduling import now_local, validate_status_transition, SchedulingValidationError

        today = now_local().date()
        if appointment.appointment_date < today:
            return Response(
                {'detail': f"Arrival cannot be confirmed for past appointments ({appointment.appointment_date})."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if appointment.status == 'PENDING':
            return Response(
                {'detail': 'Consultation fee must be paid before patient arrival can be confirmed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if appointment.status == 'CONFIRMED':
            get_or_create_consultation_invoice(appointment)
            return Response({
                'detail': 'Patient arrival is already confirmed.',
                'appointment': self.get_serializer(appointment).data,
            }, status=status.HTTP_200_OK)

        try:
            validate_status_transition(appointment.status, 'CONFIRMED', request.user.role)
        except SchedulingValidationError as e:
            msg = e.detail if hasattr(e, 'detail') else str(e)
            return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)

        appointment.status = 'CONFIRMED'
        appointment.save(update_fields=['status'])
        # Eligible for consultation fee payment
        get_or_create_consultation_invoice(appointment)

        return Response({
            'detail': 'Patient arrival confirmed successfully. Eligible for consultation fee payment.',
            'appointment': self.get_serializer(appointment).data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def collect_fee(self, request, pk=None):
        """
        POST /appointments/{id}/collect_fee/ — record payment for the consultation invoice.
        """
        receptionist = get_receptionist_profile(request)
        if not receptionist:
            return Response(
                {'detail': 'A ReceptionistProfile is required.'},
                status=status.HTTP_403_FORBIDDEN
            )
        appointment = self.get_object()
        if appointment.status == 'CANCELLED':
            return Response(
                {'detail': 'Cannot collect fee for a cancelled appointment.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        invoice, _ = get_or_create_consultation_invoice(appointment)
        if invoice.status == 'PAID':
            return Response({
                'detail': 'Consultation fee is already fully paid.',
                'appointment': self.get_serializer(appointment).data,
                'invoice': ConsultationInvoiceSerializer(invoice).data,
            }, status=status.HTTP_200_OK)

        payment_method = request.data.get('payment_method', 'CASH')
        if payment_method not in dict(ConsultationPayment.PAYMENT_METHOD_CHOICES):
            payment_method = 'CASH'
        transaction_id = str(request.data.get('transaction_id', '')).strip()

        with transaction.atomic():
            total_paid_before = sum(p.amount for p in invoice.payments.all())
            remaining = invoice.total_amount - total_paid_before
            pay_amount = request.data.get('amount')
            if pay_amount is not None:
                try:
                    pay_amount = Decimal(str(pay_amount))
                except Exception:
                    pay_amount = remaining
            else:
                pay_amount = remaining

            if pay_amount <= Decimal('0.00'):
                return Response(
                    {'detail': 'Payment amount must be greater than zero.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if pay_amount > remaining:
                return Response(
                    {'detail': f'Payment amount (₹{pay_amount}) exceeds remaining balance of ₹{remaining}.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            ConsultationPayment.objects.create(
                invoice=invoice,
                amount=pay_amount,
                payment_method=payment_method,
                transaction_id=transaction_id,
            )
            total_paid = sum(p.amount for p in invoice.payments.all())
            if total_paid >= invoice.total_amount:
                invoice.status = 'PAID'
            elif total_paid > Decimal('0.00'):
                invoice.status = 'PARTIAL'
            else:
                invoice.status = 'PENDING'
            invoice.save(update_fields=['status'])

            if invoice.status == 'PAID' and appointment.status == 'PENDING':
                if appointment.appointment_type == 'WALK_IN':
                    appointment.status = 'CONFIRMED'
                else:
                    appointment.status = 'BOOKED'
                appointment.save(update_fields=['status'])

        detail_msg = (
            f'Payment of ₹{pay_amount} recorded successfully. Token can now be issued.'
            if invoice.status == 'PAID'
            else f'Partial payment of ₹{pay_amount} recorded. Remaining balance: ₹{invoice.total_amount - total_paid}.'
        )
        return Response({
            'detail': detail_msg,
            'appointment': self.get_serializer(appointment).data,
            'invoice': ConsultationInvoiceSerializer(invoice).data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def issue_token(self, request, pk=None):
        """
        POST /appointments/{id}/issue_token/ — issue a queue token for an appointment whose arrival
        has already been confirmed AND consultation fee has been fully paid.
        """
        receptionist = get_receptionist_profile(request)
        if not receptionist:
            return Response(
                {'detail': 'A ReceptionistProfile is required.'},
                status=status.HTTP_403_FORBIDDEN
            )
        appointment = self.get_object()
        from apibackendapp.scheduling import now_local

        today = now_local().date()
        if appointment.appointment_date < today:
            return Response(
                {'detail': f"Tokens cannot be issued for past appointments ({appointment.appointment_date})."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if appointment.status == 'CANCELLED':
            return Response(
                {'detail': 'Cannot issue token for a cancelled appointment.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if appointment.status == 'COMPLETED':
            return Response(
                {'detail': 'Cannot issue token for an already completed appointment.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Prevent duplicate tokens
        if hasattr(appointment, 'token') and appointment.token:
            return Response(
                {
                    'detail': f'A token (#{appointment.token.token_number}) has already been issued for this appointment.',
                    'appointment': self.get_serializer(appointment).data,
                    'token': TokenSerializer(appointment.token).data,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Enforce arrival & payment conditions
        invoice, _ = get_or_create_consultation_invoice(appointment)
        if appointment.status == 'PENDING':
            return Response(
                {
                    'detail': f'Consultation fee of ₹{invoice.total_amount} must be paid before issuing a token (Current payment status: {invoice.status}).',
                    'invoice_id': invoice.id,
                    'invoice_number': invoice.invoice_number,
                    'total_amount': str(invoice.total_amount),
                    'status': invoice.status,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if appointment.status != 'CONFIRMED':
            return Response(
                {'detail': 'Patient arrival must be confirmed before issuing a queue token.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if invoice.total_amount > 0:
            total_paid = sum(p.amount for p in invoice.payments.all())
            if total_paid < invoice.total_amount or invoice.status != 'PAID':
                return Response(
                    {
                        'detail': f'Consultation fee of ₹{invoice.total_amount} must be paid before issuing a token (Current payment status: {invoice.status}).',
                        'invoice_id': invoice.id,
                        'invoice_number': invoice.invoice_number,
                        'total_amount': str(invoice.total_amount),
                        'status': invoice.status,
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        token_date = appointment.appointment_date
        with transaction.atomic():
            next_number = assign_next_token_number(appointment, token_date)
            token = Token.objects.create(
                appointment=appointment,
                token_number=next_number,
                token_date=token_date,
                status='WAITING'
            )

        return Response({
            'detail': f'Token #{token.token_number} issued successfully.',
            'appointment': self.get_serializer(appointment).data,
            'token': TokenSerializer(token).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def check_in(self, request, pk=None):
        """
        POST /appointments/{id}/check_in/ — confirm the patient has arrived
        and issue them the next queue token for the day (if fee is paid).
        """
        receptionist = get_receptionist_profile(request)
        if not receptionist:
            return Response(
                {'detail': 'A ReceptionistProfile is required.'},
                status=status.HTTP_403_FORBIDDEN
            )
        appointment = self.get_object()
        from apibackendapp.scheduling import now_local, validate_status_transition, SchedulingValidationError

        today = now_local().date()
        if appointment.appointment_date < today:
            return Response(
                {'detail': f"Past appointments cannot be checked in ({appointment.appointment_date})."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if appointment.status == 'CANCELLED':
            return Response(
                {'detail': 'Cannot check in a cancelled appointment.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if appointment.status == 'COMPLETED':
            return Response(
                {'detail': 'Cannot check in an already completed appointment.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if appointment.status != 'CONFIRMED':
            try:
                validate_status_transition(appointment.status, 'CONFIRMED', request.user.role)
            except SchedulingValidationError as e:
                msg = e.detail if hasattr(e, 'detail') else str(e)
                return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)

            appointment.status = 'CONFIRMED'
            appointment.save(update_fields=['status'])

        invoice, _ = get_or_create_consultation_invoice(appointment)
        token_date = appointment.appointment_date
        if hasattr(appointment, 'token') and appointment.token:
            token = appointment.token
        else:
            # Check payment before issuing token
            if invoice.total_amount > 0 and (sum(p.amount for p in invoice.payments.all()) < invoice.total_amount or invoice.status != 'PAID'):
                return Response({
                    'detail': f'Patient arrival confirmed. Consultation fee of ₹{invoice.total_amount} must be paid before token issuance.',
                    'appointment': self.get_serializer(appointment).data,
                    'token': None,
                }, status=status.HTTP_200_OK)

            with transaction.atomic():
                next_number = assign_next_token_number(appointment, token_date)
                token = Token.objects.create(
                    appointment=appointment,
                    token_number=next_number,
                    token_date=token_date,
                    status='WAITING'
                )

        return Response({
            'detail': f'Check-in confirmed and Token #{token.token_number} issued.',
            'appointment': self.get_serializer(appointment).data,
            'token': TokenSerializer(token).data,
        }, status=status.HTTP_200_OK)


# ============================================================================
# TOKEN / QUEUE MANAGEMENT
# ============================================================================

class ReceptionistTokenViewSet(viewsets.ModelViewSet):
    """
    Receptionist manages the front-desk queue.
    Supports filtering by ?date=YYYY-MM-DD (defaults to today) and ?status=.
    """
    serializer_class = TokenSerializer
    permission_classes = [IsReceptionist]

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
        from apibackendapp.scheduling import now_local
        today = now_local().date()

        if appointment.appointment_date < today:
            raise serializers.ValidationError({
                "appointment": f"Tokens cannot be issued for past appointments ({appointment.appointment_date})."
            })
        if appointment.status == 'CANCELLED':
            raise serializers.ValidationError({
                "appointment": "Cannot issue token for a cancelled appointment."
            })
        if appointment.status == 'COMPLETED':
            raise serializers.ValidationError({
                "appointment": "Cannot issue token for an already completed appointment."
            })
        invoice, _ = get_or_create_consultation_invoice(appointment)
        if appointment.status == 'PENDING':
            raise serializers.ValidationError({
                "appointment": f"Consultation fee of ₹{invoice.total_amount} must be paid before issuing a token (Status: {invoice.status})."
            })

        if appointment.status != 'CONFIRMED':
            raise serializers.ValidationError({
                "appointment": "Patient arrival must be confirmed before issuing a queue token."
            })

        if invoice.total_amount > 0:
            total_paid = sum(p.amount for p in invoice.payments.all())
            if total_paid < invoice.total_amount or invoice.status != 'PAID':
                raise serializers.ValidationError({
                    "appointment": f"Consultation fee of ₹{invoice.total_amount} must be paid before issuing a token (Status: {invoice.status})."
                })
        if hasattr(appointment, 'token') and appointment.token:
            raise serializers.ValidationError({
                "appointment": f"A token (#{appointment.token.token_number}) has already been issued for this appointment."
            })

        token_date = serializer.validated_data.get('token_date') or appointment.appointment_date

        with transaction.atomic():
            next_number = assign_next_token_number(appointment, token_date)
            serializer.save(token_number=next_number, token_date=token_date, status='WAITING')

    @action(detail=True, methods=['post'])
    def call_next(self, request, pk=None):
        """Receptionist is not permitted to call patients into consultation."""
        return Response(
            {'detail': 'Only the assigned doctor is authorized to call patients into consultation.'},
            status=status.HTTP_403_FORBIDDEN
        )

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Receptionist is not permitted to complete patient consultation tokens."""
        return Response(
            {'detail': 'Only the assigned doctor is authorized to complete consultations.'},
            status=status.HTTP_403_FORBIDDEN
        )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """POST /tokens/{id}/cancel/ — cancel this token."""
        token = self.get_object()
        token.status = 'CANCELLED'
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
    permission_classes = [IsReceptionist]

    def get_queryset(self):
        queryset = ConsultationInvoice.objects.all().select_related(
            'patient', 'appointment', 'consultation'
        )

        patient = self.request.query_params.get('patient')
        status_param = self.request.query_params.get('status')

        if patient:
            queryset = queryset.filter(patient_id=patient)

        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        appointment = serializer.validated_data.get('appointment')
        consultation = serializer.validated_data.get('consultation')
        if appointment:
            if hasattr(appointment, 'consultation_invoice') and appointment.consultation_invoice:
                raise serializers.ValidationError({"detail": "An invoice already exists for this appointment."})
            if ConsultationInvoice.objects.filter(appointment=appointment).exists():
                raise serializers.ValidationError({"detail": "An invoice already exists for this appointment."})
            fee = serializer.validated_data.get('consultation_fee') or appointment.doctor.consultation_fee
            patient = appointment.patient
        elif consultation:
            if hasattr(consultation, 'consultation_invoice') and consultation.consultation_invoice:
                raise serializers.ValidationError({"detail": "An invoice already exists for this consultation."})
            if ConsultationInvoice.objects.filter(consultation=consultation).exists():
                raise serializers.ValidationError({"detail": "An invoice already exists for this consultation."})
            fee = serializer.validated_data.get('consultation_fee') or consultation.doctor.consultation_fee
            patient = consultation.patient
        else:
            raise serializers.ValidationError({"detail": "Either appointment or consultation is required."})

        reg_fee = serializer.validated_data.get('registration_fee')
        if reg_fee is None:
            has_prior_reg = ConsultationInvoice.objects.filter(
                patient=patient,
                registration_fee__gt=0
            ).exclude(status='CANCELLED').exists()
            if not has_prior_reg:
                config = ClinicConfiguration.get_instance()
                reg_fee = Decimal(str(config.registration_fee))
            else:
                reg_fee = Decimal('0.00')

        discount = serializer.validated_data.get('discount', Decimal('0.00')) or Decimal('0.00')
        tax = serializer.validated_data.get('tax', Decimal('0.00')) or Decimal('0.00')
        total = fee + reg_fee - discount + tax

        serializer.save(
            invoice_number=generate_invoice_number(),
            patient=patient,
            consultation_fee=fee,
            registration_fee=reg_fee,
            total_amount=total,
            status='PAID' if total == Decimal('0.00') else 'PENDING',
        )


class ReceptionistConsultationPaymentViewSet(viewsets.ModelViewSet):
    """
    Receptionist records payments against a consultation invoice and keeps
    the invoice status (PENDING / PARTIAL / PAID) in sync.
    Supports filtering by ?invoice=<id>.
    """
    serializer_class = ConsultationPaymentSerializer
    permission_classes = [IsReceptionist]

    def get_queryset(self):
        queryset = ConsultationPayment.objects.all().select_related('invoice')

        invoice = self.request.query_params.get('invoice')
        if invoice:
            queryset = queryset.filter(invoice_id=invoice)

        return queryset.order_by('-payment_date')

    def perform_create(self, serializer):
        invoice = serializer.validated_data['invoice']
        if invoice.status == 'CANCELLED':
            raise serializers.ValidationError({"detail": "Cannot record payment for a cancelled invoice."})

        total_paid_before = sum(p.amount for p in invoice.payments.all())
        balance = invoice.total_amount - total_paid_before
        if balance <= Decimal('0.00') or invoice.status == 'PAID':
            raise serializers.ValidationError({"detail": "This invoice is already fully paid."})

        amount = serializer.validated_data.get('amount')
        if amount and amount > balance:
            raise serializers.ValidationError({"detail": f"Payment amount (₹{amount}) cannot exceed the remaining balance of ₹{balance}."})

        transaction_id = str(serializer.validated_data.get('transaction_id', '') or '').strip()
        if transaction_id and ConsultationPayment.objects.filter(invoice=invoice, transaction_id=transaction_id).exists():
            raise serializers.ValidationError({"detail": f"A payment with transaction ID '{transaction_id}' has already been recorded for this invoice."})

        with transaction.atomic():
            payment = serializer.save()
            total_paid = sum(p.amount for p in ConsultationPayment.objects.filter(invoice=invoice))

            if total_paid >= invoice.total_amount:
                invoice.status = 'PAID'
            elif total_paid > Decimal('0.00'):
                invoice.status = 'PARTIAL'
            else:
                invoice.status = 'PENDING'

            invoice.save(update_fields=['status'])

            # Transition linked appointment if invoice is fully paid
            if invoice.status == 'PAID' and invoice.appointment:
                appt = invoice.appointment
                if appt.status == 'PENDING':
                    if appt.appointment_type == 'WALK_IN':
                        appt.status = 'CONFIRMED'
                    else:
                        appt.status = 'BOOKED'
                    appt.save(update_fields=['status'])


class ReceptionistClinicConfigurationViewSet(viewsets.ModelViewSet):
    """
    Receptionist views and updates clinic contact details and registration fee.
    """
    serializer_class = ClinicConfigurationSerializer
    permission_classes = [IsReceptionist]

    def get_queryset(self):
        return ClinicConfiguration.objects.all()

    def list(self, request, *args, **kwargs):
        config = ClinicConfiguration.get_instance()
        return Response(ClinicConfigurationSerializer(config).data)
