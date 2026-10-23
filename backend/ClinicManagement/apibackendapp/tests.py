import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

from rest_framework import status
from rest_framework.test import APITestCase

from apibackendapp.models import (
    User,
    DoctorProfile,
    ReceptionistProfile,
    PharmacistProfile,
    Patient,
    Appointment,
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
        )
        cls.patient2 = Patient.objects.create(
            patient_id='PAT0002',
            first_name='Jane',
            last_name='Roe',
            gender='FEMALE',
            phone='9222222222',
        )
        cls.patient3 = Patient.objects.create(
            patient_id='PAT0003',
            first_name='Charlie',
            last_name='Brown',
            gender='MALE',
            phone='9333333333',
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
            'appointment_date': '2026-10-23',
            'appointment_time': '10:30:00',
            'reason': 'Headache',
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['appointment_type'], 'WALK_IN')
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
    def test_booking_day_1_and_day_7_ok(self):
        """Advance booking for day 1 (tomorrow) and day 7 (max) both succeed."""
        self.client.force_authenticate(user=self.receptionist_user)
        url = '/api/receptionist/appointments/'

        # Day 1: 2026-10-24
        res1 = self.client.post(url, {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'BOOKED',
            'appointment_date': '2026-10-24',
            'appointment_time': '11:00:00',
        })
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Day 7: 2026-10-30
        res7 = self.client.post(url, {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient2.id,
            'appointment_type': 'BOOKED',
            'appointment_date': '2026-10-30',
            'appointment_time': '11:00:00',
        })
        self.assertEqual(res7.status_code, status.HTTP_201_CREATED)

    def test_booking_day_8_rejected(self):
        """Advance booking beyond 7 days (day 8: 2026-10-31) is rejected."""
        self.client.force_authenticate(user=self.receptionist_user)
        url = '/api/receptionist/appointments/'
        response = self.client.post(url, {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'BOOKED',
            'appointment_date': '2026-10-31',
            'appointment_time': '11:00:00',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_booked_for_today_rejected(self):
        """BOOKED appointment type cannot be used for today."""
        self.client.force_authenticate(user=self.receptionist_user)
        url = '/api/receptionist/appointments/'
        response = self.client.post(url, {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'BOOKED',
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
            'appointment_type': 'BOOKED',
            'appointment_date': '2026-10-22',  # yesterday
            'appointment_time': '11:00:00',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_slot_rejected(self):
        """Times that do not match doctor's generated slot grid are rejected."""
        self.client.force_authenticate(user=self.receptionist_user)
        url = '/api/receptionist/appointments/'
        response = self.client.post(url, {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'BOOKED',
            'appointment_date': '2026-10-24',
            'appointment_time': '09:07:00',  # not on 15m grid
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------------
    # 3. Double booking and slot freeing
    # ------------------------------------------------------------------------
    def test_double_booking_rejected_and_cancelled_slot_freed(self):
        """Double booking is rejected, but cancelling the appointment frees the slot."""
        self.client.force_authenticate(user=self.receptionist_user)
        url = '/api/receptionist/appointments/'

        # Book slot successfully
        res1 = self.client.post(url, {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'BOOKED',
            'appointment_date': '2026-10-24',
            'appointment_time': '10:00:00',
        })
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        appt_id = res1.data['id']

        # Try booking the exact same doctor and slot with patient 2 -> rejected
        res2 = self.client.post(url, {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient2.id,
            'appointment_type': 'BOOKED',
            'appointment_date': '2026-10-24',
            'appointment_time': '10:00:00',
        })
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

        # Try booking patient 1 with doctor 2 at the same date and time -> rejected
        res_patient_conflict = self.client.post(url, {
            'doctor': self.doctor2_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'BOOKED',
            'appointment_date': '2026-10-24',
            'appointment_time': '10:00:00',
        })
        self.assertEqual(res_patient_conflict.status_code, status.HTTP_400_BAD_REQUEST)

        # Cancel the first appointment
        cancel_url = f'/api/receptionist/appointments/{appt_id}/cancel/'
        cancel_res = self.client.post(cancel_url)
        self.assertEqual(cancel_res.status_code, status.HTTP_200_OK)

        # Now booking that slot again should succeed
        res3 = self.client.post(url, {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient2.id,
            'appointment_type': 'BOOKED',
            'appointment_date': '2026-10-24',
            'appointment_time': '10:00:00',
        })
        self.assertEqual(res3.status_code, status.HTTP_201_CREATED)

    # ------------------------------------------------------------------------
    # 4. Role and permissions tests
    # ------------------------------------------------------------------------
    def test_doctor_cannot_create_or_edit_appointments(self):
        """Doctors cannot create or edit appointments (403 on receptionist, 405 on doctor)."""
        self.client.force_authenticate(user=self.doctor1_user)

        # Doctor cannot create in receptionist endpoint -> 403
        rec_res = self.client.post('/api/receptionist/appointments/', {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient1.id,
            'appointment_type': 'BOOKED',
            'appointment_date': '2026-10-24',
            'appointment_time': '11:00:00',
        })
        self.assertEqual(rec_res.status_code, status.HTTP_403_FORBIDDEN)

        # Doctor cannot create in doctor endpoint -> 405 (ReadOnlyModelViewSet)
        doc_post = self.client.post('/api/doctor/appointments/', {
            'doctor': self.doctor1_profile.id,
            'patient': self.patient1.id,
            'appointment_date': '2026-10-24',
            'appointment_time': '11:00:00',
        })
        self.assertEqual(doc_post.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # Setup an existing appointment for doctor 1
        appt = Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='BOOKED',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(11, 0),
            status='BOOKED',
        )

        # Doctor cannot PUT/PATCH appointment -> 405
        patch_res = self.client.patch(f'/api/doctor/appointments/{appt.id}/', {'status': 'COMPLETED'})
        self.assertEqual(patch_res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # Action complete only allowed from CONFIRMED
        complete_res_bad = self.client.post(f'/api/doctor/appointments/{appt.id}/complete/')
        self.assertEqual(complete_res_bad.status_code, status.HTTP_400_BAD_REQUEST)

        # When CONFIRMED, complete action succeeds
        appt.status = 'CONFIRMED'
        appt.save()
        complete_res_ok = self.client.post(f'/api/doctor/appointments/{appt.id}/complete/')
        self.assertEqual(complete_res_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(complete_res_ok.data['status'], 'COMPLETED')

        # Action no-show
        appt.status = 'BOOKED'
        appt.save()
        noshow_res = self.client.post(f'/api/doctor/appointments/{appt.id}/no-show/')
        self.assertEqual(noshow_res.status_code, status.HTTP_200_OK)
        self.assertEqual(noshow_res.data['status'], 'NO_SHOW')

    def test_doctor_and_pharmacist_get_403_on_receptionist_endpoints(self):
        """Doctor and Pharmacist must get 403 on /api/receptionist/* endpoints."""
        # Doctor
        self.client.force_authenticate(user=self.doctor1_user)
        self.assertEqual(self.client.get('/api/receptionist/patients/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get('/api/receptionist/appointments/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            self.client.get(f'/api/receptionist/doctors/{self.doctor1_profile.id}/slots/?type=WALK_IN&date=2026-10-23').status_code,
            status.HTTP_403_FORBIDDEN,
        )

        # Pharmacist
        self.client.force_authenticate(user=self.pharmacist_user)
        self.assertEqual(self.client.get('/api/receptionist/patients/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get('/api/receptionist/appointments/').status_code, status.HTTP_403_FORBIDDEN)

        # Admin may access
        self.client.force_authenticate(user=self.admin_user)
        self.assertEqual(self.client.get('/api/receptionist/patients/').status_code, status.HTTP_200_OK)

    # ------------------------------------------------------------------------
    # 5. Doctor patients scoping and consultations
    # ------------------------------------------------------------------------
    def test_doctor_sees_only_own_patients_and_other_doctor_patient_is_404(self):
        """Doctor sees only patients assigned to them; other doctor's patient returns 404."""
        # Patient 1 has active appointment with Doctor 1
        Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='BOOKED',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(11, 0),
            status='BOOKED',
        )
        # Patient 2 has appointment ONLY with Doctor 2
        Appointment.objects.create(
            doctor=self.doctor2_profile,
            patient=self.patient2,
            receptionist=self.receptionist_profile,
            appointment_type='BOOKED',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(11, 0),
            status='BOOKED',
        )

        self.client.force_authenticate(user=self.doctor1_user)

        # List patients
        res = self.client.get('/api/doctor/patients/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        returned_ids = [p['id'] for p in res.data]
        self.assertIn(self.patient1.id, returned_ids)
        self.assertNotIn(self.patient2.id, returned_ids)

        # Retrieve own patient -> 200
        res_own = self.client.get(f'/api/doctor/patients/{self.patient1.id}/')
        self.assertEqual(res_own.status_code, status.HTTP_200_OK)

        # Retrieve other doctor's patient -> 404
        res_other = self.client.get(f'/api/doctor/patients/{self.patient2.id}/')
        self.assertEqual(res_other.status_code, status.HTTP_404_NOT_FOUND)

    def test_cancelled_appointment_removes_access(self):
        """A cancelled appointment removes doctor access unless another active appointment exists."""
        appt = Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient3,
            receptionist=self.receptionist_profile,
            appointment_type='BOOKED',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(14, 0),
            status='CANCELLED',
        )

        self.client.force_authenticate(user=self.doctor1_user)
        # Patient 3 only has a CANCELLED appointment -> 404
        res = self.client.get(f'/api/doctor/patients/{self.patient3.id}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # Add an active appointment for patient 3 with doctor 1
        Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient3,
            receptionist=self.receptionist_profile,
            appointment_type='BOOKED',
            appointment_date=datetime.date(2026, 10, 25),
            appointment_time=datetime.time(14, 0),
            status='BOOKED',
        )
        res_active = self.client.get(f'/api/doctor/patients/{self.patient3.id}/')
        self.assertEqual(res_active.status_code, status.HTTP_200_OK)

    def test_doctor_cannot_write_consultation_for_another_doctor_patient(self):
        """Doctor cannot create consultation for another doctor's patient or a cancelled appointment."""
        appt_doc2 = Appointment.objects.create(
            doctor=self.doctor2_profile,
            patient=self.patient2,
            receptionist=self.receptionist_profile,
            appointment_type='BOOKED',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(11, 0),
            status='CONFIRMED',
        )
        cancelled_appt_doc1 = Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='BOOKED',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(12, 0),
            status='CANCELLED',
        )

        self.client.force_authenticate(user=self.doctor1_user)

        # Attempt consultation on another doctor's appointment
        res1 = self.client.post('/api/doctor/consultations/', {
            'appointment': appt_doc2.id,
            'patient': self.patient2.id,
            'symptoms': 'Fever',
            'diagnosis': 'Flu',
        })
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)

        # Attempt consultation on a cancelled appointment
        res2 = self.client.post('/api/doctor/consultations/', {
            'appointment': cancelled_appt_doc1.id,
            'patient': self.patient1.id,
            'symptoms': 'Cough',
            'diagnosis': 'Bronchitis',
        })
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------------
    # 6. Slots endpoint
    # ------------------------------------------------------------------------
    def test_doctor_slots_endpoint(self):
        """GET /api/receptionist/doctors/<id>/slots/ returns generated slots with availability."""
        # Book a slot on 2026-10-24 at 10:00:00
        Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='BOOKED',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(10, 0),
            status='BOOKED',
        )

        self.client.force_authenticate(user=self.receptionist_user)

        # 1. BOOKED slots for tomorrow (2026-10-24)
        url = f'/api/receptionist/doctors/{self.doctor1_profile.id}/slots/?type=BOOKED&date=2026-10-24'
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        slots_by_time = {s['time']: s['available'] for s in res.data}
        self.assertIn('10:00:00', slots_by_time)
        self.assertFalse(slots_by_time['10:00:00'])  # booked -> unavailable
        self.assertTrue(slots_by_time['10:15:00'])   # free -> available

        # 2. WALK_IN slots for today (2026-10-23): 09:00 slot has passed (unavailable), 10:30 is available
        url_walkin = f'/api/receptionist/doctors/{self.doctor1_profile.id}/slots/?type=WALK_IN&date=2026-10-23'
        res_walkin = self.client.get(url_walkin)
        self.assertEqual(res_walkin.status_code, status.HTTP_200_OK)
        walkin_slots = {s['time']: s['available'] for s in res_walkin.data}
        self.assertFalse(walkin_slots['09:00:00'])  # passed
        self.assertTrue(walkin_slots['10:30:00'])   # future

        # 3. Invalid date window returns 400
        url_bad_date = f'/api/receptionist/doctors/{self.doctor1_profile.id}/slots/?type=BOOKED&date=2026-10-31'
        res_bad = self.client.get(url_bad_date)
        self.assertEqual(res_bad.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------------
    # 7. Signup security fix & shared patient nested visits
    # ------------------------------------------------------------------------
    def test_signup_security_fix_forces_receptionist(self):
        """Public signup must not allow setting role=ADMIN."""
        res = self.client.post('/api/auth/signup/', {
            'username': 'newuser1',
            'email': 'newuser1@clinic.com',
            'password': 'Password123!',
            'role': 'ADMIN',
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        new_user = User.objects.get(username='newuser1')
        self.assertEqual(new_user.role, 'RECEPTIONIST')

    def test_shared_patient_shows_only_own_visits_to_doctor(self):
        """A doctor viewing a shared patient only sees their own visits."""
        # Patient 1 has visits with both Doctor 1 and Doctor 2
        appt1 = Appointment.objects.create(
            doctor=self.doctor1_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='BOOKED',
            appointment_date=datetime.date(2026, 10, 24),
            appointment_time=datetime.time(10, 0),
            status='BOOKED',
        )
        appt2 = Appointment.objects.create(
            doctor=self.doctor2_profile,
            patient=self.patient1,
            receptionist=self.receptionist_profile,
            appointment_type='BOOKED',
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
