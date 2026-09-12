from rest_framework import serializers

from apibackendapp.models import (
    PharmacistProfile,
    Patient,
    MasterMedicine,
    StockMaster,
    Prescription,
    PrescriptionItem,
    Dispense,
    DispenseItem,
    PharmacyInvoice,
    PharmacyPayment,
)


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
        model  = PharmacistProfile
        fields = ['id', 'user', 'full_name', 'email', 'employee_id', 'qualification', 'phone']
        read_only_fields = ['employee_id']


# ---------------------------------------------------------------------------
# PATIENT (read-only)
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
# MASTER MEDICINE & STOCK (read-only reference)
# ---------------------------------------------------------------------------

class MasterMedicineSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MasterMedicine
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

    class Meta:
        model  = StockMaster
        fields = [
            'id', 'medicine', 'medicine_name',
            'batch_number', 'expiry_date',
            'quantity', 'selling_price',
            'created_at',
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# PRESCRIPTION & ITEMS (read-only — pharmacist reads what doctor wrote)
# ---------------------------------------------------------------------------

class PrescriptionItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(
        source='medicine.medicine_name', read_only=True
    )
    dosage_name = serializers.CharField(
        source='dosage.dosage_name', read_only=True
    )

    class Meta:
        model  = PrescriptionItem
        fields = [
            'id', 'medicine', 'medicine_name',
            'dosage', 'dosage_name',
            'frequency', 'duration',
            'quantity', 'instructions',
        ]
        read_only_fields = fields


class PrescriptionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source='patient.__str__', read_only=True
    )
    doctor_name = serializers.CharField(
        source='doctor.__str__', read_only=True
    )
    items = PrescriptionItemSerializer(many=True, read_only=True)

    class Meta:
        model  = Prescription
        fields = [
            'id', 'prescription_number',
            'consultation',
            'patient', 'patient_name',
            'doctor', 'doctor_name',
            'notes', 'prescription_date',
            'items',
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# DISPENSE & DISPENSE ITEMS
# Pharmacist creates these when filling a prescription.
# ---------------------------------------------------------------------------

class DispenseItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(
        source='medicine.medicine_name', read_only=True
    )

    class Meta:
        model  = DispenseItem
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
    items = DispenseItemSerializer(many=True, read_only=True)

    class Meta:
        model  = Dispense
        fields = [
            'id', 'dispense_number',
            'prescription',
            'patient', 'patient_name',
            'pharmacist',
            'status', 'dispense_date',
            'items',
        ]
        read_only_fields = ['dispense_number', 'patient', 'pharmacist', 'dispense_date']


# ---------------------------------------------------------------------------
# PHARMACY INVOICE & PAYMENT
# ---------------------------------------------------------------------------

class PharmacyInvoiceSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source='patient.__str__', read_only=True
    )

    class Meta:
        model  = PharmacyInvoice
        fields = [
            'id', 'invoice_number',
            'patient', 'patient_name',
            'dispense',
            'subtotal', 'discount', 'tax', 'total_amount',
            'status', 'created_at',
        ]
        read_only_fields = ['invoice_number', 'patient', 'total_amount', 'created_at']


class PharmacyPaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(
        source='invoice.invoice_number', read_only=True
    )

    class Meta:
        model  = PharmacyPayment
        fields = [
            'id', 'invoice', 'invoice_number',
            'amount', 'payment_method',
            'transaction_id', 'payment_date',
        ]
        read_only_fields = ['payment_date']
