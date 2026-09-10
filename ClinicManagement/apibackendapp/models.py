from django.db import models

# Create your models here.

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
 
 
# ---------------------------------------------------------------------------
# 1. USER & ROLE PROFILES
# ---------------------------------------------------------------------------
 
class User(AbstractUser):
    """
    Custom user model. `role` drives which profile (if any) is attached,
    and is used for DRF permission classes (IsDoctor, IsReceptionist, etc.)
    """
 
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        DOCTOR = "DOCTOR", "Doctor"
        RECEPTIONIST = "RECEPTIONIST", "Receptionist"
        PHARMACIST = "PHARMACIST", "Pharmacist"
        LAB_TECHNICIAN = "LAB_TECHNICIAN", "Lab Technician"
 
    role = models.CharField(max_length=20, choices=Role.choices)
    phone = models.CharField(max_length=15, blank=True)
    is_active = models.BooleanField(default=True)
    email = models.EmailField(unique=True)
 
    def __str__(self):
        return f"{self.username} ({self.role})"
 
 
class ReceptionistProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="receptionist_profile"
    )
    shift = models.CharField(max_length=20, blank=True)
    desk_no = models.CharField(max_length=10, blank=True)
 
    def __str__(self):
        return f"Receptionist: {self.user.username}"
 
 
class DoctorProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="doctor_profile"
    )
    specialization = models.CharField(max_length=100, blank=True)
    department = models.CharField(max_length=100, blank=True)
    consultation_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
 
    def __str__(self):
        return f"Dr. {self.user.get_full_name() or self.user.username}"
 
 
class LabTechnicianProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="lab_technician_profile"
    )
    lab_department = models.CharField(max_length=100, blank=True)
    certification = models.CharField(max_length=100, blank=True)
 
    def __str__(self):
        return f"LabTech: {self.user.username}"
 
 
class PharmacistProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="pharmacist_profile"
    )
 
    def __str__(self):
        return f"Pharmacist: {self.user.username}"
 
 
# ---------------------------------------------------------------------------
# 2. PATIENT
# ---------------------------------------------------------------------------
 
class Patient(models.Model):
    class Gender(models.TextChoices):
        MALE = "M", "Male"
        FEMALE = "F", "Female"
        OTHER = "O", "Other"
 
    name = models.CharField(max_length=150)
    dob = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=1, choices=Gender.choices, blank=True)
    phone = models.CharField(max_length=15, blank=True)
    address = models.TextField(blank=True)
    blood_group = models.CharField(max_length=5, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
 
    def __str__(self):
        return self.name
 
 
class MedicalHistory(models.Model):
    patient = models.OneToOneField(
        Patient, on_delete=models.CASCADE, related_name="medical_history"
    )
    condition = models.TextField(blank=True)
    allergies = models.TextField(blank=True)
    past_surgeries = models.TextField(blank=True)
    notes = models.TextField(blank=True)
 
    def __str__(self):
        return f"History: {self.patient.name}"
 
 
# ---------------------------------------------------------------------------
# 3. APPOINTMENTS
# ---------------------------------------------------------------------------
 
class Appointment(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "SCHEDULED", "Scheduled"
        CHECKED_IN = "CHECKED_IN", "Checked In"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"
        NO_SHOW = "NO_SHOW", "No Show"
 
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="appointments"
    )
    doctor = models.ForeignKey(
        DoctorProfile, on_delete=models.CASCADE, related_name="appointments"
    )
    booked_by = models.ForeignKey(
        ReceptionistProfile, on_delete=models.SET_NULL, null=True,
        related_name="booked_appointments"
    )
    date = models.DateField()
    time_slot = models.TimeField()
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.SCHEDULED
    )
    reason = models.CharField(max_length=255, blank=True)
 
    class Meta:
        ordering = ["-date", "-time_slot"]
 
    def __str__(self):
        return f"{self.patient.name} -> Dr.{self.doctor} on {self.date} {self.time_slot}"
 
 
# ---------------------------------------------------------------------------
# 4. CONSULTATION BILLING (Invoice -> Payment -> Token -> Consultation)
# ---------------------------------------------------------------------------
 
class PaymentStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    PARTIAL = "PARTIAL", "Partial"
    PAID = "PAID", "Paid"
    CANCELLED = "CANCELLED", "Cancelled"
 
 
class PaymentMode(models.TextChoices):
    CASH = "CASH", "Cash"
    CARD = "CARD", "Card"
    UPI = "UPI", "UPI"
    INSURANCE = "INSURANCE", "Insurance"
    OTHER = "OTHER", "Other"
 
 
