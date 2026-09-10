from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser


# ---------------------------------------------------------------------------
# 1. USER & ROLE PROFILES
# ---------------------------------------------------------------------------

class User(AbstractUser):
    pass


class ReceptionistProfile(models.Model):
    pass


class DoctorProfile(models.Model):
    pass


class LabTechnicianProfile(models.Model):
    pass


class PharmacistProfile(models.Model):
    pass


# ---------------------------------------------------------------------------
# 2. PATIENT
# ---------------------------------------------------------------------------

class Patient(models.Model):
    pass


class MedicalHistory(models.Model):
    pass


# ---------------------------------------------------------------------------
# 3. APPOINTMENTS
# ---------------------------------------------------------------------------

class Appointment(models.Model):
    pass


# ---------------------------------------------------------------------------
# 4. CONSULTATION BILLING
# ---------------------------------------------------------------------------

class ConsultationInvoice(models.Model):
    pass


class ConsultationPayment(models.Model):
    pass


class Token(models.Model):
    pass


class Consultation(models.Model):
    pass


# ---------------------------------------------------------------------------
# 5. PRESCRIPTION
# ---------------------------------------------------------------------------

class MasterDosage(models.Model):
    pass


class MasterMedicine(models.Model):
    pass


class Prescription(models.Model):
    pass


class PrescriptionItem(models.Model):
    pass


# ---------------------------------------------------------------------------
# 6. LAB MODULE
# ---------------------------------------------------------------------------

class MasterLabTest(models.Model):
    pass


class LabTestOrder(models.Model):
    pass


class LabTestResult(models.Model):
    pass


# ---------------------------------------------------------------------------
# 7. PHARMACY - DISPENSE
# ---------------------------------------------------------------------------

class Dispense(models.Model):
    pass


class DispenseItem(models.Model):
    pass


# ---------------------------------------------------------------------------
# 8. STOCK / PRICE MASTER
# ---------------------------------------------------------------------------

class StockMaster(models.Model):
    pass


class StockTransaction(models.Model):
    pass


class PriceList(models.Model):
    pass


# ---------------------------------------------------------------------------
# 9. LAB & PHARMACY BILLING
# ---------------------------------------------------------------------------

class LabInvoice(models.Model):
    pass


class LabPayment(models.Model):
    pass


class PharmacyInvoice(models.Model):
    pass


class PharmacyPayment(models.Model):
    pass