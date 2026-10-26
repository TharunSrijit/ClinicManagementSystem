from decimal import Decimal
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from apibackendapp.models import (
    PharmacistProfile,
    Patient,
    MasterMedicine,
    StockMaster,
    PriceList,
    Prescription,
    PrescriptionItem,
    Dispense,
    DispenseItem,
    PharmacyInvoice,
    PharmacyPayment,
)


def get_medicine_selling_price(medicine):
    """
    Returns the authoritative selling price for a medicine.
    1. Active PriceList entry
    2. Active/unexpired StockMaster entry
    3. Latest StockMaster entry
    4. Fallback 10.00
    """
    price_entry = PriceList.objects.filter(medicine=medicine, is_active=True).first()
    if price_entry and price_entry.selling_price is not None:
        return price_entry.selling_price

    today = timezone.localdate()
    stock_entry = (
        StockMaster.objects
        .filter(medicine=medicine, expiry_date__gt=today, quantity__gt=0)
        .order_by('expiry_date')
        .first()
    )
    if stock_entry and stock_entry.selling_price is not None:
        return stock_entry.selling_price

    latest_stock = StockMaster.objects.filter(medicine=medicine).order_by('-created_at').first()
    if latest_stock and latest_stock.selling_price is not None:
        return latest_stock.selling_price

    return Decimal('10.00')


def get_medicine_available_stock(medicine):
    """Returns total available unexpired stock quantity for a medicine."""
    today = timezone.localdate()
    total = (
        StockMaster.objects
        .filter(medicine=medicine, expiry_date__gt=today)
        .aggregate(total=Sum('quantity'))['total']
    )
    return total or 0


# ---------------------------------------------------------------------------
# PROFILE
# ---------------------------------------------------------------------------

class PharmacistProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(
        source='user.get_full_name', read_only=True
    )
    email = serializers.EmailField(
        source='user.email', read_only=True
    )

    class Meta:
        model = PharmacistProfile
        fields = [
            'id', 'user', 'full_name', 'email', 'employee_id',
            'qualification', 'phone', 'date_of_joining'
        ]
        read_only_fields = ['employee_id']


# ---------------------------------------------------------------------------
# PATIENT (read-only)
# ---------------------------------------------------------------------------

