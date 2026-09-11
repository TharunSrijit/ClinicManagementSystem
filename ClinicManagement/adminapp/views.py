from datetime import date as date_cls

from django.db.models import Q, Sum
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apibackendapp.models import (
    User,
    ReceptionistProfile,
    DoctorProfile,
    LabTechnicianProfile,
    PharmacistProfile,
    Patient,
    Appointment,
    MasterDosage,
    MasterMedicine,
    MasterLabTest,
    PriceList,
    StockMaster,
    StockTransaction,
    ConsultationInvoice,
    LabInvoice,
    PharmacyInvoice,
)

from apibackendapp.serializers import (
    UserSerializer,
    ReceptionistProfileSerializer,
    DoctorProfileSerializer,
    LabTechnicianProfileSerializer,
    PharmacistProfileSerializer,
    PatientSerializer,
    AppointmentSerializer,
    MasterDosageSerializer,
    MasterMedicineSerializer,
    MasterLabTestSerializer,
    PriceListSerializer,
    StockMasterSerializer,
    StockTransactionSerializer,
    ConsultationInvoiceSerializer,
    LabInvoiceSerializer,
    PharmacyInvoiceSerializer,
)

from .permissions import IsAdminRole
from .serializers import AdminStaffCreateSerializer, DashboardStatsSerializer


LOW_STOCK_THRESHOLD = 10


# ============================================================================
# USERS & STAFF ONBOARDING
# ============================================================================

class AdminUserViewSet(viewsets.ModelViewSet):
    """
    Full control over every account in the system.
    Filter with ?role=DOCTOR|RECEPTIONIST|LAB_TECHNICIAN|PHARMACIST|ADMIN
    and/or ?search=<username/name/email>.
    """
    serializer_class = UserSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        queryset = User.objects.all().order_by('-date_joined')

        role = self.request.query_params.get('role')
        search = self.request.query_params.get('search')

        if role:
            queryset = queryset.filter(role=role)

        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search)
            )

        return queryset

    @action(detail=False, methods=['post'])
    def create_staff(self, request):
        """
        POST /users/create_staff/ — create a User plus their role profile
        (Doctor/Receptionist/LabTechnician/Pharmacist) in one call.

        Body example:
        {
            "role": "DOCTOR",
            "username": "drjane",
            "password": "...",
            "email": "jane@clinic.com",
            "first_name": "Jane",
            "last_name": "Doe",
            "profile": {
                "doctor_id": "DOC0001",
                "specialization": "Cardiology",
                "qualification": "MBBS, MD",
                "registration_number": "REG12345",
                "consultation_fee": 500
            }
        }
        """
        serializer = AdminStaffCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(result, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """POST /users/{id}/activate/"""
        user = self.get_object()
        user.is_active = True
        user.save(update_fields=['is_active'])
        return Response(self.get_serializer(user).data)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """POST /users/{id}/deactivate/ — disable a staff login without deleting it."""
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=['is_active'])
        return Response(self.get_serializer(user).data)


# ============================================================================
# STAFF PROFILES (admin manages ALL of them, not just their own)
# ============================================================================

class AdminReceptionistProfileViewSet(viewsets.ModelViewSet):
    serializer_class = ReceptionistProfileSerializer
    permission_classes = [IsAdminRole]
    queryset = ReceptionistProfile.objects.all().select_related('user')


class AdminDoctorProfileViewSet(viewsets.ModelViewSet):
    serializer_class = DoctorProfileSerializer
    permission_classes = [IsAdminRole]
    queryset = DoctorProfile.objects.all().select_related('user')

    def get_queryset(self):
        queryset = super().get_queryset()
        specialization = self.request.query_params.get('specialization')
        if specialization:
            queryset = queryset.filter(specialization__icontains=specialization)
        return queryset


class AdminLabTechnicianProfileViewSet(viewsets.ModelViewSet):
    serializer_class = LabTechnicianProfileSerializer
    permission_classes = [IsAdminRole]
    queryset = LabTechnicianProfile.objects.all().select_related('user')


class AdminPharmacistProfileViewSet(viewsets.ModelViewSet):
    serializer_class = PharmacistProfileSerializer
    permission_classes = [IsAdminRole]
    queryset = PharmacistProfile.objects.all().select_related('user')


# ============================================================================
# PATIENTS & APPOINTMENTS (clinic-wide oversight)
# ============================================================================

class AdminPatientViewSet(viewsets.ModelViewSet):
    serializer_class = PatientSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        queryset = Patient.objects.all().order_by('-created_at')
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(phone__icontains=search) |
                Q(patient_id__icontains=search)
            )
        return queryset


class AdminAppointmentViewSet(viewsets.ModelViewSet):
    """
    Filter with ?doctor=<id>, ?patient=<id>, ?status=, ?date=YYYY-MM-DD.
    """
    serializer_class = AppointmentSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        queryset = Appointment.objects.all().select_related(
            'patient', 'doctor', 'doctor__user', 'receptionist'
        )

        doctor = self.request.query_params.get('doctor')
        patient = self.request.query_params.get('patient')
        status_param = self.request.query_params.get('status')
        appt_date = self.request.query_params.get('date')

        if doctor:
            queryset = queryset.filter(doctor_id=doctor)
        if patient:
            queryset = queryset.filter(patient_id=patient)
        if status_param:
            queryset = queryset.filter(status=status_param)
        if appt_date:
            queryset = queryset.filter(appointment_date=appt_date)

        return queryset.order_by('-appointment_date', '-appointment_time')


# ============================================================================
# MASTER DATA (medicines, dosages, lab tests, pricing)
# ============================================================================

