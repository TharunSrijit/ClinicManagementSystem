from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    LabTechProfileView,
    LabTechLabTestOrderViewSet,
    LabTechLabTestResultViewSet,
    LabTechPatientViewSet,
    LabTechMasterLabTestViewSet,
    LabTechLabInvoiceViewSet,
    LabTechLabPaymentViewSet,
)

router = DefaultRouter()

# Profile
router.register(r'profile',       LabTechProfileView,            basename='lab-profile')

# Orders & results
router.register(r'lab-orders',    LabTechLabTestOrderViewSet,    basename='lab-orders')
router.register(r'lab-results',   LabTechLabTestResultViewSet,   basename='lab-results')

# Billing
router.register(r'invoices',      LabTechLabInvoiceViewSet,      basename='lab-invoices')
router.register(r'payments',      LabTechLabPaymentViewSet,      basename='lab-payments')

# Reference / lookup (read-only)
router.register(r'patients',      LabTechPatientViewSet,         basename='lab-patients')
router.register(r'tests',         LabTechMasterLabTestViewSet,   basename='lab-tests')

urlpatterns = [
    path('', include(router.urls)),
]
