from django.db import models

# ---------------------------------------------------------------------------
# The Admin role does not own any tables of its own. It manages the shared
# data that already lives in `apibackendapp.models` (User, DoctorProfile,
# ReceptionistProfile, LabTechnicianProfile, PharmacistProfile, Patient,
# Appointment, master data, invoices, etc.) — the same pattern already used
# by the `doctor` and `receptionist` apps in this project.
#
# See adminapp/views.py and adminapp/serializers.py, which import those
# models/serializers directly.
# ---------------------------------------------------------------------------