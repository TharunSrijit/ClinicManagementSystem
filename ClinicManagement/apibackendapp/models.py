from django.db import models
from django.conf import settings
from django.utils import timezone
from django.contrib.auth.models import AbstractUser


# ---------------------------------------------------------------------------
# 1. USER & ROLE PROFILES
# ---------------------------------------------------------------------------

class User(AbstractUser):
    ROLE_CHOICES = [
        ('ADMIN', 'Admin'),
        ('RECEPTIONIST', 'Receptionist'),
        ('DOCTOR', 'Doctor'),
        ('LAB_TECHNICIAN', 'Lab Technician'),
        ('PHARMACIST', 'Pharmacist'),
    ]

    role = models.CharField(
        max_length=30,
        choices=ROLE_CHOICES,
        default='RECEPTIONIST'
    )

    phone = models.CharField(max_length=15, blank=True)
    email = models.EmailField(unique=True, blank=True, null=True)
    REQUIRED_FIELDS = []  # removes email from createsuperuser prompt

    def __str__(self):
        return self.username


class ReceptionistProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='receptionist_profile'
    )

    employee_id = models.CharField(max_length=30, unique=True)
    phone = models.CharField(max_length=15)

    def __str__(self):
        return self.user.get_full_name() or self.user.username


class DoctorProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='doctor_profile'
    )

    doctor_id = models.CharField(max_length=30, unique=True)
    specialization = models.CharField(max_length=100)
    qualification = models.CharField(max_length=150)
    registration_number = models.CharField(
        max_length=50,
        unique=True
    )
    consultation_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )
    available_from = models.TimeField(null=True, blank=True)
    available_to = models.TimeField(null=True, blank=True)

    def __str__(self):
        return f"Dr. {self.user.get_full_name()}"


class LabTechnicianProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='lab_technician_profile'
    )

    employee_id = models.CharField(max_length=30, unique=True)
    qualification = models.CharField(max_length=150)
    phone = models.CharField(max_length=15)

    def __str__(self):
        return self.user.get_full_name() or self.user.username


class PharmacistProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='pharmacist_profile'
    )

    employee_id = models.CharField(max_length=30, unique=True)
    qualification = models.CharField(max_length=150)
    phone = models.CharField(max_length=15)

    def __str__(self):
        return self.user.get_full_name() or self.user.username


# ---------------------------------------------------------------------------
# 2. PATIENT
# ---------------------------------------------------------------------------

class Patient(models.Model):

    GENDER_CHOICES = [
        ('MALE', 'Male'),
        ('FEMALE', 'Female'),
        ('OTHER', 'Other'),
    ]

    BLOOD_GROUP_CHOICES = [
        ('A+', 'A+'),
        ('A-', 'A-'),
        ('B+', 'B+'),
        ('B-', 'B-'),
        ('AB+', 'AB+'),
        ('AB-', 'AB-'),
        ('O+', 'O+'),
        ('O-', 'O-'),
    ]

    patient_id = models.CharField(
        max_length=30,
        unique=True
    )

    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)

    date_of_birth = models.DateField(
        null=True,
        blank=True
    )

    gender = models.CharField(
        max_length=10,
        choices=GENDER_CHOICES
    )

    blood_group = models.CharField(
        max_length=5,
        choices=BLOOD_GROUP_CHOICES,
        blank=True
    )

    phone = models.CharField(max_length=15)
    email = models.EmailField(blank=True)

    address = models.TextField(blank=True)

    emergency_contact_name = models.CharField(
        max_length=100,
        blank=True
    )

    emergency_contact_phone = models.CharField(
        max_length=15,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.patient_id} - {self.first_name} {self.last_name}"


class MedicalHistory(models.Model):

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name='medical_histories'
    )

    medical_condition = models.CharField(max_length=200)

    description = models.TextField(
        blank=True
    )

    diagnosed_date = models.DateField(
        null=True,
        blank=True
    )

    allergies = models.TextField(
        blank=True
    )

    previous_surgeries = models.TextField(
        blank=True
    )

    current_medications = models.TextField(
        blank=True
    )

    family_history = models.TextField(
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.patient} - {self.medical_condition}"


