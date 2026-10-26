from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apibackendapp.permissions import IsLabTechnician

from apibackendapp.models import (
    LabTechnicianProfile,
    Patient,
    MasterLabTest,
    LabTestOrder,
    LabTestResult,
    LabInvoice,
    LabPayment,
)

from .serializers import (
    LabTechnicianProfileSerializer,
    PatientSerializer,
    MasterLabTestSerializer,
    LabTestOrderSerializer,
    LabTestResultSerializer,
    LabInvoiceSerializer,
    LabPaymentSerializer,
    SubmitResultSerializer,
    GenerateBillSerializer,
    RecordPaymentSerializer,
    active_invoice_for,
    paid_amount_for,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_lab_tech_profile(request):
    try:
        return request.user.lab_technician_profile
    except LabTechnicianProfile.DoesNotExist:
        return None


def generate_lab_invoice_number():
    last = LabInvoice.objects.order_by('-id').first()
    next_number = (last.id + 1) if last else 1
    candidate = f"LINV{next_number:05d}"
    while LabInvoice.objects.filter(invoice_number=candidate).exists():
        next_number += 1
        candidate = f"LINV{next_number:05d}"
    return candidate


def bad_request(message):
    return Response({'detail': message}, status=status.HTTP_400_BAD_REQUEST)


# Statuses that still need lab work ("active queue")
ACTIVE_STATUSES = ['ORDERED', 'PAYMENT_PENDING', 'PAID', 'SAMPLE_COLLECTED', 'PROCESSING']


# ============================================================================
# PROFILE
# ============================================================================

class LabTechProfileView(viewsets.ModelViewSet):
    """Lab technician can view and update their own profile only."""
    serializer_class = LabTechnicianProfileSerializer
    permission_classes = [IsLabTechnician]
    http_method_names = ['get', 'put', 'patch', 'head', 'options']

    def get_queryset(self):
        return LabTechnicianProfile.objects.filter(user=self.request.user)


# ============================================================================
# LAB TEST ORDERS — the whole lab workflow lives here
# ============================================================================

class LabTechLabTestOrderViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Orders are created by doctors (POST /api/doctor/lab-orders/).
    The lab technician moves them through the workflow with these actions:

      POST /lab-orders/{id}/generate_bill/   ORDERED          -> PAYMENT_PENDING
      POST /lab-orders/{id}/record_payment/  PAYMENT_PENDING  -> PAID (when fully paid)
      POST /lab-orders/{id}/collect_sample/  PAID             -> SAMPLE_COLLECTED
      POST /lab-orders/{id}/start_processing/ SAMPLE_COLLECTED -> PROCESSING
      POST /lab-orders/{id}/submit_result/   PROCESSING       -> COMPLETED (visible to doctor)
      POST /lab-orders/{id}/cancel/          ORDERED / PAYMENT_PENDING (no payment yet) -> CANCELLED

    GET /lab-orders/summary/  -> count per status (dashboard + filter tabs)

    List filters:
      ?status=PAID              single status
      ?status=PAID,PROCESSING   several statuses
      ?status=ACTIVE            everything not completed / cancelled
      ?patient=<id>
      ?search=<text>            order no, patient name / id, test name
      ?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD   (ordered date)
    """
    serializer_class = LabTestOrderSerializer
    permission_classes = [IsLabTechnician]

    def base_queryset(self):
        return LabTestOrder.objects.select_related(
            'patient', 'doctor', 'doctor__user', 'test', 'consultation',
            'result', 'result__technician', 'result__technician__user',
        ).prefetch_related('invoices__payments')

    def get_queryset(self):
        queryset = self.base_queryset()
        params = self.request.query_params

        status_param = (params.get('status') or '').strip().upper()
        if status_param == 'ACTIVE':
            queryset = queryset.filter(status__in=ACTIVE_STATUSES)
        elif status_param:
            queryset = queryset.filter(status__in=[s.strip() for s in status_param.split(',') if s.strip()])

        patient = params.get('patient')
        if patient:
            queryset = queryset.filter(patient_id=patient)

        search = (params.get('search') or '').strip()
        if search:
            queryset = queryset.filter(
                Q(order_number__icontains=search)
                | Q(patient__first_name__icontains=search)
                | Q(patient__last_name__icontains=search)
                | Q(patient__patient_id__icontains=search)
                | Q(test__test_name__icontains=search)
                | Q(test__test_code__icontains=search)
            )

        date_from = params.get('date_from')
        date_to = params.get('date_to')
        if date_from:
            queryset = queryset.filter(ordered_date__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(ordered_date__date__lte=date_to)

        return queryset.order_by('-ordered_date', '-id')

    def respond(self, order):
        """Re-read the order with all relations so the response is complete."""
        fresh = self.base_queryset().get(pk=order.pk)
        return Response(self.get_serializer(fresh).data)

    # ------------------------------------------------------------------
    # Dashboard / filter counts
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'])
    def summary(self, request):
        counts = {code: 0 for code, _ in LabTestOrder.STATUS_CHOICES}
        for row in LabTestOrder.objects.values('status').annotate(total=Count('id')):
            counts[row['status']] = row['total']

        today = timezone.localdate()
        return Response({
            'by_status': counts,
            'total': sum(counts.values()),
            'active': sum(counts[s] for s in ACTIVE_STATUSES),
            'ordered_today': LabTestOrder.objects.filter(ordered_date__date=today).count(),
            'completed_today': LabTestOrder.objects.filter(completed_at__date=today).count(),
        })

    # ------------------------------------------------------------------
    # 1. Billing
    # ------------------------------------------------------------------
    @action(detail=True, methods=['post'])
    def generate_bill(self, request, pk=None):
        order = self.get_object()
        if order.status != 'ORDERED':
            return bad_request('A bill can only be generated for a newly requested order.')
        if active_invoice_for(order):
            return bad_request('This order already has an invoice.')

        data = GenerateBillSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        amount = order.test.price
        discount = data.validated_data['discount']
        if discount > amount:
            return bad_request('Discount cannot be more than the test price.')

        with transaction.atomic():
            LabInvoice.objects.create(
                invoice_number=generate_lab_invoice_number(),
                patient=order.patient,
                lab_order=order,
                amount=amount,
                discount=discount,
                total_amount=amount - discount,
                status='PAID' if amount - discount == 0 else 'PENDING',
            )
            # A fully discounted (free) test goes straight to sample collection
            order.status = 'PAID' if amount - discount == 0 else 'PAYMENT_PENDING'
            order.save(update_fields=['status'])
        return self.respond(order)

    @action(detail=True, methods=['post'])
    def record_payment(self, request, pk=None):
        order = self.get_object()
        if order.status != 'PAYMENT_PENDING':
            return bad_request('Payment can only be recorded for an order that is awaiting payment.')
        invoice = active_invoice_for(order)
        if not invoice:
            return bad_request('Generate the bill before recording payment.')

        data = RecordPaymentSerializer(data=request.data)
        data.is_valid(raise_exception=True)

        balance = invoice.total_amount - paid_amount_for(invoice)
        amount = data.validated_data.get('amount') or balance
        if amount > balance:
            return bad_request(f'Amount is more than the balance due (₹{balance}).')

        with transaction.atomic():
            LabPayment.objects.create(
                invoice=invoice,
                amount=amount,
                payment_method=data.validated_data['payment_method'],
                transaction_id=data.validated_data.get('transaction_id', ''),
            )
            total_paid = paid_amount_for(LabInvoice.objects.prefetch_related('payments').get(pk=invoice.pk))
            if total_paid >= invoice.total_amount:
                invoice.status = 'PAID'
                order.status = 'PAID'
                order.save(update_fields=['status'])
            else:
                invoice.status = 'PARTIAL'
            invoice.save(update_fields=['status'])
        return self.respond(order)

    # ------------------------------------------------------------------
    # 2. Sample collection & processing
    # ------------------------------------------------------------------
    @action(detail=True, methods=['post'])
    def collect_sample(self, request, pk=None):
        order = self.get_object()
        if order.status != 'PAID':
            return bad_request('Sample can be collected only after the bill is fully paid.')
        order.status = 'SAMPLE_COLLECTED'
        order.sample_collected_at = timezone.now()
        order.save(update_fields=['status', 'sample_collected_at'])
        return self.respond(order)

    @action(detail=True, methods=['post'])
    def start_processing(self, request, pk=None):
        order = self.get_object()
        if order.status != 'SAMPLE_COLLECTED':
            return bad_request('Collect the sample before starting processing.')
        order.status = 'PROCESSING'
        order.save(update_fields=['status'])
        return self.respond(order)

    # ------------------------------------------------------------------
    # 3. Result entry -> forwarded to doctor
    # ------------------------------------------------------------------
    @action(detail=True, methods=['post'])
    def submit_result(self, request, pk=None):
        order = self.get_object()
        if order.status != 'PROCESSING':
            return bad_request('Results can be entered only while the order is in processing.')
        if hasattr(order, 'result'):
            return bad_request('A result has already been submitted for this order.')

        technician = get_lab_tech_profile(request)
        if not technician:
            return bad_request('Only a user with a Lab Technician profile can submit results.')

        data = SubmitResultSerializer(data=request.data)
        data.is_valid(raise_exception=True)

        with transaction.atomic():
            LabTestResult.objects.create(
                order=order,
                technician=technician,
                result_value=data.validated_data['result_value'],
                result_status=data.validated_data['result_status'],
                remarks=data.validated_data.get('remarks', ''),
            )
            # COMPLETED = the result is now visible to the doctor at
            # GET /api/doctor/lab-orders/ and /api/doctor/lab-results/
            order.status = 'COMPLETED'
            order.completed_at = timezone.now()
            order.save(update_fields=['status', 'completed_at'])
        return self.respond(order)

    # ------------------------------------------------------------------
    # Cancel (only before money is taken)
    # ------------------------------------------------------------------
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status not in ('ORDERED', 'PAYMENT_PENDING'):
            return bad_request('Only orders that are not yet paid can be cancelled.')
        invoice = active_invoice_for(order)
        if invoice and paid_amount_for(invoice) > 0:
            return bad_request('This order has a payment recorded and cannot be cancelled.')

        with transaction.atomic():
            if invoice:
                invoice.status = 'CANCELLED'
                invoice.save(update_fields=['status'])
            order.status = 'CANCELLED'
            order.save(update_fields=['status'])
        return self.respond(order)


# ============================================================================
# LAB TEST RESULTS (read-only — written through submit_result above)
# ============================================================================

class LabTechLabTestResultViewSet(viewsets.ReadOnlyModelViewSet):
    """Supports filtering by ?order=<id>."""
    serializer_class = LabTestResultSerializer
    permission_classes = [IsLabTechnician]

    def get_queryset(self):
        queryset = LabTestResult.objects.select_related(
            'order', 'order__test', 'order__patient', 'technician', 'technician__user'
        )
        order = self.request.query_params.get('order')
        if order:
            queryset = queryset.filter(order_id=order)
        return queryset.order_by('-result_date')


# ============================================================================
# PATIENT (read-only — for context when processing orders)
# ============================================================================

class LabTechPatientViewSet(viewsets.ReadOnlyModelViewSet):
    """Supports filtering by ?name=<search>."""
    serializer_class = PatientSerializer
    permission_classes = [IsLabTechnician]

    def get_queryset(self):
        queryset = Patient.objects.filter(lab_orders__isnull=False).distinct()
        name = self.request.query_params.get('name')
        if name:
            queryset = queryset.filter(
                Q(first_name__icontains=name) | Q(last_name__icontains=name) | Q(patient_id__icontains=name)
            )
        return queryset


# ============================================================================
# MASTER LAB TEST (read-only reference)
# ============================================================================

class LabTechMasterLabTestViewSet(viewsets.ReadOnlyModelViewSet):
    """Supports filtering by ?name=<search>."""
    serializer_class = MasterLabTestSerializer
    permission_classes = [IsLabTechnician]

    def get_queryset(self):
        queryset = MasterLabTest.objects.filter(is_active=True)
        name = self.request.query_params.get('name')
        if name:
            queryset = queryset.filter(test_name__icontains=name)
        return queryset


# ============================================================================
# LAB INVOICE & PAYMENT (read-only history — created via order actions)
# ============================================================================

class LabTechLabInvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    """Supports filtering by ?patient=<id>, ?status=PENDING|PARTIAL|PAID|CANCELLED, ?search=."""
    serializer_class = LabInvoiceSerializer
    permission_classes = [IsLabTechnician]

    def get_queryset(self):
        queryset = LabInvoice.objects.select_related(
            'patient', 'lab_order', 'lab_order__test', 'lab_order__doctor', 'lab_order__doctor__user'
        ).prefetch_related('payments')

        params = self.request.query_params
        if params.get('patient'):
            queryset = queryset.filter(patient_id=params['patient'])
        if params.get('status'):
            queryset = queryset.filter(status=params['status'].upper())
        search = (params.get('search') or '').strip()
        if search:
            queryset = queryset.filter(
                Q(invoice_number__icontains=search)
                | Q(lab_order__order_number__icontains=search)
                | Q(patient__first_name__icontains=search)
                | Q(patient__last_name__icontains=search)
                | Q(patient__patient_id__icontains=search)
            )
        return queryset.order_by('-created_at', '-id')


class LabTechLabPaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """Supports filtering by ?invoice=<id>."""
    serializer_class = LabPaymentSerializer
    permission_classes = [IsLabTechnician]

    def get_queryset(self):
        queryset = LabPayment.objects.select_related('invoice')
        invoice = self.request.query_params.get('invoice')
        if invoice:
            queryset = queryset.filter(invoice_id=invoice)
        return queryset.order_by('-payment_date')