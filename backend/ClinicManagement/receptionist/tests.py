import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo
from unittest.mock import patch
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
    ConsultationInvoice,
    ConsultationPayment,
    Consultation,
    ClinicConfiguration,
)
from apibackendapp.serializers import AppointmentSerializer


class ReceptionistAppointmentTokenWorkflowTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        # 1. Staff users & profiles
        cls.receptionist_user = User.objects.create_user(
            username='rec_staff',
            email='rec_staff@clinic.com',
            password='TestPassword123!',
            role='RECEPTIONIST',
        )
        cls.receptionist_profile = ReceptionistProfile.objects.create(
            user=cls.receptionist_user,
            employee_id='REC_STF_01',
            phone='9876500001',
        )

        cls.doctor_user = User.objects.create_user(
            username='doc_staff',
            email='doc_staff@clinic.com',
            password='TestPassword123!',
            role='DOCTOR',
            first_name='Sarah',
            last_name='Connor',
        )
        cls.doctor_profile = DoctorProfile.objects.create(
            user=cls.doctor_user,
            doctor_id='DOC_STF_01',
            specialization='General Medicine',
            qualification='MBBS',
            registration_number='REG_STF_01',
            consultation_fee=400.00,
            available_from=datetime.time(9, 0),
            available_to=datetime.time(17, 0),
            slot_minutes=15,
        )

        cls.doctor2_user = User.objects.create_user(
            username='doc_other',
            email='doc_other@clinic.com',
            password='TestPassword123!',
            role='DOCTOR',
            first_name='Gregory',
            last_name='House',
        )
        cls.doctor2_profile = DoctorProfile.objects.create(
            user=cls.doctor2_user,
            doctor_id='DOC_STF_02',
            specialization='Diagnostics',
            qualification='MD',
            registration_number='REG_STF_02',
            consultation_fee=600.00,
            available_from=datetime.time(9, 0),
            available_to=datetime.time(17, 0),
            slot_minutes=15,
        )

        cls.other_user = User.objects.create_user(
            username='other_staff',
            email='other_staff@clinic.com',
            password='TestPassword123!',
            role='PHARMACIST',
        )

        # 2. Patients
        cls.patient1 = Patient.objects.create(
            patient_id='PAT_REC_01',
            first_name='Alice',
            last_name='Wonder',
            gender='FEMALE',
            phone='9876500002',
        )
        cls.patient2 = Patient.objects.create(
            patient_id='PAT_REC_02',
            first_name='Bob',
            last_name='Builder',
            gender='MALE',
            phone='9876500003',
        )

    def setUp(self):
        # Freeze local time to a known weekday morning (e.g. 10:00 AM)
        self.tz = ZoneInfo('Asia/Kolkata')
        self.frozen_now = datetime.datetime(2026, 10, 24, 10, 0, 0, tzinfo=self.tz)
        self.patcher = patch('apibackendapp.scheduling.now_local', return_value=self.frozen_now)
        self.patcher.start()

        self.client = APIClient()
        self.client.force_authenticate(user=self.receptionist_user)

    def tearDown(self):
        self.patcher.stop()

    def test_walkin_is_automatically_arrived_without_confirm_arrival_action(self):
        """
        Requirement 1:
        When a walk-in appointment is registered for today, its arrival status
        automatically becomes ARRIVED (CONFIRMED). No separate Confirm Arrival action is needed.
        Initially, no token is issued, and a consultation fee invoice is created with PENDING status.
        """
        today = self.frozen_now.date()
        book_resp = self.client.post('/api/receptionist/appointments/', {
            'doctor': self.doctor_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'WALK_IN',
            'appointment_date': today.isoformat(),
            'appointment_time': '10:30:00',
            'reason': 'Headache',
        })
        self.assertEqual(book_resp.status_code, status.HTTP_201_CREATED)
        appt_id = book_resp.data['id']

        # Initially in PENDING payment state
        self.assertEqual(book_resp.data['status'], 'PENDING')
        self.assertEqual(book_resp.data['arrival_status'], 'PENDING')

        # No token yet
        self.assertIsNone(book_resp.data['token_number'])

        # Consultation fee bill created
        self.assertEqual(book_resp.data['consultation_fee'], '400.00')
        self.assertEqual(book_resp.data['invoice_status'], 'PENDING')
        self.assertFalse(book_resp.data['is_paid'])

        # Verify bill exists in DB
        invoice = ConsultationInvoice.objects.filter(appointment_id=appt_id).first()
        self.assertIsNotNone(invoice)
        self.assertEqual(invoice.status, 'PENDING')
        self.assertEqual(invoice.registration_fee, Decimal('100.00'))
        self.assertEqual(invoice.consultation_fee, Decimal('400.00'))
        self.assertEqual(invoice.total_amount, Decimal('500.00'))

        # Pay invoice via Billing endpoint
        pay_resp = self.client.post('/api/receptionist/consultation-payments/', {
            'invoice': invoice.id,
            'amount': invoice.total_amount,
            'payment_method': 'CASH',
        })
        self.assertEqual(pay_resp.status_code, status.HTTP_201_CREATED)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, 'PAID')

        # Walk-in automatically becomes CONFIRMED (ARRIVED) upon payment without manual confirm_arrival action
        appt = Appointment.objects.get(id=appt_id)
        self.assertEqual(appt.status, 'CONFIRMED')
        self.assertEqual(AppointmentSerializer(appt).data['arrival_status'], 'ARRIVED')

    def test_walkin_with_unpaid_fee_cannot_receive_token(self):
        """
        Requirement 2:
        A walk-in appointment cannot receive a token while its consultation fee is unpaid.
        """
        today = self.frozen_now.date()
        book_resp = self.client.post('/api/receptionist/appointments/', {
            'doctor': self.doctor_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'WALK_IN',
            'appointment_date': today.isoformat(),
            'appointment_time': '10:45:00',
        })
        appt_id = book_resp.data['id']

        # Attempt to issue token without paying fee -> Rejected 400 Bad Request
        resp_tok = self.client.post(f'/api/receptionist/appointments/{appt_id}/issue_token/')
        self.assertEqual(resp_tok.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('must be paid before issuing a token', resp_tok.data['detail'])

        # Attempt via /api/receptionist/tokens/ -> Rejected 400 Bad Request
        resp_tok2 = self.client.post('/api/receptionist/tokens/', {'appointment': appt_id})
        self.assertEqual(resp_tok2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('must be paid before issuing a token', str(resp_tok2.data))

    def test_walkin_with_paid_fee_receives_exactly_one_token(self):
        """
        Requirement 3:
        After consultation fee payment is recorded in the database,
        the receptionist can issue the token exactly once.
        """
        today = self.frozen_now.date()
        book_resp = self.client.post('/api/receptionist/appointments/', {
            'doctor': self.doctor_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'WALK_IN',
            'appointment_date': today.isoformat(),
            'appointment_time': '11:00:00',
        })
        appt_id = book_resp.data['id']

        # Collect / pay fee
        pay_resp = self.client.post(f'/api/receptionist/appointments/{appt_id}/collect_fee/', {
            'payment_method': 'CASH',
            'transaction_id': 'REC-CASH-001',
        })
        self.assertEqual(pay_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(pay_resp.data['invoice']['status'], 'PAID')

        # Now issue token -> Succeeds with 201 Created
        resp_tok = self.client.post(f'/api/receptionist/appointments/{appt_id}/issue_token/')
        self.assertEqual(resp_tok.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp_tok.data['token']['token_number'], 101)
        self.assertEqual(resp_tok.data['token']['status'], 'WAITING')

        # Second attempt to issue duplicate token -> Rejected 400 Bad Request
        resp_dup = self.client.post(f'/api/receptionist/appointments/{appt_id}/issue_token/')
        self.assertEqual(resp_dup.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already been issued', resp_dup.data['detail'])

    def test_advance_appointment_requires_explicit_arrival_confirmation(self):
        """
        Requirement 4:
        Advance appointments are booked up to 7 days ahead with BOOKED status.
        They require explicit arrival confirmation before becoming eligible for payment or token.
        """
        today = self.frozen_now.date()
        # Create an advance appointment for today (patient arrives on appointment date)
        appt = Appointment.objects.create(
            doctor=self.doctor_profile,
            patient=self.patient2,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=today,
            appointment_time=datetime.time(11, 15),
            status='BOOKED',
        )

        # Attempt to issue token directly on BOOKED advance appointment -> Rejected 400
        resp_issue = self.client.post(f'/api/receptionist/appointments/{appt.id}/issue_token/')
        self.assertEqual(resp_issue.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('arrival must be confirmed', resp_issue.data['detail'])

        # Explicitly confirm arrival
        arr_resp = self.client.post(f'/api/receptionist/appointments/{appt.id}/confirm_arrival/')
        self.assertEqual(arr_resp.status_code, status.HTTP_200_OK)
        appt.refresh_from_db()
        self.assertEqual(appt.status, 'CONFIRMED')
        self.assertIsNotNone(appt.consultation_invoice)
        self.assertEqual(appt.consultation_invoice.status, 'PENDING')

    def test_advance_appointment_cannot_receive_token_before_payment(self):
        """
        Requirement 5:
        Even after arrival confirmation, an advance appointment cannot receive
        a token until its consultation fee is fully paid.
        """
        today = self.frozen_now.date()
        appt = Appointment.objects.create(
            doctor=self.doctor_profile,
            patient=self.patient2,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=today,
            appointment_time=datetime.time(11, 30),
            status='BOOKED',
        )

        # Confirm arrival
        self.client.post(f'/api/receptionist/appointments/{appt.id}/confirm_arrival/')

        # Fee is unpaid -> Token issuance rejected 400
        resp_tok = self.client.post(f'/api/receptionist/appointments/{appt.id}/issue_token/')
        self.assertEqual(resp_tok.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('must be paid before issuing a token', resp_tok.data['detail'])

    def test_advance_appointment_with_confirmed_arrival_and_paid_fee_receives_token(self):
        """
        Requirement 6:
        Once BOTH arrival is confirmed AND the fee is paid, token issuance succeeds.
        """
        today = self.frozen_now.date()
        appt = Appointment.objects.create(
            doctor=self.doctor_profile,
            patient=self.patient2,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=today,
            appointment_time=datetime.time(11, 45),
            status='BOOKED',
        )

        # 1. Confirm arrival
        self.client.post(f'/api/receptionist/appointments/{appt.id}/confirm_arrival/')

        # 2. Pay consultation fee via consultation-payments endpoint
        appt.refresh_from_db()
        invoice = appt.consultation_invoice
        pay_resp = self.client.post('/api/receptionist/consultation-payments/', {
            'invoice': invoice.id,
            'amount': invoice.total_amount,
            'payment_method': 'UPI',
            'transaction_id': 'UPI-REF-999',
        })
        self.assertEqual(pay_resp.status_code, status.HTTP_201_CREATED)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, 'PAID')

        # 3. Issue token -> Succeeds exactly once
        tok_resp = self.client.post(f'/api/receptionist/appointments/{appt.id}/issue_token/')
        self.assertEqual(tok_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(tok_resp.data['token']['token_number'], 1)
        self.assertEqual(tok_resp.data['token']['status'], 'WAITING')

    def test_forged_frontend_payment_flags_and_duplicate_tokens_rejected(self):
        """
        Requirement 7:
        Verify payment against the actual persisted bill/payment record; never trust
        a frontend-supplied is_paid flag. Reject duplicate token requests.
        """
        today = self.frozen_now.date()
        appt = Appointment.objects.create(
            doctor=self.doctor_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='WALK_IN',
            appointment_date=today,
            appointment_time=datetime.time(12, 0),
            status='CONFIRMED',
        )

        # Client attempts to forge is_paid=True in the payload
        forged_resp = self.client.post(
            f'/api/receptionist/appointments/{appt.id}/issue_token/',
            {'is_paid': True, 'invoice_status': 'PAID', 'amount': '0.00'}
        )
        self.assertEqual(forged_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('must be paid before issuing a token', forged_resp.data['detail'])

        # Now legitimately pay the fee
        self.client.post(f'/api/receptionist/appointments/{appt.id}/collect_fee/', {
            'payment_method': 'CARD',
            'transaction_id': 'AUTH-777',
        })

        # Legitimately issue token
        valid_tok = self.client.post(f'/api/receptionist/appointments/{appt.id}/issue_token/')
        self.assertEqual(valid_tok.status_code, status.HTTP_201_CREATED)

        # Duplicate attempt must fail
        dup_tok = self.client.post(f'/api/receptionist/appointments/{appt.id}/issue_token/')
        self.assertEqual(dup_tok.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already been issued', dup_tok.data['detail'])

    def test_complete_end_to_end_flow_reception_to_doctor_consultation(self):
        """
        Requirement 8:
        Complete flow:
        1. Receptionist books walk-in (automatically Arrived, invoice created PENDING).
        2. Attempt token without payment -> Rejected 400.
        3. Receptionist records consultation fee payment -> Invoice becomes PAID.
        4. Receptionist issues token -> Token #1 WAITING.
        5. Token appears in Receptionist Live Queue.
        6. Token appears in Doctor Queue.
        7. Doctor examines patient and saves consultation.
        8. Doctor completes appointment.
        """
        today = self.frozen_now.date()

        # Step 1: Book walk-in
        book_resp = self.client.post('/api/receptionist/appointments/', {
            'doctor': self.doctor_profile.id,
            'patient': self.patient2.id,
            'appointment_type': 'WALK_IN',
            'appointment_date': today.isoformat(),
            'appointment_time': '12:15:00',
            'reason': 'Stomach ache',
        })
        self.assertEqual(book_resp.status_code, status.HTTP_201_CREATED)
        appt_id = book_resp.data['id']
        self.assertEqual(book_resp.data['status'], 'PENDING')
        self.assertEqual(book_resp.data['invoice_status'], 'PENDING')
        self.assertIsNone(book_resp.data['token_number'])

        # Step 2: Attempt token without payment -> Rejected 400
        fail_tok = self.client.post(f'/api/receptionist/appointments/{appt_id}/issue_token/')
        self.assertEqual(fail_tok.status_code, status.HTTP_400_BAD_REQUEST)

        # Step 3: Record payment
        pay_resp = self.client.post(f'/api/receptionist/appointments/{appt_id}/collect_fee/', {
            'payment_method': 'UPI',
            'transaction_id': 'UPI-STOMACH-001',
        })
        self.assertEqual(pay_resp.status_code, status.HTTP_200_OK)

        # Step 4: Issue token -> Succeeds
        tok_resp = self.client.post(f'/api/receptionist/appointments/{appt_id}/issue_token/')
        self.assertEqual(tok_resp.status_code, status.HTTP_201_CREATED)
        token_num = tok_resp.data['token']['token_number']
        self.assertEqual(tok_resp.data['token']['status'], 'WAITING')

        # Step 5: Verify in receptionist queue
        queue_resp = self.client.get('/api/receptionist/tokens/', {'date': today.isoformat()})
        self.assertEqual(queue_resp.status_code, status.HTTP_200_OK)
        tokens_list = queue_resp.data if isinstance(queue_resp.data, list) else queue_resp.data.get('results', [])
        found_in_rec_queue = next((t for t in tokens_list if t['appointment'] == appt_id), None)
        self.assertIsNotNone(found_in_rec_queue)
        self.assertEqual(found_in_rec_queue['token_number'], token_num)

        # Step 6: Verify in doctor appointments / queue
        doc_client = APIClient()
        doc_client.force_authenticate(user=self.doctor_user)
        doc_resp = doc_client.get('/api/doctor/appointments/', {'date': today.isoformat()})
        self.assertEqual(doc_resp.status_code, status.HTTP_200_OK)
        doc_appts = doc_resp.data if isinstance(doc_resp.data, list) else doc_resp.data.get('results', [])
        doc_appt = next((a for a in doc_appts if a['id'] == appt_id), None)
        self.assertIsNotNone(doc_appt)
        self.assertEqual(doc_appt['token_number'], token_num)
        self.assertEqual(doc_appt['token_status'], 'WAITING')

        # Step 7: Doctor records and saves consultation
        consult_resp = doc_client.post('/api/doctor/consultations/', {
            'appointment': appt_id,
            'patient': self.patient2.id,
            'visit_type': 'TOKEN_BASED',
            'diagnosis': 'Acute Gastritis',
            'symptoms': 'Abdominal discomfort after food',
            'clinical_notes': 'Prescribe antacids',
            'treatment_plan': 'Follow light diet for 3 days',
            'status': 'COMPLETED',
        })
        self.assertEqual(consult_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(consult_resp.data['status'], 'COMPLETED')
        self.assertEqual(consult_resp.data['token_number'], token_num)

        # Step 8: Doctor completes appointment
        comp_resp = doc_client.post(f'/api/doctor/appointments/{appt_id}/complete/')
        self.assertEqual(comp_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(comp_resp.data['status'], 'COMPLETED')

    def test_appointment_cancellation_cancels_active_token(self):
        """Cancelling an appointment also marks its associated queue token as CANCELLED."""
        today = self.frozen_now.date()
        appt = Appointment.objects.create(
            doctor=self.doctor_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='WALK_IN',
            appointment_date=today,
            appointment_time=datetime.time(12, 30),
            status='CONFIRMED',
        )

        # Pay and issue token
        self.client.post(f'/api/receptionist/appointments/{appt.id}/collect_fee/', {
            'payment_method': 'CASH',
        })
        self.client.post(f'/api/receptionist/appointments/{appt.id}/issue_token/')
        appt.refresh_from_db()
        self.assertEqual(appt.token.status, 'WAITING')

        # Cancel appointment
        resp_cancel = self.client.post(f'/api/receptionist/appointments/{appt.id}/cancel/')
        self.assertEqual(resp_cancel.status_code, status.HTTP_200_OK)
        appt.refresh_from_db()
        self.assertEqual(appt.status, 'CANCELLED')
        self.assertEqual(appt.token.status, 'CANCELLED')

    def test_unauthorized_user_cannot_access_receptionist_actions(self):
        """Non-receptionist roles receive 403 Forbidden on receptionist appointment actions."""
        today = self.frozen_now.date()
        appt = Appointment.objects.create(
            doctor=self.doctor_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='WALK_IN',
            appointment_date=today,
            appointment_time=datetime.time(12, 45),
            status='CONFIRMED',
        )

        unauth_client = APIClient()
        unauth_client.force_authenticate(user=self.other_user)

        resp = unauth_client.post(f'/api/receptionist/appointments/{appt.id}/confirm_arrival/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

        resp2 = unauth_client.post(f'/api/receptionist/appointments/{appt.id}/issue_token/')
        self.assertEqual(resp2.status_code, status.HTTP_403_FORBIDDEN)

        resp3 = unauth_client.post(f'/api/receptionist/appointments/{appt.id}/collect_fee/')
        self.assertEqual(resp3.status_code, status.HTTP_403_FORBIDDEN)

    def test_advance_and_walkin_token_number_priority(self):
        """
        Token priority rules:
        - Advance appointments must receive lower token numbers than walk-ins (1..99).
        - Walk-ins receive higher token numbers (101..), even if issued earlier.
        - Never renumber previously issued tokens or create duplicate token numbers.
        """
        today = self.frozen_now.date()

        # 1. Walk-in appointment arrives and pays first
        walkin_appt1 = Appointment.objects.create(
            doctor=self.doctor_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='WALK_IN',
            appointment_date=today,
            appointment_time=datetime.time(9, 15),
            status='CONFIRMED',
        )
        self.client.post(f'/api/receptionist/appointments/{walkin_appt1.id}/collect_fee/', {'payment_method': 'CASH'})
        resp_w1 = self.client.post(f'/api/receptionist/appointments/{walkin_appt1.id}/issue_token/')
        self.assertEqual(resp_w1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp_w1.data['token']['token_number'], 101)

        # 2. Advance appointment arrives and pays second (after the walk-in)
        advance_appt1 = Appointment.objects.create(
            doctor=self.doctor_profile,
            patient=self.patient2,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=today,
            appointment_time=datetime.time(10, 0),
            status='BOOKED',
        )
        self.client.post(f'/api/receptionist/appointments/{advance_appt1.id}/confirm_arrival/')
        self.client.post(f'/api/receptionist/appointments/{advance_appt1.id}/collect_fee/', {'payment_method': 'UPI'})
        resp_a1 = self.client.post(f'/api/receptionist/appointments/{advance_appt1.id}/issue_token/')
        self.assertEqual(resp_a1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp_a1.data['token']['token_number'], 1)

        # Verified: Advance token number (1) is strictly less than walk-in token number (101)
        self.assertLess(resp_a1.data['token']['token_number'], resp_w1.data['token']['token_number'])

        # 3. Second advance appointment
        advance_appt2 = Appointment.objects.create(
            doctor=self.doctor_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=today,
            appointment_time=datetime.time(10, 30),
            status='BOOKED',
        )
        self.client.post(f'/api/receptionist/appointments/{advance_appt2.id}/confirm_arrival/')
        self.client.post(f'/api/receptionist/appointments/{advance_appt2.id}/collect_fee/', {'payment_method': 'CASH'})
        resp_a2 = self.client.post(f'/api/receptionist/appointments/{advance_appt2.id}/issue_token/')
        self.assertEqual(resp_a2.data['token']['token_number'], 2)

        # 4. Second walk-in appointment
        walkin_appt2 = Appointment.objects.create(
            doctor=self.doctor_profile,
            patient=self.patient2,
            receptionist=self.receptionist_profile,
            appointment_type='WALK_IN',
            appointment_date=today,
            appointment_time=datetime.time(11, 0),
            status='CONFIRMED',
        )
        self.client.post(f'/api/receptionist/appointments/{walkin_appt2.id}/collect_fee/', {'payment_method': 'CASH'})
        resp_w2 = self.client.post(f'/api/receptionist/appointments/{walkin_appt2.id}/issue_token/')
        self.assertEqual(resp_w2.data['token']['token_number'], 102)

        # Check all token numbers are distinct
        all_tokens = list(Token.objects.filter(token_date=today).values_list('token_number', flat=True))
        self.assertEqual(len(all_tokens), len(set(all_tokens)))

    def test_receptionist_cannot_call_patient_or_complete_consultation(self):
        """
        Receptionist's responsibility ends at registration, arrival, payment, and token issuance.
        Receptionist cannot call patients or complete consultations (403 Forbidden).
        """
        today = self.frozen_now.date()
        appt = Appointment.objects.create(
            doctor=self.doctor_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='WALK_IN',
            appointment_date=today,
            appointment_time=datetime.time(11, 30),
            status='CONFIRMED',
        )
        self.client.post(f'/api/receptionist/appointments/{appt.id}/collect_fee/', {'payment_method': 'CASH'})
        resp_tok = self.client.post(f'/api/receptionist/appointments/{appt.id}/issue_token/')
        token_id = resp_tok.data['token']['id']

        # Receptionist attempts to call next -> 403 Forbidden
        call_resp = self.client.post(f'/api/receptionist/tokens/{token_id}/call_next/')
        self.assertEqual(call_resp.status_code, status.HTTP_403_FORBIDDEN)

        # Receptionist attempts to complete -> 403 Forbidden
        comp_resp = self.client.post(f'/api/receptionist/tokens/{token_id}/complete/')
        self.assertEqual(comp_resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_doctor_controlled_consultation_authorization_and_validation(self):
        """
        Only the authorized doctor assigned to the patient can call the patient (Start Consultation).
        Unauthorized doctors and unverified/unpaid states are rejected.
        """
        today = self.frozen_now.date()
        appt = Appointment.objects.create(
            doctor=self.doctor_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='WALK_IN',
            appointment_date=today,
            appointment_time=datetime.time(11, 45),
            status='CONFIRMED',
        )

        doc_auth_client = APIClient()
        doc_auth_client.force_authenticate(user=self.doctor_user)

        doc_unauth_client = APIClient()
        doc_unauth_client.force_authenticate(user=self.doctor2_user)

        # 1. Unpaid patient -> Doctor start_consultation rejected (400)
        resp_unpaid = doc_auth_client.post(f'/api/doctor/appointments/{appt.id}/start_consultation/')
        self.assertEqual(resp_unpaid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('fee must be paid', resp_unpaid.data['detail'])

        # Pay fee
        self.client.post(f'/api/receptionist/appointments/{appt.id}/collect_fee/', {'payment_method': 'CASH'})

        # 2. Paid but no token -> Doctor start_consultation rejected (400)
        resp_notoken = doc_auth_client.post(f'/api/doctor/appointments/{appt.id}/start_consultation/')
        self.assertEqual(resp_notoken.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('queue token is required', resp_notoken.data['detail'])

        # Issue token
        self.client.post(f'/api/receptionist/appointments/{appt.id}/issue_token/')

        # 3. Unauthorized doctor (doctor2) tries to start consultation -> 403 Forbidden
        resp_forbidden = doc_unauth_client.post(f'/api/doctor/appointments/{appt.id}/start_consultation/')
        self.assertEqual(resp_forbidden.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('not authorized', resp_forbidden.data['detail'])

        # 4. Authorized doctor starts consultation -> 200 OK, token becomes CALLED
        resp_ok = doc_auth_client.post(f'/api/doctor/appointments/{appt.id}/start_consultation/')
        self.assertEqual(resp_ok.status_code, status.HTTP_200_OK)
        appt.refresh_from_db()
        self.assertEqual(appt.token.status, 'CALLED')


class ReceptionistBillingAndReceiptTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        # Configure Clinic
        config = ClinicConfiguration.get_instance()
        config.clinic_name = "Sunrise Health Clinic"
        config.clinic_phone = "+91 98765 43210"
        config.clinic_address = "42 Wellness Boulevard, Chennai"
        config.registration_fee = Decimal('150.00')
        config.save()

        # Users and staff
        cls.recep_user = User.objects.create_user(
            username='recep_bill', email='recep_bill@example.com', password='Password@123', role='RECEPTIONIST'
        )
        cls.recep_profile = ReceptionistProfile.objects.create(
            user=cls.recep_user,
            employee_id='REC-BILL-01'
        )

        cls.doc_user = User.objects.create_user(
            username='doc_bill', email='doc_bill@example.com', password='Password@123', role='DOCTOR'
        )
        cls.doctor = DoctorProfile.objects.create(
            user=cls.doc_user,
            specialization='General Medicine',
            consultation_fee=Decimal('650.00')
        )

        cls.new_patient = Patient.objects.create(
            patient_id='P-TEST-99',
            first_name='John',
            last_name='Doe',
            date_of_birth='1990-05-15',
            gender='MALE',
            phone='9876543210',
            blood_group='O+',
        )

    def setUp(self):
        self.tz = ZoneInfo('Asia/Kolkata')
        self.frozen_now = datetime.datetime(2026, 10, 24, 10, 0, 0, tzinfo=self.tz)
        self.patcher = patch('apibackendapp.scheduling.now_local', return_value=self.frozen_now)
        self.patcher.start()

        self.client = APIClient()
        self.client.force_authenticate(user=self.recep_user)
        self.today = self.frozen_now.date()

    def tearDown(self):
        self.patcher.stop()

    def test_new_patient_combined_invoice_creation(self):
        """New patient booking generates combined invoice with registration fee + doctor consultation fee."""
        resp = self.client.post('/api/receptionist/appointments/', {
            'doctor': self.doctor.id,
            'patient': self.new_patient.id,
            'appointment_type': 'WALK_IN',
            'appointment_date': self.today.isoformat(),
            'appointment_time': '10:30:00',
            'reason': 'Routine checkup',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        appt_id = resp.data['id']

        invoice = ConsultationInvoice.objects.filter(appointment_id=appt_id).first()
        self.assertIsNotNone(invoice)
        self.assertEqual(invoice.registration_fee, Decimal('150.00'))
        self.assertEqual(invoice.consultation_fee, Decimal('650.00'))
        self.assertEqual(invoice.total_amount, Decimal('800.00'))
        self.assertEqual(invoice.status, 'PENDING')

    def test_existing_patient_charges_only_consultation_fee(self):
        """Existing patient with previously paid/invoiced registration fee is charged only consultation fee."""
        # Create initial appointment and invoice with registration fee
        appt1 = Appointment.objects.create(
            doctor=self.doctor,
            patient=self.new_patient,
            appointment_type='WALK_IN',
            appointment_date=self.today,
            appointment_time=datetime.time(10, 15),
            status='CONFIRMED',
        )
        from receptionist.views import get_or_create_consultation_invoice
        inv1, _ = get_or_create_consultation_invoice(appt1)
        self.assertEqual(inv1.registration_fee, Decimal('150.00'))
        self.assertEqual(inv1.total_amount, Decimal('800.00'))

        # Second appointment for the same patient
        resp2 = self.client.post('/api/receptionist/appointments/', {
            'doctor': self.doctor.id,
            'patient': self.new_patient.id,
            'appointment_type': 'ADVANCE',
            'appointment_date': (self.today + datetime.timedelta(days=2)).isoformat(),
            'appointment_time': '11:00:00',
            'reason': 'Follow up',
        })
        self.assertEqual(resp2.status_code, status.HTTP_201_CREATED)
        appt2_id = resp2.data['id']

        inv2 = ConsultationInvoice.objects.filter(appointment_id=appt2_id).first()
        self.assertIsNotNone(inv2)
        self.assertEqual(inv2.registration_fee, Decimal('0.00'))
        self.assertEqual(inv2.consultation_fee, Decimal('650.00'))
        self.assertEqual(inv2.total_amount, Decimal('650.00'))

    def test_partial_payment_blocks_token_until_fully_paid(self):
        """Partial payment transitions invoice to PARTIAL and blocks token issuance until balance is cleared."""
        appt = Appointment.objects.create(
            doctor=self.doctor,
            patient=self.new_patient,
            appointment_type='WALK_IN',
            appointment_date=self.today,
            appointment_time=datetime.time(10, 30),
            status='CONFIRMED',
        )
        from receptionist.views import get_or_create_consultation_invoice
        inv, _ = get_or_create_consultation_invoice(appt)
        self.assertEqual(inv.total_amount, Decimal('800.00'))

        # 1. Partial payment of 300
        pay_resp = self.client.post(f'/api/receptionist/appointments/{appt.id}/collect_fee/', {
            'amount': '300.00',
            'payment_method': 'CASH',
        })
        self.assertEqual(pay_resp.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.status, 'PARTIAL')

        # 2. Token issuance attempt while partially paid -> 400 Bad Request
        token_fail = self.client.post(f'/api/receptionist/appointments/{appt.id}/issue_token/')
        self.assertEqual(token_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('must be paid before issuing a token', token_fail.data['detail'])

        # 3. Pay remaining 500
        pay_resp2 = self.client.post(f'/api/receptionist/appointments/{appt.id}/collect_fee/', {
            'amount': '500.00',
            'payment_method': 'UPI',
            'transaction_id': 'UPI-TXN-123',
        })
        self.assertEqual(pay_resp2.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.status, 'PAID')

        # 4. Token issuance now succeeds (walk-in tokens start from 101)
        token_ok = self.client.post(f'/api/receptionist/appointments/{appt.id}/issue_token/')
        self.assertEqual(token_ok.status_code, status.HTTP_201_CREATED)
        self.assertEqual(token_ok.data['token']['token_number'], 101)

    def test_consultation_invoice_and_receipt_data(self):
        """Invoice detail endpoint returns itemized fees, balance due, payment list, and clinic info."""
        appt = Appointment.objects.create(
            doctor=self.doctor,
            patient=self.new_patient,
            appointment_type='WALK_IN',
            appointment_date=self.today,
            appointment_time=datetime.time(14, 0),
            status='CONFIRMED',
        )
        from receptionist.views import get_or_create_consultation_invoice
        inv, _ = get_or_create_consultation_invoice(appt)

        # Record payment
        ConsultationPayment.objects.create(
            invoice=inv,
            amount=Decimal('800.00'),
            payment_method='CARD',
            transaction_id='CARD-987',
        )
        inv.status = 'PAID'
        inv.save()

        resp = self.client.get(f'/api/receptionist/consultation-invoices/{inv.id}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.data

        self.assertIn('John Doe', data['patient_name'])
        self.assertEqual(data['doctor_name'], 'Dr. doc_bill')
        self.assertEqual(data['registration_fee'], '150.00')
        self.assertEqual(data['consultation_fee'], '650.00')
        self.assertEqual(data['total_amount'], '800.00')
        self.assertEqual(data['amount_paid'], '800.00')
        self.assertEqual(data['balance_due'], '0.00')
        self.assertEqual(data['status'], 'PAID')
        self.assertEqual(data['clinic_info']['clinic_name'], 'Sunrise Health Clinic')
        self.assertEqual(len(data['payments']), 1)
        self.assertEqual(data['payments'][0]['payment_method'], 'CARD')


class AppointmentBookingAndPaymentWorkflowTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        config = ClinicConfiguration.get_instance()
        config.clinic_name = "Sunrise Health Clinic"
        config.registration_fee = Decimal('100.00')
        config.save()

        cls.receptionist_user = User.objects.create_user(
            username='wf_recep',
            email='wf_recep@clinic.com',
            password='TestPassword123!',
            role='RECEPTIONIST',
        )
        cls.receptionist_profile = ReceptionistProfile.objects.create(
            user=cls.receptionist_user,
            employee_id='REC_WF_01',
            phone='9876500099',
        )

        cls.doctor_user = User.objects.create_user(
            username='wf_doc',
            email='wf_doc@clinic.com',
            password='TestPassword123!',
            role='DOCTOR',
            first_name='Alan',
            last_name='Grant',
        )
        cls.doctor_profile = DoctorProfile.objects.create(
            user=cls.doctor_user,
            doctor_id='DOC_WF_01',
            specialization='Cardiology',
            consultation_fee=Decimal('500.00'),
        )

        cls.new_patient = Patient.objects.create(
            patient_id='P-WF-001',
            first_name='Bob',
            last_name='Builder',
            date_of_birth='1985-04-12',
            gender='MALE',
            phone='9876543219',
        )

        cls.existing_patient = Patient.objects.create(
            patient_id='P-WF-002',
            first_name='Wendy',
            last_name='Darling',
            date_of_birth='1992-08-20',
            gender='FEMALE',
            phone='9876543218',
        )

    def setUp(self):
        self.tz = ZoneInfo('Asia/Kolkata')
        self.frozen_now = datetime.datetime(2026, 10, 24, 10, 0, 0, tzinfo=self.tz)
        self.patcher = patch('apibackendapp.scheduling.now_local', return_value=self.frozen_now)
        self.patcher.start()

        self.client = APIClient()
        self.client.force_authenticate(user=self.receptionist_user)

    def tearDown(self):
        self.patcher.stop()

    def test_walkin_booking_payment_and_auto_arrival(self):
        """Walk-in: booked in PENDING -> unpaid invoice -> payment via billing -> CONFIRMED -> token."""
        today = self.frozen_now.date()
        resp = self.client.post('/api/receptionist/appointments/', {
            'doctor': self.doctor_profile.id,
            'patient': self.new_patient.id,
            'appointment_type': 'WALK_IN',
            'appointment_date': today.isoformat(),
            'appointment_time': '10:30:00',
            'reason': 'Checkup',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        appt_id = resp.data['id']
        self.assertEqual(resp.data['status'], 'PENDING')
        self.assertIsNotNone(resp.data['invoice_id'])
        self.assertEqual(resp.data['invoice_status'], 'PENDING')
        # Combined invoice: 100 reg + 500 consultation = 600
        self.assertEqual(resp.data['consultation_fee'], '500.00')

        inv = ConsultationInvoice.objects.get(id=resp.data['invoice_id'])
        self.assertEqual(inv.total_amount, Decimal('600.00'))

        # Token blocked before payment
        tok_resp = self.client.post(f'/api/receptionist/appointments/{appt_id}/issue_token/')
        self.assertEqual(tok_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('must be paid before issuing a token', tok_resp.data['detail'])

        # Pay invoice via Billing
        pay_resp = self.client.post('/api/receptionist/consultation-payments/', {
            'invoice': inv.id,
            'amount': '600.00',
            'payment_method': 'UPI',
            'transaction_id': 'UPI-12345',
        })
        self.assertEqual(pay_resp.status_code, status.HTTP_201_CREATED)

        appt = Appointment.objects.get(id=appt_id)
        # Walk-in auto-arrives upon payment
        self.assertEqual(appt.status, 'CONFIRMED')

        # Token can now be issued
        tok_resp2 = self.client.post(f'/api/receptionist/appointments/{appt_id}/issue_token/')
        self.assertEqual(tok_resp2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(tok_resp2.data['token']['token_number'], 101)

    def test_advance_booking_invoice_payment_arrival_token_flow(self):
        """Advance: booked in PENDING -> payment -> BOOKED -> arrival on date -> CONFIRMED -> token."""
        tomorrow = self.frozen_now.date() + datetime.timedelta(days=1)
        resp = self.client.post('/api/receptionist/appointments/', {
            'doctor': self.doctor_profile.id,
            'patient': self.new_patient.id,
            'appointment_type': 'ADVANCE',
            'appointment_date': tomorrow.isoformat(),
            'appointment_time': '10:00:00',
            'reason': 'Follow-up',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        appt_id = resp.data['id']
        self.assertEqual(resp.data['status'], 'PENDING')

        inv_id = resp.data['invoice_id']
        inv = ConsultationInvoice.objects.get(id=inv_id)

        # Confirm arrival rejected while PENDING
        arr_rej = self.client.post(f'/api/receptionist/appointments/{appt_id}/confirm_arrival/')
        self.assertEqual(arr_rej.status_code, status.HTTP_400_BAD_REQUEST)

        # Pay via collect_fee or billing
        pay_resp = self.client.post(f'/api/receptionist/appointments/{appt_id}/collect_fee/', {
            'amount': str(inv.total_amount),
            'payment_method': 'CASH',
        })
        self.assertEqual(pay_resp.status_code, status.HTTP_200_OK)

        # Transitions to BOOKED (not CONFIRMED, because advance appointment requires arrival on visit date)
        appt = Appointment.objects.get(id=appt_id)
        self.assertEqual(appt.status, 'BOOKED')

        # Fast forward time to tomorrow
        self.patcher.stop()
        tomorrow_now = datetime.datetime(tomorrow.year, tomorrow.month, tomorrow.day, 10, 0, 0, tzinfo=self.tz)
        self.patcher = patch('apibackendapp.scheduling.now_local', return_value=tomorrow_now)
        self.patcher.start()

        # Token still blocked before arrival confirmation
        tok_rej = self.client.post(f'/api/receptionist/appointments/{appt_id}/issue_token/')
        self.assertEqual(tok_rej.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('arrival must be confirmed', tok_rej.data['detail'])

        # Explicit arrival confirmation on appointment day
        arr_ok = self.client.post(f'/api/receptionist/appointments/{appt_id}/confirm_arrival/')
        self.assertEqual(arr_ok.status_code, status.HTTP_200_OK)
        appt.refresh_from_db()
        self.assertEqual(appt.status, 'CONFIRMED')

        # Now token can be issued
        tok_ok = self.client.post(f'/api/receptionist/appointments/{appt_id}/issue_token/')
        self.assertEqual(tok_ok.status_code, status.HTTP_201_CREATED)
        self.assertEqual(tok_ok.data['token']['token_number'], 1)

    def test_existing_patient_not_charged_registration_fee_again(self):
        """Existing patient with previously paid invoice should only be charged consultation fee."""
        today = self.frozen_now.date()
        # Create an existing completed appointment and paid invoice for existing_patient
        past_appt = Appointment.objects.create(
            doctor=self.doctor_profile,
            patient=self.existing_patient,
            appointment_type='WALK_IN',
            appointment_date=today - datetime.timedelta(days=5),
            appointment_time=datetime.time(9, 30),
            status='COMPLETED',
        )
        past_inv = ConsultationInvoice.objects.create(
            appointment=past_appt,
            patient=self.existing_patient,
            registration_fee=Decimal('100.00'),
            consultation_fee=Decimal('500.00'),
            total_amount=Decimal('600.00'),
            status='PAID',
        )

        # Book new appointment for existing_patient
        resp = self.client.post('/api/receptionist/appointments/', {
            'doctor': self.doctor_profile.id,
            'patient': self.existing_patient.id,
            'appointment_type': 'WALK_IN',
            'appointment_date': today.isoformat(),
            'appointment_time': '11:00:00',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        new_inv = ConsultationInvoice.objects.get(id=resp.data['invoice_id'])
        self.assertEqual(new_inv.registration_fee, Decimal('0.00'))
        self.assertEqual(new_inv.consultation_fee, Decimal('500.00'))
        self.assertEqual(new_inv.total_amount, Decimal('500.00'))

    def test_partial_payment_does_not_advance_status(self):
        """Partial payment marks invoice PARTIAL but keeps appointment in PENDING status."""
        today = self.frozen_now.date()
        resp = self.client.post('/api/receptionist/appointments/', {
            'doctor': self.doctor_profile.id,
            'patient': self.new_patient.id,
            'appointment_type': 'WALK_IN',
            'appointment_date': today.isoformat(),
            'appointment_time': '11:15:00',
        })
        appt_id = resp.data['id']
        inv_id = resp.data['invoice_id']

        # Pay only 200 of 600
        pay_resp = self.client.post(f'/api/receptionist/appointments/{appt_id}/collect_fee/', {
            'amount': '200.00',
            'payment_method': 'CASH',
        })
        self.assertEqual(pay_resp.status_code, status.HTTP_200_OK)

        appt = Appointment.objects.get(id=appt_id)
        self.assertEqual(appt.status, 'PENDING')
        inv = ConsultationInvoice.objects.get(id=inv_id)
        self.assertEqual(inv.status, 'PARTIAL')

        # Token still blocked
        tok_resp = self.client.post(f'/api/receptionist/appointments/{appt_id}/issue_token/')
        self.assertEqual(tok_resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancellation_cancels_unpaid_invoice(self):
        """Cancelling appointment also cancels any unpaid/pending invoice."""
        today = self.frozen_now.date()
        resp = self.client.post('/api/receptionist/appointments/', {
            'doctor': self.doctor_profile.id,
            'patient': self.new_patient.id,
            'appointment_type': 'WALK_IN',
            'appointment_date': today.isoformat(),
            'appointment_time': '11:30:00',
        })
        appt_id = resp.data['id']
        inv_id = resp.data['invoice_id']

        cancel_resp = self.client.post(f'/api/receptionist/appointments/{appt_id}/cancel/')
        self.assertEqual(cancel_resp.status_code, status.HTTP_200_OK)

        appt = Appointment.objects.get(id=appt_id)
        self.assertEqual(appt.status, 'CANCELLED')
        inv = ConsultationInvoice.objects.get(id=inv_id)
        self.assertEqual(inv.status, 'CANCELLED')

    def test_duplicate_booking_rejection(self):
        """Duplicate booking for the same slot is rejected."""
        today = self.frozen_now.date()
        resp1 = self.client.post('/api/receptionist/appointments/', {
            'doctor': self.doctor_profile.id,
            'patient': self.new_patient.id,
            'appointment_type': 'WALK_IN',
            'appointment_date': today.isoformat(),
            'appointment_time': '11:45:00',
        })
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)

        resp2 = self.client.post('/api/receptionist/appointments/', {
            'doctor': self.doctor_profile.id,
            'patient': self.existing_patient.id,
            'appointment_type': 'WALK_IN',
            'appointment_date': today.isoformat(),
            'appointment_time': '11:45:00',
        })
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already booked', str(resp2.data))



