from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    PharmacistProfileView,
    PharmacyPrescriptionViewSet,
    PharmacyDispenseViewSet,
    PharmacyDispenseItemViewSet,
    PharmacyInvoiceViewSet,
    PharmacyPaymentViewSet,
    PharmacyStockViewSet,
    PharmacyMasterMedicineViewSet,
    PharmacyPatientViewSet,
)

router = DefaultRouter()

# Profile
router.register(r'profile',         PharmacistProfileView,         basename='pharmacy-profile')

# Prescription queue (read-only)
router.register(r'prescriptions',   PharmacyPrescriptionViewSet,   basename='pharmacy-prescriptions')

# Dispense workflow
router.register(r'dispenses',       PharmacyDispenseViewSet,       basename='pharmacy-dispenses')
router.register(r'dispense-items',  PharmacyDispenseItemViewSet,   basename='pharmacy-dispense-items')

# Billing
router.register(r'invoices',        PharmacyInvoiceViewSet,        basename='pharmacy-invoices')
router.register(r'payments',        PharmacyPaymentViewSet,        basename='pharmacy-payments')

# Reference / lookup (read-only)
router.register(r'stock',           PharmacyStockViewSet,          basename='pharmacy-stock')
router.register(r'medicines',       PharmacyMasterMedicineViewSet, basename='pharmacy-medicines')
router.register(r'patients',        PharmacyPatientViewSet,        basename='pharmacy-patients')

urlpatterns = [
    path('', include(router.urls)),
]