class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = [
            'id', 'patient_id', 'first_name', 'last_name',
            'date_of_birth', 'gender', 'blood_group',
            'phone', 'email',
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# MASTER MEDICINE & STOCK (read-only reference)
# ---------------------------------------------------------------------------

class MasterMedicineSerializer(serializers.ModelSerializer):
    class Meta:
        model = MasterMedicine
        fields = [
            'id', 'medicine_name', 'generic_name',
            'manufacturer', 'category', 'unit',
            'description', 'is_active',
        ]
        read_only_fields = fields


class StockMasterSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(
        source='medicine.medicine_name', read_only=True
    )
    reorder_level = serializers.IntegerField(
        source='medicine.reorder_level',
        read_only=True,
    )

    class Meta:
        model = StockMaster
        fields = [
            'id', 'medicine', 'medicine_name',
            'batch_number', 'expiry_date',
            'quantity', 'reorder_level', 'selling_price',
            'created_at',
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# PRESCRIPTION & ITEMS
# ---------------------------------------------------------------------------

class PrescriptionItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(
        source='medicine.medicine_name', read_only=True
    )
    dosage_name = serializers.CharField(
        source='dosage.dosage_name', read_only=True
    )
    prescribed_quantity = serializers.IntegerField(
        source='quantity', read_only=True
    )
    dispensed_quantity = serializers.SerializerMethodField()
    remaining_quantity = serializers.SerializerMethodField()
    unit_price = serializers.SerializerMethodField()
    available_stock = serializers.SerializerMethodField()

    class Meta:
        model = PrescriptionItem
        fields = [
            'id', 'medicine', 'medicine_name',
            'dosage', 'dosage_name',
            'frequency', 'duration',
            'quantity', 'prescribed_quantity',
            'dispensed_quantity', 'remaining_quantity',
            'unit_price', 'available_stock',
            'instructions',
        ]
        read_only_fields = fields

    def get_dispensed_quantity(self, obj):
        total = (
            DispenseItem.objects
            .filter(
                dispense__prescription=obj.prescription,
                dispense__status='DISPENSED',
                medicine=obj.medicine
            )
            .aggregate(total=Sum('quantity'))['total']
        )
        return total or 0

    def get_remaining_quantity(self, obj):
        dispensed = self.get_dispensed_quantity(obj)
        return max(0, obj.quantity - dispensed)

    def get_unit_price(self, obj):
        return str(get_medicine_selling_price(obj.medicine))

    def get_available_stock(self, obj):
        return get_medicine_available_stock(obj.medicine)


class PrescriptionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source='patient.__str__', read_only=True
    )
    patient_identifier = serializers.CharField(
        source='patient.patient_id', read_only=True
    )
    doctor_name = serializers.CharField(
        source='doctor.__str__', read_only=True
    )
    items = PrescriptionItemSerializer(many=True, read_only=True)
    dispensing_status = serializers.SerializerMethodField()
    dispensing_status_display = serializers.SerializerMethodField()
    active_bill = serializers.SerializerMethodField()

    class Meta:
        model = Prescription
        fields = [
            'id', 'prescription_number',
            'consultation',
            'patient', 'patient_name', 'patient_identifier',
            'doctor', 'doctor_name',
            'notes', 'prescription_date',
            'items',
            'dispensing_status',
            'dispensing_status_display',
            'active_bill',
        ]
        read_only_fields = fields

    def get_dispensing_status(self, obj):
        items = list(obj.items.all())
        if not items:
            return 'AWAITING_BILLING'

        total_prescribed = sum(it.quantity for it in items)
        total_dispensed = (
            DispenseItem.objects
            .filter(dispense__prescription=obj, dispense__status='DISPENSED')
            .aggregate(total=Sum('quantity'))['total']
        ) or 0

        if total_prescribed > 0 and total_dispensed >= total_prescribed:
            return 'FULLY_DISPENSED'

        # Check for active pending dispense
        active_dispense = (
            obj.dispenses
            .filter(status='PENDING')
            .order_by('-id')
            .first()
        )
        if active_dispense:
            invoice = getattr(active_dispense, 'invoice', None)
            if invoice:
                if invoice.status == 'PAID':
                    return 'READY_FOR_DISPENSING'
                return 'AWAITING_PAYMENT'
            return 'AWAITING_BILLING'

        if total_dispensed > 0:
            return 'PARTIALLY_DISPENSED'

        return 'AWAITING_BILLING'

    def get_dispensing_status_display(self, obj):
        mapping = {
            'AWAITING_BILLING': 'Awaiting Pharmacy Billing',
            'AWAITING_PAYMENT': 'Awaiting Payment',
            'READY_FOR_DISPENSING': 'Paid & Ready to Dispense',
            'PARTIALLY_DISPENSED': 'Partially Dispensed',
            'FULLY_DISPENSED': 'Fully Dispensed',
        }
        status_key = self.get_dispensing_status(obj)
        return mapping.get(status_key, status_key)

    def get_active_bill(self, obj):
        active_dispense = (
            obj.dispenses
            .filter(status__in=['PENDING', 'DISPENSED'])
            .order_by('-id')
            .first()
        )
        if not active_dispense:
            return None
        invoice = getattr(active_dispense, 'invoice', None)
        if not invoice:
            return None
        return {
            'invoice_id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'invoice_status': invoice.status,
            'total_amount': str(invoice.total_amount),
            'dispense_id': active_dispense.id,
            'dispense_status': active_dispense.status,
        }


# ---------------------------------------------------------------------------
# DISPENSE & DISPENSE ITEMS
# ---------------------------------------------------------------------------

class DispenseItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(
        source='medicine.medicine_name', read_only=True
    )

    class Meta:
        model = DispenseItem
        fields = [
            'id', 'dispense',
            'medicine', 'medicine_name',
            'quantity', 'unit_price', 'total_price',
        ]
        read_only_fields = ['total_price']


class DispenseSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source='patient.__str__', read_only=True
    )
    prescription_number = serializers.CharField(
        source='prescription.prescription_number', read_only=True
    )
    items = DispenseItemSerializer(many=True, read_only=True)
    invoice_id = serializers.SerializerMethodField()
    invoice_number = serializers.SerializerMethodField()
    invoice_status = serializers.SerializerMethodField()

    class Meta:
        model = Dispense
        fields = [
            'id', 'dispense_number',
            'prescription', 'prescription_number',
            'patient', 'patient_name',
            'pharmacist',
            'status', 'dispense_date',
            'notes',
            'items',
            'invoice_id', 'invoice_number', 'invoice_status',
        ]
        read_only_fields = ['dispense_number', 'patient', 'pharmacist', 'dispense_date']

    def get_invoice_id(self, obj):
        inv = getattr(obj, 'invoice', None)
        return inv.id if inv else None

    def get_invoice_number(self, obj):
        inv = getattr(obj, 'invoice', None)
        return inv.invoice_number if inv else None

    def get_invoice_status(self, obj):
        inv = getattr(obj, 'invoice', None)
        return inv.status if inv else None