class ConsultationInvoice(models.Model):
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="consultation_invoices"
    )
    appointment = models.OneToOneField(
        Appointment, on_delete=models.CASCADE, related_name="consultation_invoice"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_status = models.CharField(
        max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
 
    def __str__(self):
        return f"ConsultationInvoice #{self.id} - {self.patient.name}"
 
 
class ConsultationPayment(models.Model):
    invoice = models.ForeignKey(
        ConsultationInvoice, on_delete=models.CASCADE, related_name="payments"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    mode = models.CharField(max_length=20, choices=PaymentMode.choices)
    paid_at = models.DateTimeField(auto_now_add=True)
 
    def __str__(self):
        return f"Payment #{self.id} for Invoice #{self.invoice_id}"
 
 
class Token(models.Model):
    class Status(models.TextChoices):
        WAITING = "WAITING", "Waiting"
        IN_CONSULTATION = "IN_CONSULTATION", "In Consultation"
        DONE = "DONE", "Done"
        CANCELLED = "CANCELLED", "Cancelled"
 
    invoice = models.OneToOneField(
        ConsultationInvoice, on_delete=models.CASCADE, related_name="token"
    )
    issued_by = models.ForeignKey(
        ReceptionistProfile, on_delete=models.SET_NULL, null=True,
        related_name="issued_tokens"
    )
    token_no = models.CharField(max_length=20)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.WAITING
    )
    issued_at = models.DateTimeField(auto_now_add=True)
 
    def __str__(self):
        return f"Token {self.token_no}"
 
 
class Consultation(models.Model):
    token = models.OneToOneField(
        Token, on_delete=models.CASCADE, related_name="consultation"
    )
    diagnosis = models.TextField(blank=True)
    symptoms = models.TextField(blank=True)
    blood_pressure = models.CharField(max_length=20, blank=True)
    temperature = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    weight = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
 
    def __str__(self):
        return f"Consultation #{self.id} (Token {self.token.token_no})"
 
 
# ---------------------------------------------------------------------------
# 5. PRESCRIPTION
# ---------------------------------------------------------------------------
 
class MasterDosage(models.Model):
    dosage_text = models.CharField(max_length=100)
    frequency = models.CharField(max_length=100)
    duration = models.CharField(max_length=100)
 
    def __str__(self):
        return f"{self.dosage_text} - {self.frequency} - {self.duration}"
 
 
class MasterMedicine(models.Model):
    name = models.CharField(max_length=150)
    generic_name = models.CharField(max_length=150, blank=True)
    manufacturer = models.CharField(max_length=150, blank=True)
    category = models.CharField(max_length=100, blank=True)
 
    def __str__(self):
        return self.name
 
 
class Prescription(models.Model):
    consultation = models.ForeignKey(
        Consultation, on_delete=models.CASCADE, related_name="prescriptions"
    )
    doctor = models.ForeignKey(
        DoctorProfile, on_delete=models.CASCADE, related_name="prescriptions"
    )
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="prescriptions"
    )
    date = models.DateField(auto_now_add=True)
 
    def __str__(self):
        return f"Prescription #{self.id} - {self.patient.name}"
 
 
class PrescriptionItem(models.Model):
    prescription = models.ForeignKey(
        Prescription, on_delete=models.CASCADE, related_name="items"
    )
    medicine = models.ForeignKey(
        MasterMedicine, on_delete=models.PROTECT, related_name="prescription_items"
    )
    dosage = models.ForeignKey(
        MasterDosage, on_delete=models.PROTECT, related_name="prescription_items"
    )
    instructions = models.CharField(max_length=255, blank=True)
 
    def __str__(self):
        return f"{self.medicine.name} for Rx#{self.prescription_id}"
 
 
# ---------------------------------------------------------------------------
# 6. LAB MODULE
# ---------------------------------------------------------------------------
 
class MasterLabTest(models.Model):
    test_name = models.CharField(max_length=150)
    sample_type = models.CharField(max_length=100, blank=True)
    normal_range = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
 
    def __str__(self):
        return self.test_name
 
 
class LabTestOrder(models.Model):
    class Status(models.TextChoices):
        ORDERED = "ORDERED", "Ordered"
        SAMPLE_COLLECTED = "SAMPLE_COLLECTED", "Sample Collected"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"
 
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="lab_test_orders"
    )
    doctor = models.ForeignKey(
        DoctorProfile, on_delete=models.CASCADE, related_name="lab_test_orders"
    )
    test = models.ForeignKey(
        MasterLabTest, on_delete=models.PROTECT, related_name="orders"
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ORDERED
    )
    ordered_at = models.DateTimeField(auto_now_add=True)
 
    def __str__(self):
        return f"LabOrder #{self.id} - {self.test.test_name} - {self.patient.name}"
 
 
class LabTestResult(models.Model):
    order = models.OneToOneField(
        LabTestOrder, on_delete=models.CASCADE, related_name="result"
    )
    technician = models.ForeignKey(
        LabTechnicianProfile, on_delete=models.SET_NULL, null=True,
        related_name="lab_results"
    )
    result_value = models.CharField(max_length=255, blank=True)
    result_file = models.FileField(
        upload_to="lab_results/", blank=True, null=True
    )
    remarks = models.TextField(blank=True)
    reported_at = models.DateTimeField(auto_now_add=True)
 
    def __str__(self):
        return f"Result for Order #{self.order_id}"
 
 
# ---------------------------------------------------------------------------
# 7. PHARMACY - DISPENSE
# ---------------------------------------------------------------------------
 