# ---------------------------------------------------------------------------
# 3. APPOINTMENTS
# ---------------------------------------------------------------------------

class Appointment(models.Model):

    STATUS_CHOICES = [
        ('BOOKED', 'Booked'),
        ('CONFIRMED', 'Confirmed'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
        ('NO_SHOW', 'No Show'),
    ]

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name='appointments'
    )

    doctor = models.ForeignKey(
        DoctorProfile,
        on_delete=models.PROTECT,
        related_name='appointments'
    )

    receptionist = models.ForeignKey(
        ReceptionistProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='appointments_created'
    )

    appointment_date = models.DateField(default=timezone.now)
    appointment_time = models.TimeField(null=True)

    reason = models.TextField(
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='BOOKED'
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return (
            f"{self.patient} - "
            f"{self.doctor} - "
            f"{self.appointment_date}"
        )


# ---------------------------------------------------------------------------
# 4. CONSULTATION BILLING
# ---------------------------------------------------------------------------

class ConsultationInvoice(models.Model):

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PARTIAL', 'Partially Paid'),
        ('PAID', 'Paid'),
        ('CANCELLED', 'Cancelled'),
    ]

    invoice_number = models.CharField(
        max_length=30,
        unique=True
    )

    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        related_name='consultation_invoices'
    )

    appointment = models.OneToOneField(
        Appointment,
        on_delete=models.PROTECT,
        related_name='consultation_invoice'
    )

    consultation_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    discount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )

    tax = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )

    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.invoice_number


class ConsultationPayment(models.Model):

    PAYMENT_METHOD_CHOICES = [
        ('CASH', 'Cash'),
        ('CARD', 'Card'),
        ('UPI', 'UPI'),
        ('ONLINE', 'Online'),
    ]

    invoice = models.ForeignKey(
        ConsultationInvoice,
        on_delete=models.PROTECT,
        related_name='payments'
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES
    )

    transaction_id = models.CharField(
        max_length=100,
        blank=True
    )

    payment_date = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.invoice.invoice_number} - {self.amount}"


class Token(models.Model):

    STATUS_CHOICES = [
        ('WAITING', 'Waiting'),
        ('CALLED', 'Called'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    appointment = models.OneToOneField(
        Appointment,
        on_delete=models.CASCADE,
        related_name='token'
    )

    token_number = models.PositiveIntegerField()

    token_date = models.DateField()

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='WAITING'
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"Token {self.token_number}"


class Consultation(models.Model):

    appointment = models.OneToOneField(
        Appointment,
        on_delete=models.PROTECT,
        related_name='consultation'
    )

    doctor = models.ForeignKey(
        DoctorProfile,
        on_delete=models.PROTECT,
        related_name='consultations'
    )

    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        related_name='consultations'
    )

    symptoms = models.TextField(
        blank=True
    )

    diagnosis = models.TextField(
        blank=True
    )

    clinical_notes = models.TextField(
        blank=True
    )

    treatment_plan = models.TextField(
        blank=True
    )

    consultation_date = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.patient} - {self.consultation_date}"


# ---------------------------------------------------------------------------
# 5. PRESCRIPTION
# ---------------------------------------------------------------------------

class MasterDosage(models.Model):

    dosage_name = models.CharField(
        max_length=100,
        unique=True
    )

    description = models.TextField(
        blank=True
    )

    def __str__(self):
        return self.dosage_name


class MasterMedicine(models.Model):

    medicine_name = models.CharField(
        max_length=150
    )

    generic_name = models.CharField(
        max_length=150,
        blank=True
    )

    manufacturer = models.CharField(
        max_length=150,
        blank=True
    )

    category = models.CharField(
        max_length=100,
        blank=True
    )

    unit = models.CharField(
        max_length=30,
        default='Tablet'
    )

    description = models.TextField(
        blank=True
    )

    is_active = models.BooleanField(
        default=True
    )

    def __str__(self):
        return self.medicine_name


