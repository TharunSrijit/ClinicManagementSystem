from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apibackendapp.models import (
    DoctorProfile,
    Appointment,
    Consultation,
    Prescription,
    PrescriptionItem,
    MasterMedicine,
    MasterDosage,
    MasterLabTest,
    LabTestOrder,
    LabTestResult,
    Patient,
    MedicalHistory,
)

from .serializers import (
    DoctorProfileSerializer,
    AppointmentSerializer,
    ConsultationSerializer,
    PrescriptionSerializer,
    PrescriptionItemSerializer,
    MasterMedicineSerializer,
    MasterDosageSerializer,
    MasterLabTestSerializer,
    LabTestOrderSerializer,
    LabTestResultSerializer,
    PatientSerializer,
    MedicalHistorySerializer,
)



# ---------------------------------------------------------------------------
# Helper — get the DoctorProfile of the currently logged-in user
# ---------------------------------------------------------------------------

def get_doctor_profile(request):
    """Returns the DoctorProfile for the logged-in user, or None."""
    try:
        return request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return None


# ============================================================================
# DOCTOR PROFILE
# ============================================================================

class DoctorProfileView(viewsets.ModelViewSet):
    """
    Allows the logged-in doctor to view and update their own profile only.
    """
    serializer_class = DoctorProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DoctorProfile.objects.filter(user=self.request.user)


# ============================================================================
# APPOINTMENTS
# ============================================================================

class DoctorAppointmentViewSet(viewsets.ModelViewSet):
    """
    Doctor can view and manage only their own appointments.
    Supports filtering by ?status=BOOKED and ?date=YYYY-MM-DD.
    """
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            return Appointment.objects.none()

        queryset = Appointment.objects.filter(doctor=doctor).select_related(
            'patient', 'doctor', 'receptionist'
        )

        status = self.request.query_params.get('status')
        date   = self.request.query_params.get('date')

        if status:
            queryset = queryset.filter(status=status)

        if date:
            queryset = queryset.filter(appointment_date=date)

        return queryset


# ============================================================================
# CONSULTATION
# ============================================================================

class DoctorConsultationViewSet(viewsets.ModelViewSet):
    """
    Doctor can create and view consultations for their own patients.
    Supports filtering by ?patient=<id>.
    """
    serializer_class = ConsultationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            return Consultation.objects.none()

        queryset = Consultation.objects.filter(doctor=doctor).select_related(
            'patient', 'doctor', 'appointment'
        )

        patient = self.request.query_params.get('patient')
        if patient:
            queryset = queryset.filter(patient_id=patient)

        return queryset


# ============================================================================
# PRESCRIPTION
# ============================================================================

class DoctorPrescriptionViewSet(viewsets.ModelViewSet):
    """
    Doctor can create and view prescriptions they have written.
    Supports filtering by ?patient=<id>.
    """
    serializer_class = PrescriptionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            return Prescription.objects.none()

        queryset = Prescription.objects.filter(doctor=doctor).select_related(
            'patient', 'doctor', 'consultation'
        )

        patient = self.request.query_params.get('patient')
        if patient:
            queryset = queryset.filter(patient_id=patient)

        return queryset


class DoctorPrescriptionItemViewSet(viewsets.ModelViewSet):
    """
    Doctor can manage items (medicines) within their prescriptions.
    Supports filtering by ?prescription=<id>.
    """
    serializer_class = PrescriptionItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            return PrescriptionItem.objects.none()

        queryset = PrescriptionItem.objects.filter(
            prescription__doctor=doctor
        ).select_related('prescription', 'medicine', 'dosage')

        prescription = self.request.query_params.get('prescription')
        if prescription:
            queryset = queryset.filter(prescription_id=prescription)

        return queryset


# ============================================================================
# LAB TEST ORDERS
# ============================================================================

class DoctorLabTestOrderViewSet(viewsets.ModelViewSet):
    """
    Doctor can order and track lab tests for their patients.
    Supports filtering by ?patient=<id> and ?status=ORDERED.
    """
    serializer_class = LabTestOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            return LabTestOrder.objects.none()

        queryset = LabTestOrder.objects.filter(doctor=doctor).select_related(
            'patient', 'doctor', 'test', 'consultation'
        )

        patient = self.request.query_params.get('patient')
        status  = self.request.query_params.get('status')

        if patient:
            queryset = queryset.filter(patient_id=patient)

        if status:
            queryset = queryset.filter(status=status)

        return queryset


class DoctorLabTestResultViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Doctor can VIEW lab results for tests they ordered (read-only).
    Supports filtering by ?order=<id>.
    """
    serializer_class = LabTestResultSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            return LabTestResult.objects.none()

        queryset = LabTestResult.objects.filter(
            order__doctor=doctor
        ).select_related('order', 'technician')

        order = self.request.query_params.get('order')
        if order:
            queryset = queryset.filter(order_id=order)

        return queryset


# ============================================================================
# PATIENT & MEDICAL HISTORY (read-only for doctor)
# ============================================================================

class DoctorPatientViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Doctor can view patients they have had an appointment or consultation with.
    Supports filtering by ?name=<search>.
    """
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            return Patient.objects.none()

        # Patients who have at least one appointment with this doctor
        queryset = Patient.objects.filter(
            appointments__doctor=doctor
        ).distinct()

        name = self.request.query_params.get('name')
        if name:
            queryset = queryset.filter(first_name__icontains=name)

        return queryset


class DoctorMedicalHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Doctor can view medical histories of their patients (read-only).
    Supports filtering by ?patient=<id>.
    """
    serializer_class = MedicalHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        doctor = get_doctor_profile(self.request)
        if not doctor:
            return MedicalHistory.objects.none()

        queryset = MedicalHistory.objects.filter(
            patient__appointments__doctor=doctor
        ).distinct().select_related('patient')

        patient = self.request.query_params.get('patient')
        if patient:
            queryset = queryset.filter(patient_id=patient)

        return queryset


# ============================================================================
# REFERENCE / LOOKUP (read-only)
# ============================================================================

class DoctorMasterMedicineViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Doctor can browse the medicine list when writing prescriptions (read-only).
    Supports filtering by ?name=<search> and ?category=<search>.
    """
    serializer_class = MasterMedicineSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = MasterMedicine.objects.filter(is_active=True)

        name     = self.request.query_params.get('name')
        category = self.request.query_params.get('category')

        if name:
            queryset = queryset.filter(medicine_name__icontains=name)

        if category:
            queryset = queryset.filter(category__icontains=category)

        return queryset


class DoctorMasterDosageViewSet(viewsets.ReadOnlyModelViewSet):
    """Doctor can browse available dosage options (read-only)."""
    serializer_class = MasterDosageSerializer
    permission_classes = [IsAuthenticated]
    queryset = MasterDosage.objects.all()


class DoctorMasterLabTestViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Doctor can browse available lab tests when ordering (read-only).
    Supports filtering by ?name=<search>.
    """
    serializer_class = MasterLabTestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = MasterLabTest.objects.filter(is_active=True)

        name = self.request.query_params.get('name')
        if name:
            queryset = queryset.filter(test_name__icontains=name)

        return queryset