# ---------------------------------------------------------------------------
# PHARMACY INVOICE & PAYMENT
# ---------------------------------------------------------------------------

class PharmacyPaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(
        source='invoice.invoice_number', read_only=True
    )

    class Meta:
        model = PharmacyPayment
        fields = [
            'id', 'invoice', 'invoice_number',
            'amount', 'payment_method',
            'transaction_id', 'payment_date',
        ]
        read_only_fields = ['payment_date']


class PharmacyInvoiceSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source='patient.__str__', read_only=True
    )
    patient_identifier = serializers.CharField(
        source='patient.patient_id', read_only=True
    )
    patient_phone = serializers.CharField(
        source='patient.phone', read_only=True
    )
    patient_gender = serializers.CharField(
        source='patient.gender', read_only=True
    )

    dispense_number = serializers.CharField(
        source='dispense.dispense_number', read_only=True
    )
    dispense_status = serializers.CharField(
        source='dispense.status', read_only=True
    )
    dispense_notes = serializers.CharField(
        source='dispense.notes', read_only=True
    )

    prescription_id = serializers.IntegerField(
        source='dispense.prescription.id', read_only=True
    )
    prescription_number = serializers.CharField(
        source='dispense.prescription.prescription_number', read_only=True
    )
    doctor_name = serializers.CharField(
        source='dispense.prescription.doctor.__str__', read_only=True
    )

    items = serializers.SerializerMethodField()
    payments = PharmacyPaymentSerializer(many=True, read_only=True)
    amount_paid = serializers.SerializerMethodField()
    balance_due = serializers.SerializerMethodField()
    clinic_info = serializers.SerializerMethodField()

    class Meta:
        model = PharmacyInvoice
        fields = [
            'id', 'invoice_number',
            'patient', 'patient_name', 'patient_identifier', 'patient_phone', 'patient_gender',
            'dispense', 'dispense_number', 'dispense_status', 'dispense_notes',
            'prescription_id', 'prescription_number', 'doctor_name',
            'items', 'payments', 'amount_paid', 'balance_due',
            'subtotal', 'discount', 'tax', 'total_amount',
            'status', 'created_at',
            'clinic_info',
        ]
        read_only_fields = [
            'invoice_number', 'patient', 'total_amount', 'created_at',
            'amount_paid', 'balance_due', 'items', 'payments', 'clinic_info'
        ]

    def get_items(self, obj):
        dispense = getattr(obj, 'dispense', None)
        if not dispense:
            return []
        return [
            {
                'id': it.id,
                'medicine_id': it.medicine_id,
                'medicine_name': it.medicine.medicine_name,
                'generic_name': it.medicine.generic_name,
                'unit': it.medicine.unit,
                'quantity': it.quantity,
                'unit_price': str(it.unit_price),
                'total_price': str(it.total_price),
            }
            for it in dispense.items.select_related('medicine').all()
        ]

    def get_amount_paid(self, obj):
        total = sum(p.amount for p in obj.payments.all())
        return str(total)

    def get_balance_due(self, obj):
        paid = sum(p.amount for p in obj.payments.all())
        return str(max(Decimal('0.00'), obj.total_amount - paid))

    def get_clinic_info(self, obj):
        return {
            'clinic_name': 'MedCore Clinic',
            'address': '123 Health Avenue, Medical District',
            'phone': '+91 98765 43210',
            'email': 'pharmacy@medcoreclinic.com'
        }
