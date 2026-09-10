from django.db import models

# ---------------------------------------------------------------------------
# Doctor Module — Models
#
# All models for the Doctor module are defined in `apibackendapp/models.py`
# to keep a single source of truth for the database schema.
#
# Models used by this module:
#   - DoctorProfile      → Doctor's identity & profile details
#   - Appointment        → Doctor's scheduled appointments
#   - Consultation       → Clinical notes, diagnosis, treatment plan
#   - Prescription       → Prescriptions written by the doctor
#   - PrescriptionItem   → Individual medicine items in a prescription
#   - MasterMedicine     → Medicine reference list
#   - MasterDosage       → Dosage reference list
#   - LabTestOrder       → Lab tests ordered by the doctor
#   - MasterLabTest      → Available lab tests reference
#   - Patient            → Patient details
#   - MedicalHistory     → Patient medical history
#
# To use them in this app:
#   from apibackendapp.models import DoctorProfile, Appointment, Consultation
# ---------------------------------------------------------------------------