class AdminMasterDosageViewSet(viewsets.ModelViewSet):
    serializer_class = MasterDosageSerializer
    permission_classes = [IsAdminRole]
    queryset = MasterDosage.objects.all()


class AdminMasterMedicineViewSet(viewsets.ModelViewSet):
    serializer_class = MasterMedicineSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        queryset = MasterMedicine.objects.all()
        name = self.request.query_params.get('name')
        active = self.request.query_params.get('active')
        if name:
            queryset = queryset.filter(medicine_name__icontains=name)
        if active is not None:
            queryset = queryset.filter(is_active=active.lower() == 'true')
        return queryset


class AdminMasterLabTestViewSet(viewsets.ModelViewSet):
    serializer_class = MasterLabTestSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        queryset = MasterLabTest.objects.all()
        name = self.request.query_params.get('name')
        active = self.request.query_params.get('active')
        if name:
            queryset = queryset.filter(test_name__icontains=name)
        if active is not None:
            queryset = queryset.filter(is_active=active.lower() == 'true')
        return queryset


class AdminPriceListViewSet(viewsets.ModelViewSet):
    serializer_class = PriceListSerializer
    permission_classes = [IsAdminRole]
    queryset = PriceList.objects.all().select_related('medicine')


# ============================================================================
# STOCK / INVENTORY OVERSIGHT
# ============================================================================

class AdminStockMasterViewSet(viewsets.ModelViewSet):
    serializer_class = StockMasterSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        queryset = StockMaster.objects.all().select_related('medicine')
        medicine = self.request.query_params.get('medicine')
        if medicine:
            queryset = queryset.filter(medicine_id=medicine)
        return queryset

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """GET /stock/low_stock/?threshold=10 — batches running low."""
        threshold = int(request.query_params.get('threshold', LOW_STOCK_THRESHOLD))
        queryset = self.get_queryset().filter(quantity__lte=threshold).order_by('quantity')
        return Response(self.get_serializer(queryset, many=True).data)


class AdminStockTransactionViewSet(viewsets.ModelViewSet):
    serializer_class = StockTransactionSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        queryset = StockTransaction.objects.all().select_related('stock')
        stock = self.request.query_params.get('stock')
        transaction_type = self.request.query_params.get('type')
        if stock:
            queryset = queryset.filter(stock_id=stock)
        if transaction_type:
            queryset = queryset.filter(transaction_type=transaction_type)
        return queryset.order_by('-transaction_date')


# ============================================================================
# BILLING OVERSIGHT (consultation / lab / pharmacy)
# ============================================================================

class AdminConsultationInvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = ConsultationInvoiceSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        queryset = ConsultationInvoice.objects.all().select_related('patient', 'appointment')
        status_param = self.request.query_params.get('status')
        patient = self.request.query_params.get('patient')
        if status_param:
            queryset = queryset.filter(status=status_param)
        if patient:
            queryset = queryset.filter(patient_id=patient)
        return queryset.order_by('-created_at')


class AdminLabInvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = LabInvoiceSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        queryset = LabInvoice.objects.all().select_related('patient', 'lab_order')
        status_param = self.request.query_params.get('status')
        patient = self.request.query_params.get('patient')
        if status_param:
            queryset = queryset.filter(status=status_param)
        if patient:
            queryset = queryset.filter(patient_id=patient)
        return queryset.order_by('-created_at')


class AdminPharmacyInvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = PharmacyInvoiceSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        queryset = PharmacyInvoice.objects.all().select_related('patient', 'dispense')
        status_param = self.request.query_params.get('status')
        patient = self.request.query_params.get('patient')
        if status_param:
            queryset = queryset.filter(status=status_param)
        if patient:
            queryset = queryset.filter(patient_id=patient)
        return queryset.order_by('-created_at')


# ============================================================================
# DASHBOARD
# ============================================================================

class AdminDashboardView(APIView):
    """GET /dashboard/ — headline stats for the admin landing page."""
    permission_classes = [IsAdminRole]

    def get(self, request):
        today = date_cls.today()
        month_start = today.replace(day=1)

        def paid_total(model):
            return model.objects.filter(
                status='PAID', created_at__date__gte=month_start
            ).aggregate(total=Sum('total_amount'))['total'] or 0

        data = {
            'total_patients': Patient.objects.count(),
            'total_doctors': DoctorProfile.objects.count(),
            'total_receptionists': ReceptionistProfile.objects.count(),
            'total_lab_technicians': LabTechnicianProfile.objects.count(),
            'total_pharmacists': PharmacistProfile.objects.count(),

            'appointments_today': Appointment.objects.filter(appointment_date=today).count(),
            'appointments_pending': Appointment.objects.filter(
                status__in=['BOOKED', 'CONFIRMED']
            ).count(),

            'pending_consultation_invoices': ConsultationInvoice.objects.filter(
                status__in=['PENDING', 'PARTIAL']
            ).count(),
            'pending_lab_invoices': LabInvoice.objects.filter(
                status__in=['PENDING', 'PARTIAL']
            ).count(),
            'pending_pharmacy_invoices': PharmacyInvoice.objects.filter(
                status__in=['PENDING', 'PARTIAL']
            ).count(),

            'revenue_this_month': {
                'consultation': paid_total(ConsultationInvoice),
                'lab': paid_total(LabInvoice),
                'pharmacy': paid_total(PharmacyInvoice),
            },

            'low_stock_items': StockMaster.objects.filter(
                quantity__lte=LOW_STOCK_THRESHOLD
            ).count(),
        }

        serializer = DashboardStatsSerializer(data)
        return Response(serializer.data)