class Dispense(models.Model):
    prescription = models.ForeignKey(
        Prescription, on_delete=models.CASCADE, related_name="dispenses"
    )
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="dispenses"
    )
    pharmacist = models.ForeignKey(
        PharmacistProfile, on_delete=models.SET_NULL, null=True,
        related_name="dispenses"
    )
    dispensed_at = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
 
    def __str__(self):
        return f"Dispense #{self.id} - {self.patient.name}"
 
 
class DispenseItem(models.Model):
    dispense = models.ForeignKey(
        Dispense, on_delete=models.CASCADE, related_name="items"
    )
    medicine = models.ForeignKey(
        MasterMedicine, on_delete=models.PROTECT, related_name="dispense_items"
    )
    quantity = models.PositiveIntegerField()
    price_at_time = models.DecimalField(max_digits=8, decimal_places=2)
 
    def __str__(self):
        return f"{self.medicine.name} x{self.quantity} (Dispense #{self.dispense_id})"
 
 
# ---------------------------------------------------------------------------
# 8. STOCK / PRICE MASTER
# ---------------------------------------------------------------------------
 
class StockMaster(models.Model):
    medicine = models.ForeignKey(
        MasterMedicine, on_delete=models.CASCADE, related_name="stock_batches"
    )
    batch_no = models.CharField(max_length=50)
    stock_qty = models.IntegerField(default=0)
    expiry_date = models.DateField()
 
    def __str__(self):
        return f"{self.medicine.name} - Batch {self.batch_no}"
 
 
class StockTransaction(models.Model):
    class TransactionType(models.TextChoices):
        STOCK_IN = "STOCK_IN", "Stock In"
        STOCK_OUT = "STOCK_OUT", "Stock Out"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment"
        RETURN = "RETURN", "Return"
        EXPIRED = "EXPIRED", "Expired"
 
    stock = models.ForeignKey(
        StockMaster, on_delete=models.CASCADE, related_name="transactions"
    )
    quantity_change = models.IntegerField()
    transaction_type = models.CharField(
        max_length=20, choices=TransactionType.choices
    )
    handled_by = models.ForeignKey(
        PharmacistProfile, on_delete=models.SET_NULL, null=True,
        related_name="stock_transactions"
    )
    date = models.DateTimeField(auto_now_add=True)
 
    def __str__(self):
        return f"{self.transaction_type} {self.quantity_change} - {self.stock}"
 
 
class PriceList(models.Model):
    """
    Priced item can be a medicine OR a lab test (mutually exclusive).
    Enforce exactly-one-of via clean()/CheckConstraint at the app level.
    """
    medicine = models.ForeignKey(
        MasterMedicine, on_delete=models.CASCADE, related_name="price_entries",
        null=True, blank=True
    )
    lab_test = models.ForeignKey(
        MasterLabTest, on_delete=models.CASCADE, related_name="price_entries",
        null=True, blank=True
    )
    price = models.DecimalField(max_digits=10, decimal_places=2)
    effective_from = models.DateField()
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="price_updates"
    )
 
    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(medicine__isnull=False, lab_test__isnull=True) |
                    models.Q(medicine__isnull=True, lab_test__isnull=False)
                ),
                name="pricelist_exactly_one_of_medicine_or_labtest",
            )
        ]
 
    def __str__(self):
        target = self.medicine.name if self.medicine else self.lab_test.test_name
        return f"{target} @ {self.price}"
 
 
# ---------------------------------------------------------------------------
# 9. LAB & PHARMACY BILLING
# ---------------------------------------------------------------------------
 
class LabInvoice(models.Model):
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="lab_invoices"
    )
    lab_order = models.OneToOneField(
        LabTestOrder, on_delete=models.CASCADE, related_name="invoice"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_status = models.CharField(
        max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
 
    def __str__(self):
        return f"LabInvoice #{self.id} - {self.patient.name}"
 
 
class LabPayment(models.Model):
    invoice = models.ForeignKey(
        LabInvoice, on_delete=models.CASCADE, related_name="payments"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    mode = models.CharField(max_length=20, choices=PaymentMode.choices)
    paid_at = models.DateTimeField(auto_now_add=True)
 
    def __str__(self):
        return f"LabPayment #{self.id} for Invoice #{self.invoice_id}"
 
 
class PharmacyInvoice(models.Model):
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="pharmacy_invoices"
    )
    dispense = models.OneToOneField(
        Dispense, on_delete=models.CASCADE, related_name="invoice"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_status = models.CharField(
        max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
 
    def __str__(self):
        return f"PharmacyInvoice #{self.id} - {self.patient.name}"
 
 
class PharmacyPayment(models.Model):
    invoice = models.ForeignKey(
        PharmacyInvoice, on_delete=models.CASCADE, related_name="payments"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    mode = models.CharField(max_length=20, choices=PaymentMode.choices)
    paid_at = models.DateTimeField(auto_now_add=True)
 
    def __str__(self):
        return f"PharmacyPayment #{self.id} for Invoice #{self.invoice_id}"