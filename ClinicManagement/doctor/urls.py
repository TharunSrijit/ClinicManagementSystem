from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    DoctorProfileView,
    DoctorAppointmentViewSet,
    DoctorConsultationViewSet,
    DoctorPrescriptionViewSet,
    DoctorPrescriptionItemViewSet,
    DoctorLabTestOrderViewSet,
    DoctorLabTestResultViewSet,
    DoctorPatientViewSet,
    DoctorMedicalHistoryViewSet,
    DoctorMasterMedicineViewSet,
    DoctorMasterDosageViewSet,
    DoctorMasterLabTestViewSet,
)

router = DefaultRouter()

# Profile
router.register(r'profile',             DoctorProfileView,              basename='doctor-profile')

# Appointments
router.register(r'appointments',        DoctorAppointmentViewSet,       basename='doctor-appointments')

# Consultation
router.register(r'consultations',       DoctorConsultationViewSet,      basename='doctor-consultations')

# Prescription
router.register(r'prescriptions',       DoctorPrescriptionViewSet,      basename='doctor-prescriptions')
router.register(r'prescription-items',  DoctorPrescriptionItemViewSet,  basename='doctor-prescription-items')

# Lab
router.register(r'lab-orders',          DoctorLabTestOrderViewSet,      basename='doctor-lab-orders')
router.register(r'lab-results',         DoctorLabTestResultViewSet,     basename='doctor-lab-results')

# Patients (read-only)
router.register(r'patients',            DoctorPatientViewSet,           basename='doctor-patients')
router.register(r'medical-history',     DoctorMedicalHistoryViewSet,    basename='doctor-medical-history')

# Reference lists (read-only)
router.register(r'medicines',           DoctorMasterMedicineViewSet,    basename='doctor-medicines')
router.register(r'dosages',             DoctorMasterDosageViewSet,      basename='doctor-dosages')
router.register(r'lab-tests',           DoctorMasterLabTestViewSet,     basename='doctor-lab-tests')

urlpatterns = [
    path('', include(router.urls)),
]
