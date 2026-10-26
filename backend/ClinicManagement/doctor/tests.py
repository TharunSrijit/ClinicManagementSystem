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
    MasterMedicine,
    MasterDosage,
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

        # 4. Master Medicine & Dosage
        cls.medicine = MasterMedicine.objects.create(
            medicine_name='Paracetamol 500mg',
            generic_name='Acetaminophen',
            unit='Tablet',
            is_active=True,
        )
        cls.dosage = MasterDosage.objects.create(
            dosage_name='Twice Daily (BD)',
            description='Take twice a day after meals',
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

    def test_prescription_creation_generates_valid_prescription_number_and_persists_items(self):
        """Prescription creation auto-assigns sequential prescription_number and persists nested items."""
        consult = Consultation.objects.create(
            patient=self.patient1,
            doctor=self.doctor_profile,
            visit_type='UNSCHEDULED',
            diagnosis='Headache & Migraine',
            status='COMPLETED',
        )

        rx_payload = {
            'consultation': consult.id,
            'patient': self.patient1.id,
            'notes': 'Take after meals with water',
            'items': [
                {
                    'medicine': self.medicine.id,
                    'dosage': self.dosage.id,
                    'frequency': 'Twice Daily',
                    'duration': '5 days',
                    'quantity': 10,
                    'instructions': 'Do not consume on empty stomach',
                }
            ],
        }

        resp = self.client.post('/api/doctor/prescriptions/', rx_payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertTrue(resp.data['prescription_number'].startswith('RX'))
        self.assertEqual(resp.data['patient'], self.patient1.id)
        self.assertEqual(resp.data['consultation'], consult.id)
        self.assertEqual(len(resp.data['items']), 1)
        self.assertEqual(resp.data['items'][0]['medicine'], self.medicine.id)
        self.assertEqual(resp.data['items'][0]['quantity'], 10)

        # Verify DB persistence
        rx = Prescription.objects.get(pk=resp.data['id'])
        self.assertTrue(rx.prescription_number.startswith('RX'))
        self.assertEqual(rx.items.count(), 1)
        item = rx.items.first()
        self.assertEqual(item.medicine, self.medicine)
        self.assertEqual(item.quantity, 10)

    def test_duplicate_prescription_for_same_consultation_prevented(self):
        """A consultation cannot have multiple prescriptions; second request is rejected with 400."""
        consult = Consultation.objects.create(
            patient=self.patient1,
            doctor=self.doctor_profile,
            visit_type='UNSCHEDULED',
            diagnosis='Fever',
            status='COMPLETED',
        )

        rx_payload = {
            'consultation': consult.id,
            'patient': self.patient1.id,
            'notes': 'First prescription',
            'items': [],
        }

        resp1 = self.client.post('/api/doctor/prescriptions/', rx_payload, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED, resp1.data)

        # Attempting second prescription for same consultation
        resp2 = self.client.post('/api/doctor/prescriptions/', rx_payload, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already exists', str(resp2.data).lower())

    def test_consultation_serializer_includes_nested_prescription(self):
        """Consultation API returns nested prescription object with items."""
        consult = Consultation.objects.create(
            patient=self.patient1,
            doctor=self.doctor_profile,
            visit_type='UNSCHEDULED',
            diagnosis='Hypertension',
            status='COMPLETED',
        )

        rx_payload = {
            'consultation': consult.id,
            'patient': self.patient1.id,
            'notes': 'Regular BP monitoring',
            'items': [
                {
                    'medicine': self.medicine.id,
                    'dosage': self.dosage.id,
                    'frequency': 'Daily',
                    'duration': '30 days',
                    'quantity': 30,
                    'instructions': 'Every morning',
                }
            ],
        }
        create_resp = self.client.post('/api/doctor/prescriptions/', rx_payload, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)

        # Fetch consultation via API
        resp = self.client.get(f'/api/doctor/consultations/{consult.id}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('prescription', resp.data)
        self.assertIsNotNone(resp.data['prescription'])
        self.assertEqual(resp.data['prescription']['prescription_number'], create_resp.data['prescription_number'])
        self.assertEqual(len(resp.data['prescription']['items']), 1)
        self.assertEqual(resp.data['prescription']['items'][0]['medicine_name'], self.medicine.medicine_name)

    def test_prescription_filter_by_consultation_and_patient(self):
        """Prescriptions endpoint allows filtering by consultation and patient."""
        consult = Consultation.objects.create(
            patient=self.patient1,
            doctor=self.doctor_profile,
            visit_type='UNSCHEDULED',
            diagnosis='Joint Pain',
            status='COMPLETED',
        )
        self.client.post('/api/doctor/prescriptions/', {
            'consultation': consult.id,
            'patient': self.patient1.id,
            'items': [],
        }, format='json')

        # Filter by consultation
        resp = self.client.get(f'/api/doctor/prescriptions/?consultation={consult.id}')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['consultation'], consult.id)

        # Filter by patient
        resp_patient = self.client.get(f'/api/doctor/prescriptions/?patient={self.patient1.id}')
        self.assertEqual(resp_patient.status_code, status.HTTP_200_OK)
        self.assertTrue(all(rx['patient'] == self.patient1.id for rx in resp_patient.data))

    def test_patients_directory_endpoint(self):
        """Doctor can list and search patient directory."""
        resp = self.client.get('/api/doctor/patients-directory/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(resp.data), 2)

        # Search by name
        resp_search = self.client.get('/api/doctor/patients-directory/?search=Arthur')
        self.assertEqual(resp_search.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp_search.data), 1)
        self.assertEqual(resp_search.data[0]['first_name'], 'Arthur')

    def test_consultations_list_and_isolation(self):
        """Doctor can list their own consultations and not other doctor's consultations."""
        c1 = Consultation.objects.create(
            patient=self.patient1,
            doctor=self.doctor_profile,
            visit_type='UNSCHEDULED',
            diagnosis='Flu',
            status='COMPLETED',
        )
        c2 = Consultation.objects.create(
            patient=self.patient2,
            doctor=self.other_doctor_profile,
            visit_type='UNSCHEDULED',
            diagnosis='Migraine',
            status='COMPLETED',
        )
        resp = self.client.get('/api/doctor/consultations/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        consult_ids = [c['id'] for c in resp.data]
        self.assertIn(c1.id, consult_ids)
        self.assertNotIn(c2.id, consult_ids)

    def test_appointments_list_and_date_filtering(self):
        """Doctor can list appointments and filter by date for queue processing."""
        today = datetime.date.today()
        tomorrow = today + datetime.timedelta(days=1)

        appt1 = Appointment.objects.create(
            patient=self.patient1,
            doctor=self.doctor_profile,
            receptionist=self.receptionist_profile,
            appointment_date=today,
            appointment_time=datetime.time(10, 0),
            appointment_type='WALK_IN',
            status='CONFIRMED',
        )
        appt2 = Appointment.objects.create(
            patient=self.patient2,
            doctor=self.doctor_profile,
            receptionist=self.receptionist_profile,
            appointment_date=tomorrow,
            appointment_time=datetime.time(11, 0),
            appointment_type='ADVANCE',
            status='CONFIRMED',
        )
        # Other doctor's appointment
        appt3 = Appointment.objects.create(
            patient=self.patient1,
            doctor=self.other_doctor_profile,
            receptionist=self.receptionist_profile,
            appointment_date=today,
            appointment_time=datetime.time(12, 0),
            appointment_type='WALK_IN',
            status='CONFIRMED',
        )

        # All appointments for this doctor
        resp = self.client.get('/api/doctor/appointments/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        appt_ids = [a['id'] for a in resp.data]
        self.assertIn(appt1.id, appt_ids)
        self.assertIn(appt2.id, appt_ids)
        self.assertNotIn(appt3.id, appt_ids)

        # Queue request filtering by date
        resp_date = self.client.get(f'/api/doctor/appointments/?date={today.isoformat()}')
        self.assertEqual(resp_date.status_code, status.HTTP_200_OK)
        date_ids = [a['id'] for a in resp_date.data]
        self.assertIn(appt1.id, date_ids)
        self.assertNotIn(appt2.id, date_ids)
        self.assertNotIn(appt3.id, date_ids)


