from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'users', views.AdminUserViewSet, basename='admin-users')
router.register(r'receptionists', views.AdminReceptionistProfileViewSet, basename='admin-receptionists')
router.register(r'doctors', views.AdminDoctorProfileViewSet, basename='admin-doctors')
router.register(r'lab-technicians', views.AdminLabTechnicianProfileViewSet, basename='admin-lab-technicians')
router.register(r'pharmacists', views.AdminPharmacistProfileViewSet, basename='admin-pharmacists')
router.register(r'patients', views.AdminPatientViewSet, basename='admin-patients')
router.register(r'appointments', views.AdminAppointmentViewSet, basename='admin-appointments')
router.register(r'dosages', views.AdminMasterDosageViewSet, basename='admin-dosages')
router.register(r'medicines', views.AdminMasterMedicineViewSet, basename='admin-medicines')
router.register(r'lab-tests', views.AdminMasterLabTestViewSet, basename='admin-lab-tests')
router.register(r'price-list', views.AdminPriceListViewSet, basename='admin-price-list')
router.register(r'stock', views.AdminStockMasterViewSet, basename='admin-stock')
router.register(r'stock-transactions', views.AdminStockTransactionViewSet, basename='admin-stock-transactions')
router.register(r'consultation-invoices', views.AdminConsultationInvoiceViewSet, basename='admin-consultation-invoices')
router.register(r'lab-invoices', views.AdminLabInvoiceViewSet, basename='admin-lab-invoices')
router.register(r'pharmacy-invoices', views.AdminPharmacyInvoiceViewSet, basename='admin-pharmacy-invoices')

urlpatterns = [
    path('dashboard/', views.AdminDashboardView.as_view(), name='admin-dashboard'),
    path('', include(router.urls)),
]