class Prescription(models.Model):

    prescription_number = models.CharField(
        max_length=30,
        unique=True
    )

    consultation = models.OneToOneField(
        Consultation,
        on_delete=models.PROTECT,
        related_name='prescription'
    )

    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        related_name='prescriptions'
    )

    doctor = models.ForeignKey(
        DoctorProfile,
        on_delete=models.PROTECT,
        related_name='prescriptions'
    )

    notes = models.TextField(
        blank=True
    )

    prescription_date = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.prescription_number


class PrescriptionItem(models.Model):

    prescription = models.ForeignKey(
        Prescription,
        on_delete=models.CASCADE,
        related_name='items'
    )

    medicine = models.ForeignKey(
        MasterMedicine,
        on_delete=models.PROTECT,
        related_name='prescription_items'
    )

    dosage = models.ForeignKey(
        MasterDosage,
        on_delete=models.PROTECT,
        related_name='prescription_items'
    )

    frequency = models.CharField(
        max_length=100
    )

    duration = models.CharField(
        max_length=100
    )

    quantity = models.PositiveIntegerField()

    instructions = models.TextField(
        blank=True
    )

    def __str__(self):
        return f"{self.prescription} - {self.medicine}"


# ---------------------------------------------------------------------------
# 6. LAB MODULE
# ---------------------------------------------------------------------------

class MasterLabTest(models.Model):

    test_code = models.CharField(
        max_length=30,
        unique=True
    )

    test_name = models.CharField(
        max_length=150
    )

    description = models.TextField(
        blank=True
    )

    normal_range = models.CharField(
        max_length=200,
        blank=True
    )

    unit = models.CharField(
        max_length=50,
        blank=True
    )

    price = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    is_active = models.BooleanField(
        default=True
    )

    def __str__(self):
        return f"{self.test_code} - {self.test_name}"


class LabTestOrder(models.Model):

    STATUS_CHOICES = [
        ('ORDERED', 'Ordered'),
        ('SAMPLE_COLLECTED', 'Sample Collected'),
        ('PROCESSING', 'Processing'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    order_number = models.CharField(
        max_length=30,
        unique=True
    )

    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        related_name='lab_orders'
    )

    doctor = models.ForeignKey(
        DoctorProfile,
        on_delete=models.PROTECT,
        related_name='lab_orders'
    )

    consultation = models.ForeignKey(
        Consultation,
        on_delete=models.PROTECT,
        related_name='lab_orders',
        null=True,
        blank=True
    )

    test = models.ForeignKey(
        MasterLabTest,
        on_delete=models.PROTECT,
        related_name='orders'
    )

    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default='ORDERED'
    )

    ordered_date = models.DateTimeField(
        auto_now_add=True
    )

    sample_collected_at = models.DateTimeField(
        null=True,
        blank=True
    )

    def __str__(self):
        return self.order_number


class LabTestResult(models.Model):

    order = models.OneToOneField(
        LabTestOrder,
        on_delete=models.CASCADE,
        related_name='result'
    )

    technician = models.ForeignKey(
        LabTechnicianProfile,
        on_delete=models.PROTECT,
        related_name='lab_results'
    )

    result_value = models.TextField()

    result_status = models.CharField(
        max_length=50,
        blank=True
    )

    remarks = models.TextField(
        blank=True
    )

    result_date = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"Result - {self.order.order_number}"


# ---------------------------------------------------------------------------
# 7. PHARMACY - DISPENSE
# ---------------------------------------------------------------------------

class Dispense(models.Model):

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('DISPENSED', 'Dispensed'),
        ('CANCELLED', 'Cancelled'),
    ]

    dispense_number = models.CharField(
        max_length=30,
        unique=True
    )

    prescription = models.ForeignKey(
        Prescription,
        on_delete=models.PROTECT,
        related_name='dispenses'
    )

    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        related_name='dispenses'
    )

    pharmacist = models.ForeignKey(
        PharmacistProfile,
        on_delete=models.PROTECT,
        related_name='dispenses'
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )

    dispense_date = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.dispense_number


class DispenseItem(models.Model):

    dispense = models.ForeignKey(
        Dispense,
        on_delete=models.CASCADE,
        related_name='items'
    )

    medicine = models.ForeignKey(
        MasterMedicine,
        on_delete=models.PROTECT,
        related_name='dispense_items'
    )

    quantity = models.PositiveIntegerField()

    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    total_price = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    def __str__(self):
        return f"{self.medicine} - {self.quantity}"


