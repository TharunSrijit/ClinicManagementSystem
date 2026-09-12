from django.utils import timezone
from django.db import transaction

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

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
)


# ---------------------------------------------------------------------------
# Helper — get the LabTechnicianProfile of the currently logged-in user
# ---------------------------------------------------------------------------

def get_lab_tech_profile(request):
    try:
        return request.user.lab_technician_profile
    except LabTechnicianProfile.DoesNotExist:
        return None


def generate_lab_invoice_number():
    last = LabInvoice.objects.order_by('-id').first()
    next_number = (last.id + 1) if last else 1
    return f"LINV{next_number:05d}"


# ============================================================================
# PROFILE
# ============================================================================

class LabTechProfileView(viewsets.ModelViewSet):
    """
    Lab technician can view and update their own profile only.
    """
    serializer_class = LabTechnicianProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return LabTechnicianProfile.objects.filter(user=self.request.user)


# ============================================================================
# LAB TEST ORDERS
# ============================================================================

class LabTechLabTestOrderViewSet(viewsets.ModelViewSet):
    """
    Lab technician views and manages test orders assigned to them.
    Supports filtering by ?status=ORDERED|SAMPLE_COLLECTED|PROCESSING|COMPLETED
    and ?patient=<id>.

    Custom actions:
      POST /lab-orders/{id}/collect_sample/  — ORDERED → SAMPLE_COLLECTED
      POST /lab-orders/{id}/start_processing/ — SAMPLE_COLLECTED → PROCESSING
      POST /lab-orders/{id}/complete/         — PROCESSING → COMPLETED
    """
    serializer_class = LabTestOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = LabTestOrder.objects.all().select_related(
            'patient', 'doctor', 'test', 'consultation'
        ).prefetch_related('result')

        status_param = self.request.query_params.get('status')
        patient      = self.request.query_params.get('patient')

        if status_param:
            queryset = queryset.filter(status=status_param)
        if patient:
            queryset = queryset.filter(patient_id=patient)

        return queryset.order_by('ordered_date')

    @action(detail=True, methods=['post'])
    def collect_sample(self, request, pk=None):
        """POST /lab-orders/{id}/collect_sample/ — mark sample as collected."""
        order = self.get_object()
        if order.status != 'ORDERED':
            return Response(
                {'detail': 'Order must be in ORDERED status to collect sample.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        order.status = 'SAMPLE_COLLECTED'
        order.sample_collected_at = timezone.now()
        order.save(update_fields=['status', 'sample_collected_at'])
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=['post'])
    def start_processing(self, request, pk=None):
        """POST /lab-orders/{id}/start_processing/ — move to PROCESSING."""
        order = self.get_object()
        if order.status != 'SAMPLE_COLLECTED':
            return Response(
                {'detail': 'Order must be in SAMPLE_COLLECTED status to start processing.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        order.status = 'PROCESSING'
        order.save(update_fields=['status'])
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """POST /lab-orders/{id}/complete/ — mark order as COMPLETED."""
        order = self.get_object()
        if order.status != 'PROCESSING':
            return Response(
                {'detail': 'Order must be in PROCESSING status to complete.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        order.status = 'COMPLETED'
        order.save(update_fields=['status'])
        return Response(self.get_serializer(order).data)


# ============================================================================
# LAB TEST RESULTS
# ============================================================================

class LabTechLabTestResultViewSet(viewsets.ModelViewSet):
    """
    Lab technician creates and updates test results.
    Supports filtering by ?order=<id>.
    """
    serializer_class = LabTestResultSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = LabTestResult.objects.all().select_related(
            'order', 'order__test', 'order__patient', 'technician'
        )
        order = self.request.query_params.get('order')
        if order:
            queryset = queryset.filter(order_id=order)
        return queryset.order_by('-result_date')

    def perform_create(self, serializer):
        tech = get_lab_tech_profile(self.request)
        serializer.save(technician=tech)


# ============================================================================
# PATIENT (read-only — for context when processing orders)
# ============================================================================

class LabTechPatientViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Lab technician can look up patients whose orders they are processing.
    Supports filtering by ?name=<search>.
    """
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Patient.objects.filter(
            lab_orders__isnull=False
        ).distinct()

        name = self.request.query_params.get('name')
        if name:
            queryset = queryset.filter(first_name__icontains=name)

        return queryset


# ============================================================================
# MASTER LAB TEST (read-only reference)
# ============================================================================

class LabTechMasterLabTestViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Lab technician can browse available tests for reference.
    Supports filtering by ?name=<search>.
    """
    serializer_class = MasterLabTestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = MasterLabTest.objects.filter(is_active=True)
        name = self.request.query_params.get('name')
        if name:
            queryset = queryset.filter(test_name__icontains=name)
        return queryset


# ============================================================================
# LAB INVOICE & PAYMENT
# ============================================================================

class LabTechLabInvoiceViewSet(viewsets.ModelViewSet):
    """
    Lab technician raises invoices for completed lab orders.
    Supports filtering by ?patient=<id> and ?status=.
    """
    serializer_class = LabInvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = LabInvoice.objects.all().select_related('patient', 'lab_order')

        patient     = self.request.query_params.get('patient')
        status_param = self.request.query_params.get('status')

        if patient:
            queryset = queryset.filter(patient_id=patient)
        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        lab_order = serializer.validated_data['lab_order']
        amount    = serializer.validated_data.get('amount') or lab_order.test.price
        discount  = serializer.validated_data.get('discount', 0)
        total     = amount - discount

        serializer.save(
            invoice_number=generate_lab_invoice_number(),
            patient=lab_order.patient,
            amount=amount,
            total_amount=total,
        )


class LabTechLabPaymentViewSet(viewsets.ModelViewSet):
    """
    Lab technician records payments against a lab invoice and keeps
    the invoice status (PENDING / PARTIAL / PAID) in sync.
    Supports filtering by ?invoice=<id>.
    """
    serializer_class = LabPaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = LabPayment.objects.all().select_related('invoice')
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
