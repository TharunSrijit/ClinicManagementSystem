import datetime
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from apibackendapp.models import (
    User,
    DoctorProfile,
    ReceptionistProfile,
    Patient,
    Appointment,
    Token,
    Consultation,
    Prescription,
    PrescriptionItem,
    MasterLabTest,
    LabTestOrder,
    ConsultationInvoice,
)
from doctor.serializers import AppointmentSerializer


class DoctorConsultationWorkflowTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        # 1. Create Users & Profiles
        cls.doctor_user = User.objects.create_user(
            username='doctor_test',
            email='doctor_test@clinic.com',
            password='TestPassword123!',
            role='DOCTOR',
            first_name='John',
            last_name='Watson',
        )
        cls.doctor_profile = DoctorProfile.objects.create(
            user=cls.doctor_user,
            doctor_id='DOC_TEST',
            specialization='General Medicine',
            qualification='MBBS',
            registration_number='REG_DOC_TEST',
            consultation_fee=350.00,
            available_from=datetime.time(9, 0),
            available_to=datetime.time(17, 0),
            slot_minutes=15,
        )

        cls.other_doctor_user = User.objects.create_user(
            username='doctor_other',
            email='doctor_other@clinic.com',
            password='TestPassword123!',
            role='DOCTOR',
            first_name='Gregory',
            last_name='House',
        )
        cls.other_doctor_profile = DoctorProfile.objects.create(
            user=cls.other_doctor_user,
            doctor_id='DOC_OTHER',
            specialization='Diagnostics',
            qualification='MD',
            registration_number='REG_DOC_OTHER',
            consultation_fee=600.00,
            available_from=datetime.time(9, 0),
            available_to=datetime.time(17, 0),
            slot_minutes=15,
        )

        cls.receptionist_user = User.objects.create_user(
            username='rec_test',
            email='rec_test@clinic.com',
            password='TestPassword123!',
            role='RECEPTIONIST',
        )
        cls.receptionist_profile = ReceptionistProfile.objects.create(
            user=cls.receptionist_user,
            employee_id='REC_TEST',
            phone='9998887770',
        )

        # 2. Patients
        cls.patient1 = Patient.objects.create(
            patient_id='PAT_DOC_01',
            first_name='Arthur',
            last_name='Dent',
            date_of_birth=datetime.date(1985, 3, 11),
            gender='MALE',
            phone='9123456780',
            email='arthur@earth.com',
        )
        cls.patient2 = Patient.objects.create(
            patient_id='PAT_DOC_02',
            first_name='Ford',
            last_name='Prefect',
            date_of_birth=datetime.date(1982, 7, 24),
            gender='MALE',
            phone='9123456781',
            email='ford@galaxy.com',
        )

        # 3. Lab Test
        cls.lab_test = MasterLabTest.objects.create(
            test_code='CBC_TEST',
            test_name='Complete Blood Count',
            price=250.00,
            is_active=True,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.doctor_user)

    def test_appointment_serializer_exposes_token_details(self):
        """AppointmentSerializer should expose token_number and token_status when token exists, or None."""
        appt_without_token = Appointment.objects.create(
            patient=self.patient1,
            doctor=self.doctor_profile,
            receptionist=self.receptionist_profile,
            appointment_type='WALKIN',
            appointment_date=timezone.localdate(),
            appointment_time=datetime.time(10, 0),
            status='CONFIRMED',
        )
        serializer_no_token = AppointmentSerializer(appt_without_token)
        self.assertIsNone(serializer_no_token.data['token_number'])
        self.assertIsNone(serializer_no_token.data['token_status'])

        # Issue token
        token = Token.objects.create(
            appointment=appt_without_token,
            token_number=42,
            token_date=timezone.localdate(),
            status='WAITING',
        )
        # Re-fetch with relation
        appt_with_token = Appointment.objects.select_related('token').get(pk=appt_without_token.pk)
        serializer_with_token = AppointmentSerializer(appt_with_token)
        self.assertEqual(serializer_with_token.data['token_number'], 42)
        self.assertEqual(serializer_with_token.data['token_status'], 'WAITING')

    def test_token_based_consultation_requires_valid_token(self):
        """Creating a token-based consultation on an appointment without a token must fail with 400."""
        appt = Appointment.objects.create(
            patient=self.patient1,
            doctor=self.doctor_profile,
            receptionist=self.receptionist_profile,
            appointment_type='WALKIN',
            appointment_date=timezone.localdate(),
            appointment_time=datetime.time(10, 30),
            status='CONFIRMED',
        )

        payload = {
            'appointment': appt.id,
            'patient': self.patient1.id,
            'visit_type': 'TOKEN_BASED',
            'diagnosis': 'Headache',
            'symptoms': 'Throbbing pain',
            'clinical_notes': 'Observed symptoms',
            'treatment_plan': 'Rest and hydration',
            'status': 'COMPLETED',
        }

        # 1. Without token -> 400 Bad Request
        resp = self.client.post('/api/doctor/consultations/', payload)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('token', resp.data)

        # 2. With CANCELLED token -> 400 Bad Request
        token = Token.objects.create(
            appointment=appt,
            token_number=10,
            token_date=timezone.localdate(),
            status='CANCELLED',
        )
        resp2 = self.client.post('/api/doctor/consultations/', payload)
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('token', resp2.data)

        # 3. With WAITING token -> 201 Created
        token.status = 'WAITING'
        token.save()
        resp3 = self.client.post('/api/doctor/consultations/', payload)
        self.assertEqual(resp3.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp3.data['status'], 'COMPLETED')
        self.assertEqual(resp3.data['visit_type'], 'TOKEN_BASED')

    def test_prescription_creation_without_doctor_in_payload_succeeds(self):
        """PrescriptionSerializer has doctor in read_only_fields; doctor is populated from auth user."""
        appt = Appointment.objects.create(
            patient=self.patient1,
            doctor=self.doctor_profile,
            receptionist=self.receptionist_profile,
            appointment_type='WALKIN',
            appointment_date=timezone.localdate(),
            appointment_time=datetime.time(11, 0),
            status='CONFIRMED',
        )
        Token.objects.create(
            appointment=appt,
            token_number=11,
            token_date=timezone.localdate(),
            status='WAITING',
        )
        consult = Consultation.objects.create(
            appointment=appt,
            patient=self.patient1,
            doctor=self.doctor_profile,
            visit_type='TOKEN_BASED',
            status='IN_PROGRESS',
        )

        rx_payload = {
            'consultation': consult.id,
            'patient': self.patient1.id,
            'notes': 'Take medication regularly',
        }
        resp = self.client.post('/api/doctor/prescriptions/', rx_payload)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertEqual(resp.data['doctor'], self.doctor_profile.id)
        self.assertEqual(resp.data['patient'], self.patient1.id)

    def test_lab_order_creation_without_doctor_in_payload_succeeds(self):
        """LabTestOrderSerializer has doctor in read_only_fields; doctor is populated from auth user."""
        appt = Appointment.objects.create(
            patient=self.patient1,
            doctor=self.doctor_profile,
            receptionist=self.receptionist_profile,
            appointment_type='WALKIN',
            appointment_date=timezone.localdate(),
            appointment_time=datetime.time(11, 15),
            status='CONFIRMED',
        )
        Token.objects.create(
            appointment=appt,
            token_number=12,
            token_date=timezone.localdate(),
            status='WAITING',
        )
        consult = Consultation.objects.create(
            appointment=appt,
            patient=self.patient1,
            doctor=self.doctor_profile,
            visit_type='TOKEN_BASED',
            status='IN_PROGRESS',
        )

        lab_payload = {
            'consultation': consult.id,
            'patient': self.patient1.id,
            'test': self.lab_test.id,
        }
        resp = self.client.post('/api/doctor/lab-orders/', lab_payload)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertEqual(resp.data['doctor'], self.doctor_profile.id)
        self.assertEqual(resp.data['patient'], self.patient1.id)
        self.assertEqual(resp.data['test'], self.lab_test.id)

    def test_unscheduled_consultation_creates_invoice_and_record(self):
        """Unscheduled consultation does not require appointment or token, and generates invoice."""
        payload = {
            'patient': self.patient2.id,
            'visit_type': 'UNSCHEDULED',
            'visit_reason': 'Sudden fever',
            'diagnosis': 'Viral infection',
            'symptoms': 'High fever and chills',
            'clinical_notes': 'Prescribe antipyretic',
            'treatment_plan': 'Rest for 3 days',
            'status': 'COMPLETED',
        }
        resp = self.client.post('/api/doctor/consultations/', payload)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        consult_id = resp.data['id']

        consult = Consultation.objects.get(pk=consult_id)
        self.assertEqual(consult.visit_type, 'UNSCHEDULED')
        self.assertIsNone(consult.appointment)

        # Verify ConsultationInvoice was created
        invoice = ConsultationInvoice.objects.filter(consultation=consult).first()
        self.assertIsNotNone(invoice)
        self.assertEqual(invoice.status, 'PENDING')
        self.assertEqual(invoice.patient, self.patient2)
        self.assertEqual(invoice.consultation_fee, self.doctor_profile.consultation_fee)
