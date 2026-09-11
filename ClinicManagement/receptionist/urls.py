from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'profile', views.ReceptionistProfileView, basename='receptionist-profile')
router.register(r'patients', views.ReceptionistPatientViewSet, basename='receptionist-patients')
router.register(r'medical-history', views.ReceptionistMedicalHistoryViewSet, basename='receptionist-medical-history')
router.register(r'doctors', views.ReceptionistDoctorViewSet, basename='receptionist-doctors')
router.register(r'appointments', views.ReceptionistAppointmentViewSet, basename='receptionist-appointments')
router.register(r'tokens', views.ReceptionistTokenViewSet, basename='receptionist-tokens')
router.register(r'consultation-invoices', views.ReceptionistConsultationInvoiceViewSet, basename='receptionist-consultation-invoices')
router.register(r'consultation-payments', views.ReceptionistConsultationPaymentViewSet, basename='receptionist-consultation-payments')

urlpatterns = [
    path('', include(router.urls)),
]