# ---------------------------------------------------------------------------
# 8. STOCK / PRICE MASTER
# ---------------------------------------------------------------------------

class StockMaster(models.Model):

    medicine = models.ForeignKey(
        MasterMedicine,
        on_delete=models.PROTECT,
        related_name='stock'
    )

    batch_number = models.CharField(
        max_length=50
    )

    expiry_date = models.DateField()

    quantity = models.PositiveIntegerField(
        default=0
    )

    purchase_price = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    selling_price = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.medicine} - {self.batch_number}"


class StockTransaction(models.Model):

    TRANSACTION_CHOICES = [
        ('PURCHASE', 'Purchase'),
        ('SALE', 'Sale'),
        ('RETURN', 'Return'),
        ('ADJUSTMENT', 'Adjustment'),
        ('EXPIRED', 'Expired'),
    ]

    stock = models.ForeignKey(
        StockMaster,
        on_delete=models.PROTECT,
        related_name='transactions'
    )

    transaction_type = models.CharField(
        max_length=20,
        choices=TRANSACTION_CHOICES
    )

    quantity = models.IntegerField()

    reference_number = models.CharField(
        max_length=50,
        blank=True
    )

    transaction_date = models.DateTimeField(
        auto_now_add=True
    )

    notes = models.TextField(
        blank=True
    )

    def __str__(self):
        return f"{self.stock} - {self.transaction_type}"


class PriceList(models.Model):

    medicine = models.ForeignKey(
        MasterMedicine,
        on_delete=models.PROTECT,
        related_name='prices'
    )

    purchase_price = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    selling_price = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    effective_from = models.DateField()

    effective_to = models.DateField(
        null=True,
        blank=True
    )

    is_active = models.BooleanField(
        default=True
    )

    def __str__(self):
        return f"{self.medicine} - {self.selling_price}"


# ---------------------------------------------------------------------------
# 9. LAB & PHARMACY BILLING
# ---------------------------------------------------------------------------

class LabInvoice(models.Model):

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PARTIAL', 'Partially Paid'),
        ('PAID', 'Paid'),
        ('CANCELLED', 'Cancelled'),
    ]

    invoice_number = models.CharField(
        max_length=30,
        unique=True
    )

    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        related_name='lab_invoices'
    )

    lab_order = models.ForeignKey(
        LabTestOrder,
        on_delete=models.PROTECT,
        related_name='invoices'
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    discount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )

    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.invoice_number


class LabPayment(models.Model):

    PAYMENT_METHOD_CHOICES = [
        ('CASH', 'Cash'),
        ('CARD', 'Card'),
        ('UPI', 'UPI'),
        ('ONLINE', 'Online'),
    ]

    invoice = models.ForeignKey(
        LabInvoice,
        on_delete=models.PROTECT,
        related_name='payments'
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES
    )

    transaction_id = models.CharField(
        max_length=100,
        blank=True
    )

    payment_date = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.invoice.invoice_number} - {self.amount}"


class PharmacyInvoice(models.Model):

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PARTIAL', 'Partially Paid'),
        ('PAID', 'Paid'),
        ('CANCELLED', 'Cancelled'),
    ]

    invoice_number = models.CharField(
        max_length=30,
        unique=True
    )

    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        related_name='pharmacy_invoices'
    )

    dispense = models.OneToOneField(
        Dispense,
        on_delete=models.PROTECT,
        related_name='invoice'
    )

    subtotal = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    discount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )

    tax = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )

    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.invoice_number


class PharmacyPayment(models.Model):

    PAYMENT_METHOD_CHOICES = [
        ('CASH', 'Cash'),
        ('CARD', 'Card'),
        ('UPI', 'UPI'),
        ('ONLINE', 'Online'),
    ]

    invoice = models.ForeignKey(
        PharmacyInvoice,
        on_delete=models.PROTECT,
        related_name='payments'
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES
    )

    transaction_id = models.CharField(
        max_length=100,
        blank=True
    )

    payment_date = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.invoice.invoice_number} - {self.amount}"