from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import (
    User,
    ReceptionistProfile,
    DoctorProfile,
    LabTechnicianProfile,
    PharmacistProfile,
    Patient,
    MedicalHistory,
    Appointment,
    ConsultationInvoice,
    ConsultationPayment,
    Token,
    Consultation,
    MasterDosage,
    MasterMedicine,
    Prescription,
    PrescriptionItem,
    MasterLabTest,
    LabTestOrder,
    LabTestResult,
    Dispense,
    DispenseItem,
    StockMaster,
    StockTransaction,
    PriceList,
    LabInvoice,
    LabPayment,
    PharmacyInvoice,
    PharmacyPayment,
)

from .serializers import (
    UserSerializer,
    ReceptionistProfileSerializer,
    DoctorProfileSerializer,
    LabTechnicianProfileSerializer,
    PharmacistProfileSerializer,
    PatientSerializer,
    MedicalHistorySerializer,
    AppointmentSerializer,
    ConsultationInvoiceSerializer,
    ConsultationPaymentSerializer,
    TokenSerializer,
    ConsultationSerializer,
    MasterDosageSerializer,
    MasterMedicineSerializer,
    PrescriptionSerializer,
    PrescriptionItemSerializer,
    MasterLabTestSerializer,
    LabTestOrderSerializer,
    LabTestResultSerializer,
    DispenseSerializer,
    DispenseItemSerializer,
    StockMasterSerializer,
    StockTransactionSerializer,
    PriceListSerializer,
    LabInvoiceSerializer,
    LabPaymentSerializer,
    PharmacyInvoiceSerializer,
    PharmacyPaymentSerializer,
)


# ============================================================================
# USER & ROLE PROFILES
# ============================================================================

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]


class ReceptionistProfileViewSet(viewsets.ModelViewSet):
    queryset = ReceptionistProfile.objects.all()
    serializer_class = ReceptionistProfileSerializer
    permission_classes = [IsAuthenticated]


class DoctorProfileViewSet(viewsets.ModelViewSet):
    queryset = DoctorProfile.objects.all()
    serializer_class = DoctorProfileSerializer
    permission_classes = [IsAuthenticated]


class LabTechnicianProfileViewSet(viewsets.ModelViewSet):
    queryset = LabTechnicianProfile.objects.all()
    serializer_class = LabTechnicianProfileSerializer
    permission_classes = [IsAuthenticated]


class PharmacistProfileViewSet(viewsets.ModelViewSet):
    queryset = PharmacistProfile.objects.all()
    serializer_class = PharmacistProfileSerializer
    permission_classes = [IsAuthenticated]


# ============================================================================
# PATIENT
# ============================================================================

class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated]


class MedicalHistoryViewSet(viewsets.ModelViewSet):
    queryset = MedicalHistory.objects.all()
    serializer_class = MedicalHistorySerializer
    permission_classes = [IsAuthenticated]


# ============================================================================
# APPOINTMENT
# ============================================================================

class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Appointment.objects.all()

        patient = self.request.query_params.get("patient")
        doctor = self.request.query_params.get("doctor")
        status = self.request.query_params.get("status")

        if patient:
            queryset = queryset.filter(patient_id=patient)

        if doctor:
            queryset = queryset.filter(doctor_id=doctor)

        if status:
            queryset = queryset.filter(status=status)

        return queryset


# ============================================================================
# CONSULTATION BILLING
# ============================================================================

class ConsultationInvoiceViewSet(viewsets.ModelViewSet):
    queryset = ConsultationInvoice.objects.all()
    serializer_class = ConsultationInvoiceSerializer
    permission_classes = [IsAuthenticated]


class ConsultationPaymentViewSet(viewsets.ModelViewSet):
    queryset = ConsultationPayment.objects.all()
    serializer_class = ConsultationPaymentSerializer
    permission_classes = [IsAuthenticated]


class TokenViewSet(viewsets.ModelViewSet):
    queryset = Token.objects.all()
    serializer_class = TokenSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Token.objects.all()

        token_date = self.request.query_params.get("date")
        status = self.request.query_params.get("status")

        if token_date:
            queryset = queryset.filter(token_date=token_date)

        if status:
            queryset = queryset.filter(status=status)

        return queryset


class ConsultationViewSet(viewsets.ModelViewSet):
    queryset = Consultation.objects.all()
    serializer_class = ConsultationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Consultation.objects.all()

        patient = self.request.query_params.get("patient")
        doctor = self.request.query_params.get("doctor")

        if patient:
            queryset = queryset.filter(patient_id=patient)

        if doctor:
            queryset = queryset.filter(doctor_id=doctor)

        return queryset


# ============================================================================
# PRESCRIPTION
# ============================================================================

class MasterDosageViewSet(viewsets.ModelViewSet):
    queryset = MasterDosage.objects.all()
    serializer_class = MasterDosageSerializer
    permission_classes = [IsAuthenticated]


class MasterMedicineViewSet(viewsets.ModelViewSet):
    queryset = MasterMedicine.objects.all()
    serializer_class = MasterMedicineSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = MasterMedicine.objects.all()

        name = self.request.query_params.get("name")
        category = self.request.query_params.get("category")
        active = self.request.query_params.get("active")

        if name:
            queryset = queryset.filter(
                medicine_name__icontains=name
            )

        if category:
            queryset = queryset.filter(
                category__icontains=category
            )

        if active:
            queryset = queryset.filter(
                is_active=active.lower() == "true"
            )

        return queryset


