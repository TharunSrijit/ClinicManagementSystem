from datetime import date as date_cls, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.db.models.deletion import ProtectedError
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
    PrescriptionItem,
    DispenseItem,
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
from .serializers import (
    AdminDoctorProfileSerializer,
    AdminStaffCreateSerializer,
    DashboardStatsSerializer,
)


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

    def perform_update(self, serializer):
        user = serializer.save()
        # Ensure role-specific profile exists if role was assigned/changed
        role = user.role
        if role == 'DOCTOR' and not hasattr(user, 'doctor_profile'):
            DoctorProfile.objects.create(
                user=user,
                doctor_id=f"DOC{user.id:04d}",
                specialization='General Medicine',
                qualification='MBBS',
                registration_number=f"REG{user.id:05d}",
                consultation_fee=500
            )
        elif role == 'RECEPTIONIST' and not hasattr(user, 'receptionist_profile'):
            ReceptionistProfile.objects.create(
                user=user,
                employee_id=f"REC{user.id:04d}",
                phone=user.phone or ''
            )
        elif role == 'LAB_TECHNICIAN' and not hasattr(user, 'labtechnician_profile'):
            LabTechnicianProfile.objects.create(
                user=user,
                employee_id=f"LAB{user.id:04d}",
                qualification='B.Sc MLT',
                phone=user.phone or ''
            )
        elif role == 'PHARMACIST' and not hasattr(user, 'pharmacist_profile'):
            PharmacistProfile.objects.create(
                user=user,
                employee_id=f"PHM{user.id:04d}",
                qualification='B.Pharm',
                phone=user.phone or ''
            )

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
        if request.user.id == user.id:
            return Response(
                {"detail": "You cannot deactivate your own administrator account."},
                status=status.HTTP_400_BAD_REQUEST
            )
        user.is_active = False
        user.save(update_fields=['is_active'])
        return Response(self.get_serializer(user).data)

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if request.user.id == user.id:
            return Response(
                {"detail": "You cannot delete your own administrator account."},
                status=status.HTTP_400_BAD_REQUEST
            )

        dependencies = []

        if hasattr(user, 'doctor_profile'):
            doc = user.doctor_profile
            appt_count = doc.appointments.count()
            cons_count = doc.consultations.count()
            rx_count = doc.prescriptions.count()
            lab_count = doc.lab_orders.count()
            if appt_count:
                dependencies.append(f"{appt_count} appointment(s)")
            if cons_count:
                dependencies.append(f"{cons_count} consultation(s)")
            if rx_count:
                dependencies.append(f"{rx_count} prescription(s)")
            if lab_count:
                dependencies.append(f"{lab_count} lab order(s)")

        if hasattr(user, 'receptionist_profile'):
            rec = user.receptionist_profile
            appt_count = getattr(rec, 'appointments_created', None) and rec.appointments_created.count()
            if appt_count:
                dependencies.append(f"{appt_count} registered appointment(s)")

        if hasattr(user, 'pharmacist_profile'):
            pharm = user.pharmacist_profile
            disp_count = pharm.dispenses.count()
            if disp_count:
                dependencies.append(f"{disp_count} dispensed prescription(s)")

        if hasattr(user, 'labtechnician_profile'):
            tech = user.labtechnician_profile
            res_count = tech.results.count()
            if res_count:
                dependencies.append(f"{res_count} laboratory test result(s)")

        if dependencies:
            dep_str = ", ".join(dependencies)
            return Response(
                {
                    "detail": (
                        f"Account '{user.username}' cannot be deleted because it is linked to historical {dep_str}. "
                        "Permanent deletion would corrupt clinical audit trails and billing history. "
                        "Please deactivate this account instead to preserve clinical records."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            if hasattr(user, 'doctor_profile'):
                user.doctor_profile.delete()
            if hasattr(user, 'receptionist_profile'):
                user.receptionist_profile.delete()
            if hasattr(user, 'pharmacist_profile'):
                user.pharmacist_profile.delete()
            if hasattr(user, 'labtechnician_profile'):
                user.labtechnician_profile.delete()
            user.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['patch', 'delete'], url_path='staff-profile')
    def staff_profile(self, request, pk=None):
        user = self.get_object()
        profile_config = {
            'RECEPTIONIST': (
                'receptionist_profile',
                ReceptionistProfileSerializer,
            ),
            'DOCTOR': (
                'doctor_profile',
                AdminDoctorProfileSerializer,
            ),
            'LAB_TECHNICIAN': (
                'lab_technician_profile',
                LabTechnicianProfileSerializer,
            ),
            'PHARMACIST': (
                'pharmacist_profile',
                PharmacistProfileSerializer,
            ),
        }
        if user.role not in profile_config:
            return Response(
                {'detail': 'This account does not have a staff profile.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        related_name, profile_serializer_class = profile_config[user.role]
        try:
            profile = getattr(user, related_name)
        except (
            ReceptionistProfile.DoesNotExist,
            DoctorProfile.DoesNotExist,
            LabTechnicianProfile.DoesNotExist,
            PharmacistProfile.DoesNotExist,
        ):
            return Response(
                {'detail': 'This user does not have a staff profile.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if request.method == 'DELETE':
            try:
                profile.delete()
            except ProtectedError:
                return Response(
                    {'detail': 'This staff profile is linked to existing records and cannot be deleted.'},
                    status=status.HTTP_409_CONFLICT,
                )
            return Response(status=status.HTTP_204_NO_CONTENT)

        user_serializer = UserSerializer(
            user,
            data=request.data.get('user', {}),
            partial=True,
        )
        profile_serializer = profile_serializer_class(
            profile,
            data=request.data.get('profile', {}),
            partial=True,
        )
        user_serializer.is_valid(raise_exception=True)
        profile_serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            user_serializer.save()
            profile_serializer.save()

        return Response({
            'user': user_serializer.data,
            'profile': profile_serializer.data,
        })


# ============================================================================
# STAFF PROFILES (admin manages ALL of them, not just their own)
# ============================================================================

class AdminReceptionistProfileViewSet(viewsets.ModelViewSet):
    serializer_class = ReceptionistProfileSerializer
    permission_classes = [IsAdminRole]
    queryset = ReceptionistProfile.objects.all().select_related('user')


class AdminDoctorProfileViewSet(viewsets.ModelViewSet):
    serializer_class = AdminDoctorProfileSerializer
    permission_classes = [IsAdminRole]
    queryset = DoctorProfile.objects.all().select_related('user')

    def get_queryset(self):
        queryset = super().get_queryset()
        specialization = self.request.query_params.get('specialization')
        if specialization:
            queryset = queryset.filter(specialization__icontains=specialization)
        return queryset

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except ProtectedError:
            return Response(
                {
                    'detail': (
                        'This doctor profile is linked to appointments or medical '
                        'records and cannot be deleted. Deactivate the account instead.'
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


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
        queryset = MasterMedicine.objects.all().prefetch_related('stock')
        name = self.request.query_params.get('name')
        active = self.request.query_params.get('active')
        if name:
            queryset = queryset.filter(
                Q(medicine_name__icontains=name) |
                Q(generic_name__icontains=name) |
                Q(category__icontains=name)
            )
        if active is not None:
            queryset = queryset.filter(is_active=active.lower() == 'true')
        return queryset

    def perform_create(self, serializer):
        medicine = serializer.save()
        self._sync_stock(medicine, self.request.data)

    def perform_update(self, serializer):
        medicine = serializer.save()
        self._sync_stock(medicine, self.request.data)

    def _sync_stock(self, medicine, data):
        batch_number = data.get('batch_number')
        quantity = data.get('quantity') if data.get('quantity') is not None else data.get('stock_quantity')
        expiry_date = data.get('expiry_date')
        selling_price = data.get('selling_price') if data.get('selling_price') is not None else data.get('price')
        purchase_price = data.get('purchase_price')

        if batch_number or quantity is not None or selling_price is not None or expiry_date:
            latest = medicine.stock.order_by('-created_at').first()
            if latest:
                if batch_number:
                    latest.batch_number = str(batch_number).strip()
                if quantity is not None:
                    latest.quantity = max(0, int(quantity))
                if expiry_date:
                    latest.expiry_date = expiry_date
                if selling_price is not None:
                    latest.selling_price = Decimal(str(selling_price))
                if purchase_price is not None:
                    latest.purchase_price = Decimal(str(purchase_price))
                latest.save()
            else:
                default_expiry = date_cls.today() + timedelta(days=365)
                StockMaster.objects.create(
                    medicine=medicine,
                    batch_number=str(batch_number).strip() if batch_number else f"BATCH-{medicine.id:04d}",
                    expiry_date=expiry_date or default_expiry,
                    quantity=max(0, int(quantity or 0)),
                    purchase_price=Decimal(str(purchase_price or 0.00)),
                    selling_price=Decimal(str(selling_price or 10.00)),
                )

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """POST /admin/medicines/{id}/activate/"""
        medicine = self.get_object()
        medicine.is_active = True
        medicine.save(update_fields=['is_active'])
        return Response(self.get_serializer(medicine).data)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """POST /admin/medicines/{id}/deactivate/"""
        medicine = self.get_object()
        medicine.is_active = False
        medicine.save(update_fields=['is_active'])
        return Response(self.get_serializer(medicine).data)

    def destroy(self, request, *args, **kwargs):
        medicine = self.get_object()
        dependencies = []

        rx_count = medicine.prescription_items.count()
        disp_count = medicine.dispense_items.count()

        if rx_count:
            dependencies.append(f"{rx_count} prescription item(s)")
        if disp_count:
            dependencies.append(f"{disp_count} dispense item(s)")

        if dependencies:
            dep_str = ", ".join(dependencies)
            return Response(
                {
                    "detail": (
                        f"Medicine '{medicine.medicine_name}' cannot be deleted because it is referenced in {dep_str}. "
                        "Permanent deletion would corrupt historical prescriptions and pharmacy records. "
                        "Please deactivate this medicine instead."
                    )
                },
                status=status.HTTP_409_CONFLICT
            )

        with transaction.atomic():
            PriceList.objects.filter(medicine=medicine).delete()
            StockTransaction.objects.filter(stock__medicine=medicine).delete()
            StockMaster.objects.filter(medicine=medicine).delete()
            medicine.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminMasterLabTestViewSet(viewsets.ModelViewSet):
    serializer_class = MasterLabTestSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        queryset = MasterLabTest.objects.all()
        name = self.request.query_params.get('name')
        active = self.request.query_params.get('active')
        if name:
            queryset = queryset.filter(
                Q(test_name__icontains=name) |
                Q(test_code__icontains=name) |
                Q(description__icontains=name)
            )
        if active is not None:
            queryset = queryset.filter(is_active=active.lower() == 'true')
        return queryset

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """POST /admin/lab-tests/{id}/activate/"""
        test = self.get_object()
        test.is_active = True
        test.save(update_fields=['is_active'])
        return Response(self.get_serializer(test).data)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """POST /admin/lab-tests/{id}/deactivate/"""
        test = self.get_object()
        test.is_active = False
        test.save(update_fields=['is_active'])
        return Response(self.get_serializer(test).data)

    def destroy(self, request, *args, **kwargs):
        test = self.get_object()
        order_count = test.orders.count()
        if order_count:
            return Response(
                {
                    "detail": (
                        f"Diagnostic test '{test.test_name}' ({test.test_code}) cannot be deleted because it is referenced in {order_count} laboratory test order(s) and patient result(s). "
                        "Permanent deletion would corrupt diagnostic history. Please deactivate this test instead."
                    )
                },
                status=status.HTTP_409_CONFLICT
            )

        test.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except ProtectedError:
            return Response(
                {'detail': 'This stock batch has transaction history and cannot be deleted.'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

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
        queryset = ConsultationInvoice.objects.all().select_related('patient', 'appointment', 'consultation')
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