from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Q
from django.utils import timezone

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apibackendapp.permissions import IsPharmacist

from apibackendapp.models import (
    PharmacistProfile,
    Patient,
    MasterMedicine,
    StockMaster,
    StockTransaction,
    PriceList,
    Prescription,
    PrescriptionItem,
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
    PrescriptionItemSerializer,
    DispenseSerializer,
    DispenseItemSerializer,
    PharmacyInvoiceSerializer,
    PharmacyPaymentSerializer,
    get_medicine_selling_price,
    get_medicine_available_stock,
)


# ---------------------------------------------------------------------------
# Helper — get the PharmacistProfile of the currently logged-in user
# ---------------------------------------------------------------------------

def get_pharmacist_profile(request):
    try:
        return request.user.pharmacist_profile
    except PharmacistProfile.DoesNotExist:
        if request.user.role == 'ADMIN' or getattr(request.user, 'is_superuser', False):
            first_ph = PharmacistProfile.objects.first()
            if first_ph:
                return first_ph
            return PharmacistProfile.objects.create(
                user=request.user,
                employee_id=f"PHM{request.user.id:04d}",
                qualification='B.Pharm',
                phone=request.user.phone or ''
            )
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
    permission_classes = [IsPharmacist]

    def get_queryset(self):
        return PharmacistProfile.objects.filter(user=self.request.user)


# ============================================================================
# PRESCRIPTIONS (read-only queue + bill preparation)
# ============================================================================

class PharmacyPrescriptionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Pharmacist views doctor prescriptions and prepares bills/dispenses.
    Supports filtering by ?patient=<id>, ?status=<AWAITING_BILLING|AWAITING_PAYMENT|READY_FOR_DISPENSING|PARTIALLY_DISPENSED|FULLY_DISPENSED>,
    ?dispensed=false, and ?search=<text>.
    """
    serializer_class = PrescriptionSerializer
    permission_classes = [IsPharmacist]

    def get_queryset(self):
        queryset = Prescription.objects.all().select_related(
            'patient', 'doctor', 'consultation'
        ).prefetch_related(
            'items__medicine', 'items__dosage',
            'dispenses__items', 'dispenses__invoice__payments'
        )

        patient = self.request.query_params.get('patient')
        if patient:
            queryset = queryset.filter(patient_id=patient)

        search = self.request.query_params.get('search')
        if search:
            search = search.strip()
            queryset = queryset.filter(
                Q(prescription_number__icontains=search) |
                Q(patient__first_name__icontains=search) |
                Q(patient__last_name__icontains=search) |
                Q(patient__patient_id__icontains=search) |
                Q(doctor__user__first_name__icontains=search) |
                Q(doctor__user__last_name__icontains=search)
            )

        dispensed = self.request.query_params.get('dispensed')
        if dispensed is not None and dispensed.lower() == 'false':
            queryset = queryset.exclude(dispenses__status='DISPENSED')

        status_param = self.request.query_params.get('status')
        if status_param:
            status_param = status_param.strip().upper()
            all_rxs = list(queryset.order_by('-prescription_date'))
            filtered_ids = [
                rx.id for rx in all_rxs
                if self.get_serializer(rx).data.get('dispensing_status') == status_param
            ]
            return Prescription.objects.filter(id__in=filtered_ids).select_related(
                'patient', 'doctor', 'consultation'
            ).prefetch_related(
                'items__medicine', 'items__dosage',
                'dispenses__items', 'dispenses__invoice__payments'
            ).order_by('-prescription_date')

        return queryset.order_by('-prescription_date')

    @action(detail=True, methods=['post'])
    def create_bill(self, request, pk=None):
        """
        POST /api/pharmacy/prescriptions/{id}/create_bill/
        Creates a proposed Dispense and a PharmacyInvoice based on selected quantities.
        Supports partial dispensing with reasons (affordability, stock shortage, etc.).
        """
        prescription = self.get_object()
        pharmacist = get_pharmacist_profile(request)
        if not pharmacist:
            return Response(
                {'detail': 'A pharmacist profile is required to generate pharmacy bills.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if already fully dispensed
        serializer = self.get_serializer(prescription)
        current_status = serializer.data.get('dispensing_status')
        if current_status == 'FULLY_DISPENSED':
            return Response(
                {'detail': 'This prescription has already been fully dispensed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Prevent duplicate pending bills
        existing_pending = prescription.dispenses.filter(status='PENDING').first()
        if existing_pending:
            inv = getattr(existing_pending, 'invoice', None)
            inv_num = inv.invoice_number if inv else existing_pending.dispense_number
            return Response(
                {
                    'detail': f"An active pending bill ({inv_num}) already exists for this prescription. Please settle or cancel it before creating another bill.",
                    'invoice_id': inv.id if inv else None,
                    'invoice_number': inv_num,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        items_data = request.data.get('items', [])
        if not isinstance(items_data, list) or len(items_data) == 0:
            return Response(
                {'detail': 'Please select at least one medicine item to bill.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        partial_reason = request.data.get('partial_reason', '').strip()
        general_notes = request.data.get('notes', '').strip()
        discount_val = Decimal(str(request.data.get('discount', 0) or 0))
        tax_val = Decimal(str(request.data.get('tax', 0) or 0))

        validated_items = []
        is_partial = False

        rx_items_map = {item.medicine_id: item for item in prescription.items.all()}

        for item_data in items_data:
            medicine_id = item_data.get('medicine_id')
            if not medicine_id or medicine_id not in rx_items_map:
                return Response(
                    {'detail': f"Medicine ID {medicine_id} is not part of prescription {prescription.prescription_number}."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            rx_item = rx_items_map[medicine_id]
            try:
                qty = int(item_data.get('quantity', 0))
            except (ValueError, TypeError):
                return Response(
                    {'detail': f"Invalid quantity for {rx_item.medicine.medicine_name}."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if qty <= 0:
                continue

            # Calculate remaining quantity for this medicine
            already_dispensed = (
                DispenseItem.objects
                .filter(
                    dispense__prescription=prescription,
                    dispense__status='DISPENSED',
                    medicine_id=medicine_id
                )
                .aggregate(total=Sum('quantity'))['total']
            ) or 0

            remaining_qty = max(0, rx_item.quantity - already_dispensed)

            if qty > remaining_qty:
                return Response(
                    {
                        'detail': (
                            f"Cannot bill {qty} units of {rx_item.medicine.medicine_name}; "
                            f"exceeds remaining un-dispensed quantity ({remaining_qty})."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            if qty < remaining_qty:
                is_partial = True

            # Check available stock
            available_stock = get_medicine_available_stock(rx_item.medicine)
            if qty > available_stock:
                return Response(
                    {
                        'detail': (
                            f"Insufficient stock for {rx_item.medicine.medicine_name}. "
                            f"Requested: {qty}, Available: {available_stock}."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            unit_price = get_medicine_selling_price(rx_item.medicine)
            total_price = Decimal(qty) * unit_price

            validated_items.append({
                'medicine': rx_item.medicine,
                'quantity': qty,
                'unit_price': unit_price,
                'total_price': total_price,
                'item_reason': item_data.get('reason', '').strip()
            })

        if not validated_items:
            return Response(
                {'detail': 'All selected quantities were zero. At least one positive quantity must be billed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Format dispense notes
        notes_parts = []
        if is_partial:
            reason_text = partial_reason or "Patient Affordability"
            notes_parts.append(f"Partial Dispensing Reason: {reason_text}")
        if general_notes:
            notes_parts.append(general_notes)
        combined_notes = " | ".join(notes_parts)

        with transaction.atomic():
            dispense = Dispense.objects.create(
                dispense_number=generate_dispense_number(),
                prescription=prescription,
                patient=prescription.patient,
                pharmacist=pharmacist,
                status='PENDING',
                notes=combined_notes
            )

            subtotal = Decimal('0.00')
            for v_item in validated_items:
                DispenseItem.objects.create(
                    dispense=dispense,
                    medicine=v_item['medicine'],
                    quantity=v_item['quantity'],
                    unit_price=v_item['unit_price'],
                    total_price=v_item['total_price']
                )
                subtotal += v_item['total_price']

            total_amount = max(Decimal('0.00'), subtotal - discount_val + tax_val)

            invoice = PharmacyInvoice.objects.create(
                invoice_number=generate_pharmacy_invoice_number(),
                patient=prescription.patient,
                dispense=dispense,
                subtotal=subtotal,
                discount=discount_val,
                tax=tax_val,
                total_amount=total_amount,
                status='PENDING'
            )

        return Response(
            PharmacyInvoiceSerializer(invoice).data,
            status=status.HTTP_201_CREATED
        )


# ============================================================================
# DISPENSE
# ============================================================================

class PharmacyDispenseViewSet(viewsets.ModelViewSet):
    """
    Pharmacist manages dispense records.
    Enforces payment gating before stock deduction.
    """
    serializer_class = DispenseSerializer
    permission_classes = [IsPharmacist]

    def get_queryset(self):
        queryset = Dispense.objects.all().select_related(
            'prescription', 'patient', 'pharmacist'
        ).prefetch_related('items__medicine')

        patient = self.request.query_params.get('patient')
        status_param = self.request.query_params.get('status')

        if patient:
            queryset = queryset.filter(patient_id=patient)
        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset.order_by('-dispense_date')

    def perform_create(self, serializer):
        pharmacist = get_pharmacist_profile(self.request)
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
        PAYMENT GATING: Verifies that the bill is PAID in full before dispensing.
        Atomically deducts stock from oldest non-expired batch and updates status.
        """
        dispense = self.get_object()
        if dispense.status != 'PENDING':
            return Response(
                {'detail': f"Only PENDING dispenses can be dispensed. Current status is {dispense.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # -------------------------------------------------------------------
        # PAYMENT GATING VERIFICATION
        # -------------------------------------------------------------------
        try:
            invoice = dispense.invoice
        except PharmacyInvoice.DoesNotExist:
            return Response(
                {'detail': 'No pharmacy invoice is linked to this dispense. Please create a bill and record payment first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if invoice.status != 'PAID':
            return Response(
                {
                    'detail': (
                        f"Payment required before dispensing. Invoice {invoice.invoice_number} "
                        f"is currently {invoice.get_status_display()} and must be settled in full."
                    ),
                    'invoice_id': invoice.id,
                    'invoice_status': invoice.status,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # -------------------------------------------------------------------
        # INVENTORY DEDUCTION & ATOMIC DISPENSING
        # -------------------------------------------------------------------
        with transaction.atomic():
            for item in dispense.items.select_related('medicine').all():
                if not getattr(item.medicine, 'is_active', True):
                    return Response(
                        {'detail': f"Medicine '{item.medicine.medicine_name}' is deactivated and cannot be dispensed."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                today = timezone.localdate()
                stock = (
                    StockMaster.objects
                    .filter(medicine=item.medicine, quantity__gte=item.quantity, expiry_date__gt=today)
                    .order_by('expiry_date')
                    .first()
                )
                if not stock:
                    has_expired = StockMaster.objects.filter(medicine=item.medicine, expiry_date__lte=today).exists()
                    if has_expired:
                        return Response(
                            {'detail': f"Stock for {item.medicine.medicine_name} is expired or insufficient and cannot be dispensed."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    return Response(
                        {'detail': f"Insufficient stock for {item.medicine.medicine_name}. Required: {item.quantity}."},
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
        """POST /dispenses/{id}/cancel/ — mark dispense as CANCELLED and cancel unpaid bill."""
        dispense = self.get_object()
        if dispense.status != 'PENDING':
            return Response(
                {'detail': 'Only PENDING dispenses can be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            dispense.status = 'CANCELLED'
            dispense.save(update_fields=['status'])

            inv = getattr(dispense, 'invoice', None)
            if inv and inv.status != 'PAID':
                inv.status = 'CANCELLED'
                inv.save(update_fields=['status'])

        return Response(self.get_serializer(dispense).data)


# ============================================================================
# DISPENSE ITEMS
# ============================================================================

class PharmacyDispenseItemViewSet(viewsets.ModelViewSet):
    """
    Pharmacist manages individual medicine lines within a dispense.
    """
    serializer_class = DispenseItemSerializer
    permission_classes = [IsPharmacist]

    def get_queryset(self):
        queryset = DispenseItem.objects.all().select_related('dispense', 'medicine')
        dispense = self.request.query_params.get('dispense')
        if dispense:
            queryset = queryset.filter(dispense_id=dispense)
        return queryset

    def perform_create(self, serializer):
        quantity = serializer.validated_data['quantity']
        unit_price = serializer.validated_data['unit_price']
        serializer.save(total_price=quantity * unit_price)

    def perform_update(self, serializer):
        quantity = serializer.validated_data.get('quantity', serializer.instance.quantity)
        unit_price = serializer.validated_data.get('unit_price', serializer.instance.unit_price)
        serializer.save(total_price=quantity * unit_price)


# ============================================================================
# PHARMACY INVOICE & PAYMENT
# ============================================================================

class PharmacyInvoiceViewSet(viewsets.ModelViewSet):
    """
    Pharmacist raises and views invoices for pharmacy dispenses.
    Supports filtering by ?patient=<id>, ?status=, and ?search=.
    """
    serializer_class = PharmacyInvoiceSerializer
    permission_classes = [IsPharmacist]

    def get_queryset(self):
        queryset = PharmacyInvoice.objects.all().select_related(
            'patient', 'dispense__prescription__doctor'
        ).prefetch_related(
            'dispense__items__medicine',
            'payments'
        )

        patient = self.request.query_params.get('patient')
        status_param = self.request.query_params.get('status')
        search = self.request.query_params.get('search')

        if patient:
            queryset = queryset.filter(patient_id=patient)
        if status_param:
            queryset = queryset.filter(status=status_param)
        if search:
            search = search.strip()
            queryset = queryset.filter(
                Q(invoice_number__icontains=search) |
                Q(patient__first_name__icontains=search) |
                Q(patient__last_name__icontains=search) |
                Q(patient__patient_id__icontains=search) |
                Q(dispense__dispense_number__icontains=search) |
                Q(dispense__prescription__prescription_number__icontains=search)
            )

        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        dispense = serializer.validated_data['dispense']
        subtotal = sum(
            item.total_price for item in dispense.items.all()
        )
        discount = serializer.validated_data.get('discount', 0)
        tax = serializer.validated_data.get('tax', 0)
        total = max(Decimal('0.00'), subtotal - discount + tax)

        serializer.save(
            invoice_number=generate_pharmacy_invoice_number(),
            patient=dispense.patient,
            subtotal=subtotal,
            total_amount=total,
        )


class PharmacyPaymentViewSet(viewsets.ModelViewSet):
    """
    Pharmacist records payments against a pharmacy invoice.
    Updates invoice status to PAID or PARTIAL.
    """
    serializer_class = PharmacyPaymentSerializer
    permission_classes = [IsPharmacist]

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
    """
    serializer_class = StockMasterSerializer
    permission_classes = [IsPharmacist]

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
    """
    serializer_class = MasterMedicineSerializer
    permission_classes = [IsPharmacist]

    def get_queryset(self):
        queryset = MasterMedicine.objects.filter(is_active=True)
        name = self.request.query_params.get('name')
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
    """
    serializer_class = PatientSerializer
    permission_classes = [IsPharmacist]

    def get_queryset(self):
        queryset = Patient.objects.filter(prescriptions__isnull=False).distinct()
        name = self.request.query_params.get('name')
        if name:
            queryset = queryset.filter(
                Q(first_name__icontains=name) |
                Q(last_name__icontains=name) |
                Q(patient_id__icontains=name)
            )
        return queryset
