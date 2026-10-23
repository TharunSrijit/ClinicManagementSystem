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
# PROFILE
# ---------------------------------------------------------------------------

class LabTechnicianProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(
        source='user.get_full_name', read_only=True
    )
    email = serializers.EmailField(
        source='user.email', read_only=True
    )

    class Meta:
        model  = LabTechnicianProfile
        fields = ['id', 'user', 'full_name', 'email', 'employee_id', 'qualification', 'phone']
        read_only_fields = ['employee_id']


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
            'id', 'test_code', 'test_name', 'description',
            'normal_range', 'unit', 'price', 'is_active',
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# LAB TEST RESULT
# Lab tech creates and updates results.
# ---------------------------------------------------------------------------

class LabTestResultSerializer(serializers.ModelSerializer):
    test_name = serializers.CharField(
        source='order.test.test_name', read_only=True
    )
    patient_name = serializers.CharField(
        source='order.patient.__str__', read_only=True
    )

    class Meta:
        model  = LabTestResult
        fields = [
            'id', 'order', 'test_name', 'patient_name',
            'technician',
            'result_value', 'result_status',
            'remarks', 'result_date',
        ]
        read_only_fields = ['technician', 'result_date']


# ---------------------------------------------------------------------------
# LAB TEST ORDER
# Lab tech views orders and advances their status.
# ---------------------------------------------------------------------------

class LabTestOrderSerializer(serializers.ModelSerializer):
    test_name = serializers.CharField(
        source='test.test_name', read_only=True
    )
    patient_name = serializers.CharField(
        source='patient.__str__', read_only=True
    )
    result = LabTestResultSerializer(read_only=True)

    class Meta:
        model  = LabTestOrder
        fields = [
            'id', 'order_number',
            'patient', 'patient_name',
            'doctor',
            'consultation',
            'test', 'test_name',
            'status',
            'ordered_date', 'sample_collected_at',
            'result',
        ]
        read_only_fields = ['order_number', 'patient', 'doctor', 'consultation', 'test', 'ordered_date']


# ---------------------------------------------------------------------------
# LAB INVOICE & PAYMENT
# ---------------------------------------------------------------------------

class LabInvoiceSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source='patient.__str__', read_only=True
    )
    test_name = serializers.CharField(
        source='lab_order.test.test_name', read_only=True
    )

    class Meta:
        model  = LabInvoice
        fields = [
            'id', 'invoice_number',
            'patient', 'patient_name',
            'lab_order', 'test_name',
            'amount', 'discount', 'total_amount',
            'status', 'created_at',
        ]
        read_only_fields = ['invoice_number', 'patient', 'total_amount', 'created_at']


class LabPaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(
        source='invoice.invoice_number', read_only=True
    )

    class Meta:
        model  = LabPayment
        fields = [
            'id', 'invoice', 'invoice_number',
            'amount', 'payment_method',
            'transaction_id', 'payment_date',
        ]
        read_only_fields = ['payment_date']
