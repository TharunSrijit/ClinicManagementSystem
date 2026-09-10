from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser


# ---------------------------------------------------------------------------
# ADMIN
# ---------------------------------------------------------------------------

class User(AbstractUser):
    pass


# ---------------------------------------------------------------------------
# RECEPTIONIST
# ---------------------------------------------------------------------------

class ReceptionistProfile(models.Model):
    pass


class Patient(models.Model):
    pass


class MedicalHistory(models.Model):
    pass


class Appointment(models.Model):
    pass


class Token(models.Model):
    pass


class ConsultationInvoice(models.Model):
    pass


class ConsultationPayment(models.Model):
    pass


class LabInvoice(models.Model):
    pass


class LabPayment(models.Model):
    pass


class PharmacyInvoice(models.Model):
    pass


class PharmacyPayment(models.Model):
    pass


# ---------------------------------------------------------------------------
# DOCTOR
# ---------------------------------------------------------------------------

class DoctorProfile(models.Model):
    pass


class Consultation(models.Model):
    pass


class Prescription(models.Model):
    pass


class PrescriptionItem(models.Model):
    pass


# ---------------------------------------------------------------------------
# PHARMACY
# ---------------------------------------------------------------------------

class PharmacistProfile(models.Model):
    pass


class MasterDosage(models.Model):
    pass


class MasterMedicine(models.Model):
    pass


class Dispense(models.Model):
    pass


class DispenseItem(models.Model):
    pass


class StockMaster(models.Model):
    pass


class StockTransaction(models.Model):
    pass


class PriceList(models.Model):
    pass


# ---------------------------------------------------------------------------
# LAB TECH
# ---------------------------------------------------------------------------

class LabTechnicianProfile(models.Model):
    pass


class MasterLabTest(models.Model):
    pass


class LabTestOrder(models.Model):
    pass


class LabTestResult(models.Model):
    pass