class PrescriptionViewSet(viewsets.ModelViewSet):
    queryset = Prescription.objects.all()
    serializer_class = PrescriptionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Prescription.objects.all()

        patient = self.request.query_params.get("patient")
        doctor = self.request.query_params.get("doctor")

        if patient:
            queryset = queryset.filter(patient_id=patient)

        if doctor:
            queryset = queryset.filter(doctor_id=doctor)

        return queryset


class PrescriptionItemViewSet(viewsets.ModelViewSet):
    queryset = PrescriptionItem.objects.all()
    serializer_class = PrescriptionItemSerializer
    permission_classes = [IsAuthenticated]


# ============================================================================
# LAB
# ============================================================================

class MasterLabTestViewSet(viewsets.ModelViewSet):
    queryset = MasterLabTest.objects.all()
    serializer_class = MasterLabTestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = MasterLabTest.objects.all()

        name = self.request.query_params.get("name")
        active = self.request.query_params.get("active")

        if name:
            queryset = queryset.filter(
                test_name__icontains=name
            )

        if active:
            queryset = queryset.filter(
                is_active=active.lower() == "true"
            )

        return queryset


class LabTestOrderViewSet(viewsets.ModelViewSet):
    queryset = LabTestOrder.objects.all()
    serializer_class = LabTestOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = LabTestOrder.objects.all()

        patient = self.request.query_params.get("patient")
        doctor = self.request.query_params.get("doctor")
        test = self.request.query_params.get("test")
        status = self.request.query_params.get("status")

        if patient:
            queryset = queryset.filter(patient_id=patient)

        if doctor:
            queryset = queryset.filter(doctor_id=doctor)

        if test:
            queryset = queryset.filter(test_id=test)

        if status:
            queryset = queryset.filter(status=status)

        return queryset


class LabTestResultViewSet(viewsets.ModelViewSet):
    queryset = LabTestResult.objects.all()
    serializer_class = LabTestResultSerializer
    permission_classes = [IsAuthenticated]


# ============================================================================
# PHARMACY
# ============================================================================

class DispenseViewSet(viewsets.ModelViewSet):
    queryset = Dispense.objects.all()
    serializer_class = DispenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Dispense.objects.all()

        patient = self.request.query_params.get("patient")
        prescription = self.request.query_params.get("prescription")
        status = self.request.query_params.get("status")

        if patient:
            queryset = queryset.filter(patient_id=patient)

        if prescription:
            queryset = queryset.filter(
                prescription_id=prescription
            )

        if status:
            queryset = queryset.filter(status=status)

        return queryset


class DispenseItemViewSet(viewsets.ModelViewSet):
    queryset = DispenseItem.objects.all()
    serializer_class = DispenseItemSerializer
    permission_classes = [IsAuthenticated]


# ============================================================================
# STOCK / PRICE
# ============================================================================

class StockMasterViewSet(viewsets.ModelViewSet):
    queryset = StockMaster.objects.all()
    serializer_class = StockMasterSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = StockMaster.objects.all()

        medicine = self.request.query_params.get("medicine")

        if medicine:
            queryset = queryset.filter(
                medicine_id=medicine
            )

        return queryset


class StockTransactionViewSet(viewsets.ModelViewSet):
    queryset = StockTransaction.objects.all()
    serializer_class = StockTransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = StockTransaction.objects.all()

        stock = self.request.query_params.get("stock")
        transaction_type = self.request.query_params.get("type")

        if stock:
            queryset = queryset.filter(stock_id=stock)

        if transaction_type:
            queryset = queryset.filter(
                transaction_type=transaction_type
            )

        return queryset


class PriceListViewSet(viewsets.ModelViewSet):
    queryset = PriceList.objects.all()
    serializer_class = PriceListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = PriceList.objects.all()

        medicine = self.request.query_params.get("medicine")
        active = self.request.query_params.get("active")

        if medicine:
            queryset = queryset.filter(
                medicine_id=medicine
            )

        if active:
            queryset = queryset.filter(
                is_active=active.lower() == "true"
            )

        return queryset


# ============================================================================
# LAB BILLING
# ============================================================================

class LabInvoiceViewSet(viewsets.ModelViewSet):
    queryset = LabInvoice.objects.all()
    serializer_class = LabInvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = LabInvoice.objects.all()

        patient = self.request.query_params.get("patient")
        status = self.request.query_params.get("status")

        if patient:
            queryset = queryset.filter(patient_id=patient)

        if status:
            queryset = queryset.filter(status=status)

        return queryset


class LabPaymentViewSet(viewsets.ModelViewSet):
    queryset = LabPayment.objects.all()
    serializer_class = LabPaymentSerializer
    permission_classes = [IsAuthenticated]


# ============================================================================
# PHARMACY BILLING
# ============================================================================

class PharmacyInvoiceViewSet(viewsets.ModelViewSet):
    queryset = PharmacyInvoice.objects.all()
    serializer_class = PharmacyInvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = PharmacyInvoice.objects.all()

        patient = self.request.query_params.get("patient")
        status = self.request.query_params.get("status")

        if patient:
            queryset = queryset.filter(patient_id=patient)

        if status:
            queryset = queryset.filter(status=status)

        return queryset


class PharmacyPaymentViewSet(viewsets.ModelViewSet):
    queryset = PharmacyPayment.objects.all()
    serializer_class = PharmacyPaymentSerializer
    permission_classes = [IsAuthenticated]