from django.db import transaction

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apibackendapp.models import (
    PharmacistProfile,
    Patient,
    MasterMedicine,
    StockMaster,
    StockTransaction,
    Prescription,
    Dispense,
    DispenseItem,
    PharmacyInvoice,
    PharmacyPayment,
)

from .serializers import (
    PharmacistProfileSerializer,
    PatientSerializer,
    MasterMedicineSerializer,
    StockMasterSerializer,
    PrescriptionSerializer,
    DispenseSerializer,
    DispenseItemSerializer,
    PharmacyInvoiceSerializer,
    PharmacyPaymentSerializer,
)


# ---------------------------------------------------------------------------
# Helper — get the PharmacistProfile of the currently logged-in user
# ---------------------------------------------------------------------------

def get_pharmacist_profile(request):
    try:
        return request.user.pharmacist_profile
    except PharmacistProfile.DoesNotExist:
        return None


def generate_dispense_number():
    last = Dispense.objects.order_by('-id').first()
    next_number = (last.id + 1) if last else 1
    return f"DSP{next_number:05d}"


def generate_pharmacy_invoice_number():
    last = PharmacyInvoice.objects.order_by('-id').first()
    next_number = (last.id + 1) if last else 1
    return f"PINV{next_number:05d}"


# ============================================================================
# PROFILE
# ============================================================================

class PharmacistProfileView(viewsets.ModelViewSet):
    """
    Pharmacist can view and update their own profile only.
    """
    serializer_class = PharmacistProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PharmacistProfile.objects.filter(user=self.request.user)


# ============================================================================
# PRESCRIPTIONS (read-only — pharmacist reads what was written by doctor)
# ============================================================================

class PharmacyPrescriptionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Pharmacist views prescriptions to fill them.
    Supports filtering by ?patient=<id> and ?dispensed=false to show
    only prescriptions that have not yet been fully dispensed.
    """
    serializer_class = PrescriptionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Prescription.objects.all().select_related(
            'patient', 'doctor', 'consultation'
        ).prefetch_related('items__medicine', 'items__dosage', 'dispenses')

        patient   = self.request.query_params.get('patient')
        dispensed = self.request.query_params.get('dispensed')

        if patient:
            queryset = queryset.filter(patient_id=patient)

        # ?dispensed=false → only prescriptions with no DISPENSED dispense record
        if dispensed is not None and dispensed.lower() == 'false':
            queryset = queryset.exclude(dispenses__status='DISPENSED')

        return queryset.order_by('-prescription_date')


# ============================================================================
# DISPENSE
# ============================================================================

class PharmacyDispenseViewSet(viewsets.ModelViewSet):
    """
    Pharmacist creates and manages dispense records.
    Supports filtering by ?patient=<id> and ?status=PENDING|DISPENSED|CANCELLED.

    Custom actions:
      POST /dispenses/{id}/dispense/ — PENDING → DISPENSED
                                       Also deducts stock for each item.
      POST /dispenses/{id}/cancel/   — PENDING → CANCELLED
    """
    serializer_class = DispenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Dispense.objects.all().select_related(
            'prescription', 'patient', 'pharmacist'
        ).prefetch_related('items__medicine')

        patient      = self.request.query_params.get('patient')
        status_param = self.request.query_params.get('status')

        if patient:
            queryset = queryset.filter(patient_id=patient)
        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset.order_by('-dispense_date')

    def perform_create(self, serializer):
        pharmacist   = get_pharmacist_profile(self.request)
        prescription = serializer.validated_data['prescription']
        serializer.save(
            dispense_number=generate_dispense_number(),
            patient=prescription.patient,
            pharmacist=pharmacist,
        )

    @action(detail=True, methods=['post'])
    def dispense(self, request, pk=None):
        """
        POST /dispenses/{id}/dispense/
        Marks the dispense as DISPENSED and deducts stock for each item.
        """
        dispense = self.get_object()
        if dispense.status != 'PENDING':
            return Response(
                {'detail': 'Only PENDING dispenses can be dispensed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            for item in dispense.items.select_related('medicine').all():
                # Deduct from the oldest non-expired batch with enough stock
                stock = (
                    StockMaster.objects
                    .filter(medicine=item.medicine, quantity__gte=item.quantity)
                    .order_by('expiry_date')
                    .first()
                )
                if not stock:
                    return Response(
                        {'detail': f"Insufficient stock for {item.medicine.medicine_name}."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                stock.quantity -= item.quantity
                stock.save(update_fields=['quantity'])

                StockTransaction.objects.create(
                    stock=stock,
                    transaction_type='SALE',
                    quantity=-item.quantity,
                    reference_number=dispense.dispense_number,
                    notes=f"Dispensed for prescription {dispense.prescription.prescription_number}",
                )

            dispense.status = 'DISPENSED'
            dispense.save(update_fields=['status'])

        return Response(self.get_serializer(dispense).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """POST /dispenses/{id}/cancel/ — mark dispense as CANCELLED."""
        dispense = self.get_object()
        if dispense.status != 'PENDING':
            return Response(
                {'detail': 'Only PENDING dispenses can be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        dispense.status = 'CANCELLED'
        dispense.save(update_fields=['status'])
        return Response(self.get_serializer(dispense).data)


# ============================================================================
# DISPENSE ITEMS
# ============================================================================

class PharmacyDispenseItemViewSet(viewsets.ModelViewSet):
    """
    Pharmacist manages individual medicine lines within a dispense.
    Supports filtering by ?dispense=<id>.
    Calculates total_price automatically from quantity × unit_price.
    """
    serializer_class = DispenseItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = DispenseItem.objects.all().select_related('dispense', 'medicine')
        dispense = self.request.query_params.get('dispense')
        if dispense:
            queryset = queryset.filter(dispense_id=dispense)
        return queryset

    def perform_create(self, serializer):
        quantity   = serializer.validated_data['quantity']
        unit_price = serializer.validated_data['unit_price']
        serializer.save(total_price=quantity * unit_price)

    def perform_update(self, serializer):
        quantity   = serializer.validated_data.get('quantity',   serializer.instance.quantity)
        unit_price = serializer.validated_data.get('unit_price', serializer.instance.unit_price)
        serializer.save(total_price=quantity * unit_price)


# ============================================================================
# PHARMACY INVOICE & PAYMENT
# ============================================================================

class PharmacyInvoiceViewSet(viewsets.ModelViewSet):
    """
    Pharmacist raises invoices for dispensed prescriptions.
    Supports filtering by ?patient=<id> and ?status=.
    """
    serializer_class = PharmacyInvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = PharmacyInvoice.objects.all().select_related('patient', 'dispense')

        patient      = self.request.query_params.get('patient')
        status_param = self.request.query_params.get('status')

        if patient:
            queryset = queryset.filter(patient_id=patient)
        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        dispense = serializer.validated_data['dispense']
        subtotal = sum(
            item.total_price for item in dispense.items.all()
        )
        discount = serializer.validated_data.get('discount', 0)
        tax      = serializer.validated_data.get('tax', 0)
        total    = subtotal - discount + tax

        serializer.save(
            invoice_number=generate_pharmacy_invoice_number(),
            patient=dispense.patient,
            subtotal=subtotal,
            total_amount=total,
        )


class PharmacyPaymentViewSet(viewsets.ModelViewSet):
    """
    Pharmacist records payments against a pharmacy invoice and keeps
    the invoice status (PENDING / PARTIAL / PAID) in sync.
    Supports filtering by ?invoice=<id>.
    """
    serializer_class = PharmacyPaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = PharmacyPayment.objects.all().select_related('invoice')
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


# ============================================================================
# STOCK (read-only — pharmacist checks availability before dispensing)
# ============================================================================

class PharmacyStockViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Pharmacist can check current stock levels.
    Supports filtering by ?medicine=<id>.
    """
    serializer_class = StockMasterSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = StockMaster.objects.all().select_related('medicine')
        medicine = self.request.query_params.get('medicine')
        if medicine:
            queryset = queryset.filter(medicine_id=medicine)
        return queryset.order_by('medicine__medicine_name', 'expiry_date')


# ============================================================================
# MASTER MEDICINE (read-only reference)
# ============================================================================

class PharmacyMasterMedicineViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Pharmacist can browse the medicine catalogue.
    Supports filtering by ?name=<search> and ?category=<search>.
    """
    serializer_class = MasterMedicineSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = MasterMedicine.objects.filter(is_active=True)
        name     = self.request.query_params.get('name')
        category = self.request.query_params.get('category')
        if name:
            queryset = queryset.filter(medicine_name__icontains=name)
        if category:
            queryset = queryset.filter(category__icontains=category)
        return queryset


# ============================================================================
# PATIENT (read-only)
# ============================================================================

class PharmacyPatientViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Pharmacist can look up patients by name or ID.
    Supports filtering by ?name=<search>.
    """
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Patient.objects.filter(prescriptions__isnull=False).distinct()
        name = self.request.query_params.get('name')
        if name:
            queryset = queryset.filter(first_name__icontains=name)
        return queryset
