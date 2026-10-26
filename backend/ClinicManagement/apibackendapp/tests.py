import datetime
import threading
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.db import connection, transaction
from django.test import TransactionTestCase
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apibackendapp.models import (
    User,
    DoctorProfile,
    ReceptionistProfile,
    PharmacistProfile,
    Patient,
    Appointment,
    Consultation,
    Prescription,
)


class ClinicAppointmentApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        # 1. Receptionist User & Profile
        cls.receptionist_user = User.objects.create_user(
            username='receptionist1',
            email='receptionist1@clinic.com',
            password='Password123!',
            role='RECEPTIONIST',
        )
        cls.receptionist_profile = ReceptionistProfile.objects.create(
            user=cls.receptionist_user,
            employee_id='REC001',
            phone='9876543210',
        )

        # 2. Doctor 1 User & Profile
        cls.doctor1_user = User.objects.create_user(
            username='doctor1',
            email='doctor1@clinic.com',
            password='Password123!',
            role='DOCTOR',
            first_name='Alice',
            last_name='Smith',
        )
        cls.doctor1_profile = DoctorProfile.objects.create(
            user=cls.doctor1_user,
            doctor_id='DOC001',
            specialization='Cardiology',
            qualification='MBBS, MD',
            registration_number='REG1001',
            consultation_fee=500.00,
            available_from=datetime.time(9, 0),
            available_to=datetime.time(17, 0),
            available_days=['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
            slot_minutes=15,
        )

        # 3. Doctor 2 User & Profile
        cls.doctor2_user = User.objects.create_user(
            username='doctor2',
            email='doctor2@clinic.com',
            password='Password123!',
            role='DOCTOR',
            first_name='Bob',
            last_name='Jones',
        )
        cls.doctor2_profile = DoctorProfile.objects.create(
            user=cls.doctor2_user,
            doctor_id='DOC002',
            specialization='Dermatology',
            qualification='MBBS, DVD',
            registration_number='REG1002',
            consultation_fee=400.00,
            available_from=datetime.time(9, 0),
            available_to=datetime.time(17, 0),
            available_days=['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
            slot_minutes=15,
        )

        # 4. Pharmacist User & Profile
        cls.pharmacist_user = User.objects.create_user(
            username='pharmacist1',
            email='pharmacist1@clinic.com',
            password='Password123!',
            role='PHARMACIST',
        )
        cls.pharmacist_profile = PharmacistProfile.objects.create(
            user=cls.pharmacist_user,
            employee_id='PHARM001',
            qualification='B.Pharm',
            phone='9876543212',
        )

        # 5. Admin User
        cls.admin_user = User.objects.create_user(
            username='admin1',
            email='admin1@clinic.com',
            password='Password123!',
            role='ADMIN',
        )

        # 6. Patients
        cls.patient1 = Patient.objects.create(
            patient_id='PAT0001',
            first_name='John',
            last_name='Doe',
            gender='MALE',
            phone='9111111111',
            emergency_contact_name='Jane Doe',
            emergency_contact_phone='9111111112',
        )
        cls.patient2 = Patient.objects.create(
            patient_id='PAT0002',
            first_name='Jane',
            last_name='Roe',
            gender='FEMALE',
            phone='9222222222',
            emergency_contact_name='John Roe',
            emergency_contact_phone='9222222223',
        )
        cls.patient3 = Patient.objects.create(
            patient_id='PAT0003',
            first_name='Charlie',
            last_name='Brown',
            gender='MALE',
            phone='9333333333',
            emergency_contact_name='Sally Brown',
            emergency_contact_phone='9333333334',
        )

    def setUp(self):
        # Freeze clock at 2026-10-23 10:00:00 IST
        self.tz = ZoneInfo('Asia/Kolkata')
        self.frozen_now = datetime.datetime(2026, 10, 23, 10, 0, 0, tzinfo=self.tz)
        self.patcher = patch('apibackendapp.scheduling.now_local', return_value=self.frozen_now)
        self.mock_now = self.patcher.start()

    def tearDown(self):
        self.patcher.stop()

    # ------------------------------------------------------------------------
    # 1. Walk-in tests
    # ------------------------------------------------------------------------
    def test_walk_in_today_ok(self):
        """Walk-in for today with a valid future slot succeeds."""
        self.client.force_authenticate(user=self.receptionist_user)
        url = '/api/receptionist/appointments/'
        payload = {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'WALK_IN',
            'visit_category': 'General',
            'appointment_date': '2026-10-23',
            'appointment_time': '10:30:00',
            'reason': 'Headache',
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['appointment_type'], 'WALK_IN')
        self.assertEqual(response.data['visit_category'], 'General')
        self.assertEqual(response.data['appointment_date'], '2026-10-23')
        self.assertEqual(response.data['appointment_time'], '10:30:00')

    def test_walk_in_tomorrow_rejected(self):
        """Walk-in appointment cannot be booked for tomorrow."""
        self.client.force_authenticate(user=self.receptionist_user)
        url = '/api/receptionist/appointments/'
        payload = {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'WALK_IN',
            'appointment_date': '2026-10-24',  # tomorrow
            'appointment_time': '10:30:00',
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_walk_in_past_slot_rejected(self):
        """Walk-in slot that has already ended must be rejected."""
        self.client.force_authenticate(user=self.receptionist_user)
        url = '/api/receptionist/appointments/'
        # Clock is frozen at 10:00:00; 09:00 slot ended at 09:15:00
        payload = {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'WALK_IN',
            'appointment_date': '2026-10-23',
            'appointment_time': '09:00:00',
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------------
    # 2. Advance booking tests
    # ------------------------------------------------------------------------
    def test_advance_tomorrow_and_day_7_ok(self):
        """Advance booking for day 1 (tomorrow) and day 7 (max) both succeed."""
        self.client.force_authenticate(user=self.receptionist_user)
        url = '/api/receptionist/appointments/'

        # Day 1: 2026-10-24
        res1 = self.client.post(url, {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'ADVANCE',
            'visit_category': 'Follow-up',
            'appointment_date': '2026-10-24',
            'appointment_time': '11:00:00',
        })
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res1.data['appointment_type'], 'ADVANCE')
        self.assertEqual(res1.data['visit_category'], 'Follow-up')

        # Day 7: 2026-10-30
        res7 = self.client.post(url, {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient2.id,
            'appointment_type': 'ADVANCE',
            'appointment_date': '2026-10-30',
            'appointment_time': '11:00:00',
        })
        self.assertEqual(res7.status_code, status.HTTP_201_CREATED)

    def test_advance_day_8_rejected(self):
        """Advance booking beyond 7 days (day 8: 2026-10-31) is rejected."""
        self.client.force_authenticate(user=self.receptionist_user)
        url = '/api/receptionist/appointments/'
        response = self.client.post(url, {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'ADVANCE',
            'appointment_date': '2026-10-31',
            'appointment_time': '11:00:00',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_advance_for_today_rejected(self):
        """ADVANCE appointment type cannot be used for today."""
        self.client.force_authenticate(user=self.receptionist_user)
        url = '/api/receptionist/appointments/'
        response = self.client.post(url, {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'ADVANCE',
            'appointment_date': '2026-10-23',  # today
            'appointment_time': '14:00:00',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_past_date_rejected(self):
        """Appointments cannot be booked for past dates."""
        self.client.force_authenticate(user=self.receptionist_user)
        url = '/api/receptionist/appointments/'
        response = self.client.post(url, {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'ADVANCE',
            'appointment_date': '2026-10-22',  # yesterday
            'appointment_time': '11:00:00',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_slot_time_rejected(self):
        """Times that do not match doctor's generated slot grid are rejected."""
        self.client.force_authenticate(user=self.receptionist_user)
        url = '/api/receptionist/appointments/'
        response = self.client.post(url, {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'ADVANCE',
            'appointment_date': '2026-10-24',
            'appointment_time': '10:07:00',  # not a 15-min boundary
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unavailable_weekday_has_no_slots_and_rejects_booking(self):
        from apibackendapp.scheduling import (
            SchedulingValidationError,
            get_doctor_slots_availability,
            validate_appointment_booking,
        )

        self.doctor1_profile.available_days = ['MON', 'TUE', 'WED', 'THU', 'FRI']
        self.doctor1_profile.save(update_fields=['available_days'])
        sunday = datetime.date(2026, 10, 25)
        current_time = datetime.datetime(
            2026, 10, 23, 8, 0, tzinfo=ZoneInfo('Asia/Kolkata')
        )

        with patch('apibackendapp.scheduling.now_local', return_value=current_time):
            self.assertEqual(
                get_doctor_slots_availability(
                    self.doctor1_profile, 'ADVANCE', sunday
                ),
                [],
            )
            with self.assertRaises(SchedulingValidationError):
                validate_appointment_booking(
                    self.doctor1_profile,
                    self.patient1,
                    'ADVANCE',
                    sunday,
                    datetime.time(9, 0),
                )

    def test_double_booking_rejected_and_cancelled_slot_freed(self):
        """Double booking doctor or patient is rejected; cancelled appointment frees slot."""
        self.client.force_authenticate(user=self.receptionist_user)
        url = '/api/receptionist/appointments/'

        # Initial booking
        res1 = self.client.post(url, {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'ADVANCE',
            'appointment_date': '2026-10-24',
            'appointment_time': '10:15:00',
        })
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        appt_id = res1.data['id']

        # 1. Same doctor, same date/time, different patient -> REJECTED
        res2 = self.client.post(url, {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient2.id,
            'appointment_type': 'ADVANCE',
            'appointment_date': '2026-10-24',
            'appointment_time': '10:15:00',
        })
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Different doctor, same date/time, same patient -> REJECTED
        res3 = self.client.post(url, {
            'doctor': self.doctor2_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'ADVANCE',
            'appointment_date': '2026-10-24',
            'appointment_time': '10:15:00',
        })
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Cancel the first appointment
        res_cancel = self.client.post(f'/api/receptionist/appointments/{appt_id}/cancel/')
        self.assertEqual(res_cancel.status_code, status.HTTP_200_OK)
        self.assertEqual(res_cancel.data['status'], 'CANCELLED')

        # 4. Same slot is now free -> SUCCESS
        res4 = self.client.post(url, {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient2.id,
            'appointment_type': 'ADVANCE',
            'appointment_date': '2026-10-24',
            'appointment_time': '10:15:00',
        })
        self.assertEqual(res4.status_code, status.HTTP_201_CREATED)

    # ------------------------------------------------------------------------
    # 3. Status Transitions
    # ------------------------------------------------------------------------
    def test_status_transitions_valid_and_invalid(self):
        """Verify strict status transitions for receptionist, doctor, and admin."""
        self.client.force_authenticate(user=self.receptionist_user)

        # Create appointment (starts in BOOKED status)
        appt = Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(10, 0),
            status='BOOKED',
        )

        # Check-in: BOOKED -> CONFIRMED (OK)
        res_checkin = self.client.post(f'/api/receptionist/appointments/{appt.id}/check_in/')
        self.assertEqual(res_checkin.status_code, status.HTTP_200_OK)
        self.assertEqual(res_checkin.data['appointment']['status'], 'CONFIRMED')

        # Doctor completes CONFIRMED -> COMPLETED (OK)
        self.client.force_authenticate(user=self.doctor1_user)
        res_complete = self.client.post(f'/api/doctor/appointments/{appt.id}/complete/')
        self.assertEqual(res_complete.status_code, status.HTTP_200_OK)
        self.assertEqual(res_complete.data['status'], 'COMPLETED')

        # Cancelling a COMPLETED appointment must be REJECTED
        self.client.force_authenticate(user=self.receptionist_user)
        res_cancel_completed = self.client.post(f'/api/receptionist/appointments/{appt.id}/cancel/')
        self.assertEqual(res_cancel_completed.status_code, status.HTTP_400_BAD_REQUEST)

        # Doctor trying to complete a BOOKED appointment must be REJECTED
        appt2 = Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient2,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(10, 30),
            status='BOOKED',
        )
        self.client.force_authenticate(user=self.doctor1_user)
        res_invalid_complete = self.client.post(f'/api/doctor/appointments/{appt2.id}/complete/')
        self.assertEqual(res_invalid_complete.status_code, status.HTTP_400_BAD_REQUEST)

        # Receptionist cancelling CONFIRMED appointment succeeds
        self.client.force_authenticate(user=self.receptionist_user)
        res_ci = self.client.post(f'/api/receptionist/appointments/{appt2.id}/check_in/')
        self.assertEqual(res_ci.status_code, status.HTTP_200_OK)
        res_cancel_conf = self.client.post(f'/api/receptionist/appointments/{appt2.id}/cancel/')
        self.assertEqual(res_cancel_conf.status_code, status.HTTP_200_OK)
        self.assertEqual(res_cancel_conf.data['status'], 'CANCELLED')

    # ------------------------------------------------------------------------
    # 4. Slots endpoint
    # ------------------------------------------------------------------------
    def test_doctor_slots_endpoint(self):
        """GET /api/receptionist/doctors/<id>/slots/ returns generated slots with availability."""
        Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(10, 0),
            status='BOOKED',
        )

        self.client.force_authenticate(user=self.receptionist_user)

        # 1. ADVANCE slots for tomorrow (2026-10-24)
        url = f'/api/receptionist/doctors/{self.doctor1_profile.id}/slots/?type=ADVANCE&date=2026-10-24'
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        slots_by_time = {s['time']: s['available'] for s in res.data}
        self.assertIn('10:00', slots_by_time)
        self.assertFalse(slots_by_time['10:00'])  # booked -> unavailable
        self.assertTrue(slots_by_time['10:15'])   # free -> available

        # 2. WALK_IN slots for today (2026-10-23): 09:00 slot has passed (unavailable), 10:30 is available
        url_walkin = f'/api/receptionist/doctors/{self.doctor1_profile.id}/slots/?type=WALK_IN&date=2026-10-23'
        res_walkin = self.client.get(url_walkin)
        self.assertEqual(res_walkin.status_code, status.HTTP_200_OK)
        walkin_slots = {s['time']: s['available'] for s in res_walkin.data}
        self.assertFalse(walkin_slots['09:00'])  # passed
        self.assertTrue(walkin_slots['10:30'])   # future

        # 3. Invalid date window returns 400
        url_bad_date = f'/api/receptionist/doctors/{self.doctor1_profile.id}/slots/?type=ADVANCE&date=2026-10-31'
        res_bad = self.client.get(url_bad_date)
        self.assertEqual(res_bad.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------------
    # 5. Role permissions & Security
    # ------------------------------------------------------------------------
    def test_doctor_and_pharmacist_get_403_on_receptionist_endpoints(self):
        """Non-receptionist roles receive 403 on /api/receptionist/ endpoints."""
        url = '/api/receptionist/patients/'

        self.client.force_authenticate(user=self.doctor1_user)
        res_doc = self.client.get(url)
        self.assertEqual(res_doc.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.pharmacist_user)
        res_pharm = self.client.get(url)
        self.assertEqual(res_pharm.status_code, status.HTTP_403_FORBIDDEN)

    def test_receptionist_gets_403_on_doctor_endpoints(self):
        """Receptionist receives 403 on /api/doctor/ endpoints."""
        self.client.force_authenticate(user=self.receptionist_user)
        res = self.client.get('/api/doctor/appointments/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_doctor_cannot_create_or_edit_appointments(self):
        """Doctor cannot create, edit, or delete appointments."""
        self.client.force_authenticate(user=self.doctor1_user)

        # POST not allowed
        res_create = self.client.post('/api/doctor/appointments/', {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient1.id,
            'appointment_date': '2026-10-24',
            'appointment_time': '10:00:00',
        })
        self.assertEqual(res_create.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # Existing appointment
        appt = Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(10, 0),
            status='BOOKED',
        )

        # PUT not allowed
        res_put = self.client.put(f'/api/doctor/appointments/{appt.id}/', {
            'reason': 'Updated reason',
        })
        self.assertEqual(res_put.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # DELETE not allowed
        res_del = self.client.delete(f'/api/doctor/appointments/{appt.id}/')
        self.assertEqual(res_del.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_doctor_sees_only_own_patients_and_other_doctor_patient_is_404(self):
        """Doctor sees only patients with active appointments with that doctor. Others are 404."""
        Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(10, 0),
            status='BOOKED',
        )

        self.client.force_authenticate(user=self.doctor1_user)
        res_list = self.client.get('/api/doctor/patients/')
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        returned_ids = [p['id'] for p in res_list.data]
        self.assertIn(self.patient1.id, returned_ids)
        self.assertNotIn(self.patient2.id, returned_ids)

        res_p1 = self.client.get(f'/api/doctor/patients/{self.patient1.id}/')
        self.assertEqual(res_p1.status_code, status.HTTP_200_OK)

        res_p2 = self.client.get(f'/api/doctor/patients/{self.patient2.id}/')
        self.assertEqual(res_p2.status_code, status.HTTP_404_NOT_FOUND)

    def test_shared_patient_shows_only_own_visits_to_doctor(self):
        """A doctor viewing a shared patient only sees their own appointments."""
        appt1 = Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(10, 0),
            status='BOOKED',
        )
        appt2 = Appointment.objects.create(
            doctor=self.doctor2_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(11, 0),
            status='BOOKED',
        )

        self.client.force_authenticate(user=self.doctor1_user)
        res = self.client.get(f'/api/doctor/patients/{self.patient1.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        nested_appts = res.data.get('appointments', [])
        appt_ids = [a['id'] for a in nested_appts]
        self.assertIn(appt1.id, appt_ids)
        self.assertNotIn(appt2.id, appt_ids)

    def test_cancelled_appointment_removes_access(self):
        """Cancelling the only appointment removes the patient from doctor's list (now 404)."""
        appt = Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient3,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(10, 0),
            status='BOOKED',
        )

        self.client.force_authenticate(user=self.doctor1_user)
        self.assertEqual(self.client.get(f'/api/doctor/patients/{self.patient3.id}/').status_code, status.HTTP_200_OK)

        appt.status = 'CANCELLED'
        appt.save(update_fields=['status'])

        self.assertEqual(self.client.get(f'/api/doctor/patients/{self.patient3.id}/').status_code, status.HTTP_404_NOT_FOUND)

    def test_doctor_cannot_write_consultation_for_another_doctor_patient(self):
        """Doctor cannot create consultation for another doctor's patient or a cancelled appointment."""
        appt_doc2 = Appointment.objects.create(
            doctor=self.doctor2_profile,
            patient=self.patient2,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(10, 0),
            status='CONFIRMED',
        )

        self.client.force_authenticate(user=self.doctor1_user)
        res = self.client.post('/api/doctor/consultations/', {
            'appointment': appt_doc2.id,
            'patient': self.patient2.id,
            'symptoms': 'Fever',
            'diagnosis': 'Viral',
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        cancelled_appt_doc1 = Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(10, 0),
            status='CANCELLED',
        )
        res2 = self.client.post('/api/doctor/consultations/', {
            'appointment': cancelled_appt_doc1.id,
            'patient': self.patient1.id,
            'symptoms': 'Cough',
            'diagnosis': 'Bronchitis',
        })
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------------
    # 6. Auth / Signup / Logout
    # ------------------------------------------------------------------------
    def test_public_signup_rejected_and_admin_signup_allowed(self):
        """Public signup returns 401/403. Only an Admin can call POST /api/auth/signup/."""
        # Unauthenticated request -> rejected
        res_public = self.client.post('/api/auth/signup/', {
            'username': 'publicuser',
            'password': 'Password123!',
            'role': 'ADMIN',
        })
        self.assertIn(res_public.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

        # Admin request -> succeeds
        self.client.force_authenticate(user=self.admin_user)
        res_admin = self.client.post('/api/auth/signup/', {
            'username': 'newstaffuser',
            'password': 'Password123!',
            'role': 'RECEPTIONIST',
        })
        self.assertEqual(res_admin.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='newstaffuser').exists())

    def test_blank_emails_do_not_crash(self):
        """Multiple users created with blank email must not trigger MySQL unique constraint IntegrityError."""
        self.client.force_authenticate(user=self.admin_user)

        res1 = self.client.post('/api/admin/users/', {
            'username': 'blank_email_user_1',
            'password': 'Password123!',
            'email': '',
            'role': 'RECEPTIONIST',
        })
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        res2 = self.client.post('/api/admin/users/', {
            'username': 'blank_email_user_2',
            'password': 'Password123!',
            'email': '',
            'role': 'RECEPTIONIST',
        })
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)

        u1 = User.objects.get(username='blank_email_user_1')
        u2 = User.objects.get(username='blank_email_user_2')
        self.assertIsNone(u1.email)
        self.assertIsNone(u2.email)

    def test_login_and_logout_blacklist(self):
        """Login obtains JWT tokens; logout blacklists refresh token."""
        # Login
        res_login = self.client.post('/api/auth/login/', {
            'username': 'doctor1',
            'password': 'Password123!',
        })
        self.assertEqual(res_login.status_code, status.HTTP_200_OK)
        access_token = res_login.data['access']
        refresh_token = res_login.data['refresh']
        self.assertIsNotNone(access_token)
        self.assertIsNotNone(refresh_token)

        # Logout with refresh token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        res_logout = self.client.post('/api/auth/logout/', {
            'refresh': refresh_token,
        })
        self.assertEqual(res_logout.status_code, status.HTTP_205_RESET_CONTENT)

        # Try to use blacklisted refresh token to refresh
        res_refresh = self.client.post('/api/auth/token/refresh/', {
            'refresh': refresh_token,
        })
        self.assertEqual(res_refresh.status_code, status.HTTP_401_UNAUTHORIZED)


    # ------------------------------------------------------------------------
    # 7. Token-Based vs Unscheduled (Tokenless) Consultation Workflows
    # ------------------------------------------------------------------------
    def test_token_based_consultation_with_valid_token_succeeds(self):
        """Workflow A: Consultation with an appointment having an active token succeeds."""
        from apibackendapp.models import Token
        appt = Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(10, 0),
            status='CONFIRMED',
        )
        token = Token.objects.create(
            appointment=appt,
            token_number=1,
            token_date=datetime.date(2026, 10, 24),
            status='WAITING'
        )

        self.client.force_authenticate(user=self.doctor1_user)
        res = self.client.post('/api/doctor/consultations/', {
            'appointment': appt.id,
            'patient': self.patient1.id,
            'visit_type': 'TOKEN_BASED',
            'symptoms': 'Headache and fatigue',
            'diagnosis': 'Tension headache',
            'clinical_notes': 'Vitals normal',
            'treatment_plan': 'Rest and hydration'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['visit_type'], 'TOKEN_BASED')
        self.assertEqual(res.data['token_number'], 1)
        self.assertEqual(res.data['appointment'], appt.id)

    def test_token_based_consultation_without_token_rejected(self):
        """Workflow A: Consultation with appointment that has no queue token is rejected."""
        appt = Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(10, 0),
            status='CONFIRMED',
        )
        self.client.force_authenticate(user=self.doctor1_user)
        res = self.client.post('/api/doctor/consultations/', {
            'appointment': appt.id,
            'patient': self.patient1.id,
            'visit_type': 'TOKEN_BASED',
            'symptoms': 'Fever',
            'diagnosis': 'Viral',
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('token', str(res.data))

    def test_token_based_consultation_with_cancelled_token_rejected(self):
        """Workflow A: Consultation with cancelled token is rejected."""
        from apibackendapp.models import Token
        appt = Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(10, 0),
            status='CONFIRMED',
        )
        Token.objects.create(
            appointment=appt,
            token_number=2,
            token_date=datetime.date(2026, 10, 24),
            status='CANCELLED'
        )
        self.client.force_authenticate(user=self.doctor1_user)
        res = self.client.post('/api/doctor/consultations/', {
            'appointment': appt.id,
            'patient': self.patient1.id,
            'visit_type': 'TOKEN_BASED',
            'symptoms': 'Fever',
            'diagnosis': 'Viral',
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unscheduled_consultation_start_and_billing_succeeds(self):
        """Workflow B: An authorized doctor can start unscheduled consultation without token."""
        self.client.force_authenticate(user=self.doctor1_user)
        res = self.client.post('/api/doctor/consultations/start_unscheduled/', {
            'patient': self.patient2.id,
            'visit_reason': 'Emergency walk-in chest discomfort'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['visit_type'], 'UNSCHEDULED')
        self.assertIsNone(res.data['appointment'])
        self.assertIsNone(res.data['token_number'])
        self.assertEqual(res.data['status'], 'IN_PROGRESS')
        self.assertEqual(res.data['visit_reason'], 'Emergency walk-in chest discomfort')

        # Verify pending ConsultationInvoice created automatically
        from apibackendapp.models import ConsultationInvoice
        consult_id = res.data['id']
        inv = ConsultationInvoice.objects.filter(consultation_id=consult_id).first()
        self.assertIsNotNone(inv)
        self.assertEqual(inv.status, 'PENDING')
        self.assertEqual(inv.consultation_fee, self.doctor1_profile.consultation_fee)

        # Doctor completes consultation record
        patch_res = self.client.patch(f'/api/doctor/consultations/{consult_id}/', {
            'symptoms': 'Chest discomfort and shortness of breath',
            'diagnosis': 'Costochondritis',
            'status': 'COMPLETED'
        })
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data['status'], 'COMPLETED')

    def test_unscheduled_consultation_duplicate_active_prevented(self):
        """Workflow B: Duplicate IN_PROGRESS unscheduled consultation for same patient today is prevented."""
        self.client.force_authenticate(user=self.doctor1_user)
        res1 = self.client.post('/api/doctor/consultations/start_unscheduled/', {
            'patient': self.patient3.id,
            'visit_reason': 'Walk-in visit'
        })
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Calling start_unscheduled again returns the existing in-progress consultation without creating duplicate
        res2 = self.client.post('/api/doctor/consultations/start_unscheduled/', {
            'patient': self.patient3.id,
            'visit_reason': 'Walk-in visit 2'
        })
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['id'], res1.data['id'])

    def test_unauthenticated_user_cannot_start_consultation(self):
        """Security: Unauthenticated user is rejected with 401."""
        self.client.logout()
        res = self.client.post('/api/doctor/consultations/start_unscheduled/', {
            'patient': self.patient1.id,
        })
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_doctor_cannot_use_doctor_consultation_workflow(self):
        """Security: Non-doctor (e.g. receptionist) is rejected with 403."""
        self.client.force_authenticate(user=self.receptionist_user)
        res = self.client.post('/api/doctor/consultations/start_unscheduled/', {
            'patient': self.patient1.id,
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_both_consultation_types_appear_in_patient_history(self):
        """Both token-based and unscheduled consultations appear in patient's consultation history."""
        from apibackendapp.models import Token, Consultation
        # 1. Token-based consultation
        appt = Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='ADVANCE',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(10, 0),
            status='CONFIRMED',
        )
        Token.objects.create(
            appointment=appt,
            token_number=10,
            token_date=datetime.date(2026, 10, 24),
            status='COMPLETED'
        )
        c1 = Consultation.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient1,
            appointment=appt,
            visit_type='TOKEN_BASED',
            status='COMPLETED',
            diagnosis='Routine checkup'
        )

        # 2. Unscheduled consultation
        c2 = Consultation.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient1,
            appointment=None,
            visit_type='UNSCHEDULED',
            status='COMPLETED',
            visit_reason='Walk-in rash',
            diagnosis='Allergic dermatitis'
        )

        self.client.force_authenticate(user=self.doctor1_user)
        res = self.client.get(f'/api/doctor/consultations/?patient={self.patient1.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        returned_ids = [c['id'] for c in res.data]
        self.assertIn(c1.id, returned_ids)
        self.assertIn(c2.id, returned_ids)

        # Verify visit types in response
        consult_map = {c['id']: c for c in res.data}
        self.assertEqual(consult_map[c1.id]['visit_type'], 'TOKEN_BASED')
        self.assertEqual(consult_map[c2.id]['visit_type'], 'UNSCHEDULED')


# ----------------------------------------------------------------------------
# 8. Concurrency Test (InnoDB Locking Verification)
# ----------------------------------------------------------------------------
class BookingConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.receptionist_user = User.objects.create_user(
            username='rec_concurrent',
            email='rec_c@clinic.com',
            password='Password123!',
            role='RECEPTIONIST',
        )
        self.receptionist_profile = ReceptionistProfile.objects.create(
            user=self.receptionist_user,
            employee_id='REC_CONC_001',
            phone='9876543210',
        )

        self.doctor_user = User.objects.create_user(
            username='doc_concurrent',
            email='doc_c@clinic.com',
            password='Password123!',
            role='DOCTOR',
        )
        self.doctor_profile = DoctorProfile.objects.create(
            user=self.doctor_user,
            doctor_id='DOC_CONC_001',
            specialization='General',
            qualification='MBBS',
            registration_number='REG-001',
            consultation_fee=500.00,
            available_from=datetime.time(9, 0),
            available_to=datetime.time(17, 0),
            available_days=['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
            slot_minutes=15,
        )

        self.patient1 = Patient.objects.create(
            patient_id='PAT_C_001',
            first_name='Patient',
            last_name='One',
            gender='MALE',
            phone='9000000001',
            emergency_contact_name='Contact One',
            emergency_contact_phone='9000000002',
        )
        self.patient2 = Patient.objects.create(
            patient_id='PAT_C_002',
            first_name='Patient',
            last_name='Two',
            gender='FEMALE',
            phone='9000000003',
            emergency_contact_name='Contact Two',
            emergency_contact_phone='9000000004',
        )

        # Freeze time for advance booking window
        self.tz = ZoneInfo('Asia/Kolkata')
        self.frozen_now = datetime.datetime(2026, 10, 23, 10, 0, 0, tzinfo=self.tz)
        self.patcher = patch('apibackendapp.scheduling.now_local', return_value=self.frozen_now)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()

    def test_concurrent_booking_same_slot_exactly_one_succeeds(self):
        """
        Two simultaneous threads attempting to book the exact same doctor/date/time.
        Due to select_for_update locking on the DoctorProfile row in InnoDB,
        exactly one must succeed (201) and the other must fail with validation error (400).
        """
        results = []
        target_date = '2026-10-25'
        target_time = '11:00:00'

        def book_slot(patient_id):
            client = APIClient()
            client.force_authenticate(user=self.receptionist_user)
            try:
                resp = client.post('/api/receptionist/appointments/', {
                    'doctor': self.doctor_profile.id,
                    'patient': patient_id,
                    'appointment_type': 'ADVANCE',
                    'appointment_date': target_date,
                    'appointment_time': target_time,
                    'reason': 'Concurrent booking test',
                })
                results.append(resp.status_code)
            finally:
                connection.close()

        t1 = threading.Thread(target=book_slot, args=(self.patient1.id,))
        t2 = threading.Thread(target=book_slot, args=(self.patient2.id,))

        t1.start()
        t2.start()
        t1.join()
        t2.join()

        self.assertEqual(len(results), 2)
        self.assertEqual(results.count(status.HTTP_201_CREATED), 1)
        self.assertEqual(results.count(status.HTTP_400_BAD_REQUEST), 1)

        # Confirm exactly one appointment is stored in the database
        appts = Appointment.objects.filter(
            doctor=self.doctor_profile,
            appointment_date=target_date,
            appointment_time=target_time,
        ).exclude(status='CANCELLED')
        self.assertEqual(appts.count(), 1)
