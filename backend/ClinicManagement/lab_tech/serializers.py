from datetime import date
from decimal import Decimal

from rest_framework import serializers

from apibackendapp.models import (
    LabTechnicianProfile,
    Patient,
    MasterLabTest,
    LabTestOrder,
    LabTestResult,
    LabInvoice,
    LabPayment,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def active_invoice_for(order):
    """Latest non-cancelled invoice of an order (uses prefetched data when present)."""
    invoices = [inv for inv in order.invoices.all() if inv.status != 'CANCELLED']
    if not invoices:
        return None
    return max(invoices, key=lambda inv: inv.id)


def paid_amount_for(invoice):
    return sum((p.amount for p in invoice.payments.all()), Decimal('0'))


def age_from_dob(dob):
    if not dob:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


# ---------------------------------------------------------------------------
# PROFILE
# ---------------------------------------------------------------------------

class LabTechnicianProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model  = LabTechnicianProfile
        fields = ['id', 'user', 'full_name', 'email', 'employee_id', 'qualification', 'phone', 'date_of_joining']
        read_only_fields = ['user', 'employee_id']


# ---------------------------------------------------------------------------
# PATIENT (read-only — lab tech views patient details for context)
# ---------------------------------------------------------------------------

class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Patient
        fields = [
            'id', 'patient_id', 'first_name', 'last_name',
            'date_of_birth', 'gender', 'blood_group',
            'phone', 'email',
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# MASTER LAB TEST (read-only reference)
# ---------------------------------------------------------------------------

class MasterLabTestSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MasterLabTest
        fields = [
            'id', 'test_code', 'test_name', 'category', 'description',
            'normal_range', 'unit', 'price', 'is_active',
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# LAB TEST RESULT (read-only — results are written via
# POST /lab-orders/{id}/submit_result/ so the order status stays in sync)
# ---------------------------------------------------------------------------

class LabTestResultSerializer(serializers.ModelSerializer):
    test_name = serializers.CharField(source='order.test.test_name', read_only=True)
    patient_name = serializers.CharField(source='order.patient.__str__', read_only=True)
    technician_name = serializers.CharField(source='technician.__str__', read_only=True)

    class Meta:
        model  = LabTestResult
        fields = [
            'id', 'order', 'test_name', 'patient_name',
            'technician', 'technician_name',
            'result_value', 'result_status',
            'remarks', 'result_date',
        ]
        read_only_fields = fields


class SubmitResultSerializer(serializers.Serializer):
    """Input for POST /lab-orders/{id}/submit_result/"""
    RESULT_STATUS_CHOICES = ['NORMAL', 'ABNORMAL', 'CRITICAL']

    result_value  = serializers.CharField(max_length=2000)
    result_status = serializers.ChoiceField(choices=RESULT_STATUS_CHOICES, default='NORMAL')
    remarks       = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_result_value(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Result value is required.')
        return value


# ---------------------------------------------------------------------------
# BILLING INPUTS
# ---------------------------------------------------------------------------

class GenerateBillSerializer(serializers.Serializer):
    """Input for POST /lab-orders/{id}/generate_bill/"""
    discount = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, default=Decimal('0'),
        min_value=Decimal('0'),
    )


class RecordPaymentSerializer(serializers.Serializer):
    """Input for POST /lab-orders/{id}/record_payment/"""
    amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, min_value=Decimal('0.01'),
    )
    payment_method = serializers.ChoiceField(choices=[c[0] for c in LabPayment.PAYMENT_METHOD_CHOICES])
    transaction_id = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')

    def validate(self, attrs):
        if attrs['payment_method'] in ('CARD', 'UPI', 'ONLINE') and not attrs.get('transaction_id', '').strip():
            raise serializers.ValidationError(
                {'transaction_id': 'Transaction / reference ID is required for non-cash payments.'}
            )
        return attrs


# ---------------------------------------------------------------------------
# LAB INVOICE & PAYMENT (read-only lists for the billing page)
# ---------------------------------------------------------------------------

class LabPaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)

    class Meta:
        model  = LabPayment
        fields = [
            'id', 'invoice', 'invoice_number',
            'amount', 'payment_method',
            'transaction_id', 'payment_date',
        ]
        read_only_fields = fields


class LabInvoiceSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.__str__', read_only=True)
    test_name    = serializers.CharField(source='lab_order.test.test_name', read_only=True)
    order_number = serializers.CharField(source='lab_order.order_number', read_only=True)
    order_status = serializers.CharField(source='lab_order.status', read_only=True)
    doctor_name  = serializers.CharField(source='lab_order.doctor.__str__', read_only=True)
    paid_amount  = serializers.SerializerMethodField()
    balance      = serializers.SerializerMethodField()
    payments     = LabPaymentSerializer(many=True, read_only=True)

    class Meta:
        model  = LabInvoice
        fields = [
            'id', 'invoice_number',
            'patient', 'patient_name',
            'lab_order', 'order_number', 'order_status', 'test_name', 'doctor_name',
            'amount', 'discount', 'total_amount',
            'paid_amount', 'balance',
            'status', 'created_at', 'payments',
        ]
        read_only_fields = fields

    def get_paid_amount(self, obj):
        return str(paid_amount_for(obj))

    def get_balance(self, obj):
        return str(max(obj.total_amount - paid_amount_for(obj), Decimal('0')))


# ---------------------------------------------------------------------------
# LAB TEST ORDER
# Read-only: every status change goes through a workflow action in views.py
# ---------------------------------------------------------------------------

class LabTestOrderSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    patient_name   = serializers.CharField(source='patient.__str__', read_only=True)
    patient_code   = serializers.CharField(source='patient.patient_id', read_only=True)
    patient_gender = serializers.CharField(source='patient.gender', read_only=True)
    patient_phone  = serializers.CharField(source='patient.phone', read_only=True)
    patient_age    = serializers.SerializerMethodField()

    doctor_name    = serializers.CharField(source='doctor.__str__', read_only=True)

    test_name      = serializers.CharField(source='test.test_name', read_only=True)
    test_code      = serializers.CharField(source='test.test_code', read_only=True)
    normal_range   = serializers.CharField(source='test.normal_range', read_only=True)
    unit           = serializers.CharField(source='test.unit', read_only=True)
    price          = serializers.DecimalField(source='test.price', max_digits=10, decimal_places=2, read_only=True)

    invoice        = serializers.SerializerMethodField()
    result         = LabTestResultSerializer(read_only=True)

    class Meta:
        model  = LabTestOrder
        fields = [
            'id', 'order_number',
            'status', 'status_display',
            'patient', 'patient_name', 'patient_code', 'patient_gender', 'patient_age', 'patient_phone',
            'doctor', 'doctor_name',
            'consultation',
            'test', 'test_name', 'test_code', 'normal_range', 'unit', 'price',
            'ordered_date', 'sample_collected_at', 'completed_at',
            'invoice',
            'result',
        ]
        read_only_fields = fields

    def get_patient_age(self, obj):
        return age_from_dob(obj.patient.date_of_birth)

    def get_invoice(self, obj):
        invoice = active_invoice_for(obj)
        if not invoice:
            return None
        paid = paid_amount_for(invoice)
        return {
            'id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'amount': str(invoice.amount),
            'discount': str(invoice.discount),
            'total_amount': str(invoice.total_amount),
            'paid_amount': str(paid),
            'balance': str(max(invoice.total_amount - paid, Decimal('0'))),
            'status': invoice.status,
            'created_at': invoice.created_at,
        }