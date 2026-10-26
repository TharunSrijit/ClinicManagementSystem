from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apibackendapp.models import (
    Appointment,
    Consultation,
    DoctorProfile,
    MasterDosage,
    MasterLabTest,
    MasterMedicine,
    Patient,
    Prescription,
    PrescriptionItem,
    PriceList,
    ReceptionistProfile,
    PharmacistProfile,
    LabTechnicianProfile,
    Dispense,
    DispenseItem,
    LabTestOrder,
    LabTestResult,
    StockMaster,
    StockTransaction,
    Specialization,
    User,
)


class AdminDoctorProfileApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='doctor_profile_admin',
            email='doctor-profile-admin@clinic.test',
            password='Password123!',
            role='ADMIN',
        )
        self.doctor_user = User.objects.create_user(
            username='doctor_profile_user',
            email='doctor-profile-user@clinic.test',
            password='Password123!',
            role='DOCTOR',
        )
        self.client.force_authenticate(user=self.admin)

    def test_create_doctor_profile_assigns_doctor_id(self):
        response = self.client.post('/api/admin/doctors/', {
            'user': self.doctor_user.pk,
            'specialization': 'Cardiology',
            'qualification': 'M.B.B.S. MD',
            'date_of_joining': '2026-10-01',
            'contact_number': '9876501234',
            'registration_number': 'REG-1001',
            'consultation_fee': '500.00',
            'available_from': '09:00:00',
            'available_to': '17:00:00',
            'available_days': ['MON', 'WED', 'FRI'],
            'slot_minutes': 15,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user'], self.doctor_user.pk)
        self.assertEqual(response.data['doctor_id'], f'DOC{self.doctor_user.pk:04d}')
        self.assertEqual(response.data['available_days'], ['MON', 'WED', 'FRI'])
        self.assertEqual(response.data['date_of_joining'], '2026-10-01')
        self.assertEqual(response.data['contact_number'], '9876501234')
        self.doctor_user.refresh_from_db()
        self.assertEqual(self.doctor_user.phone, '9876501234')
        self.assertTrue(DoctorProfile.objects.filter(user=self.doctor_user).exists())

    def test_create_doctor_profile_rejects_empty_availability(self):
        response = self.client.post('/api/admin/doctors/', {
            'user': self.doctor_user.pk,
            'specialization': 'Cardiology',
            'qualification': 'MBBS MD',
            'registration_number': 'REG-1003',
            'available_days': [],
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('available_days', response.data)

    def test_create_doctor_profile_rejects_non_numeric_contact_number(self):
        response = self.client.post('/api/admin/doctors/', {
            'user': self.doctor_user.pk,
            'specialization': 'Cardiology',
            'qualification': 'MBBS MD',
            'registration_number': 'REG-1234',
            'contact_number': '98765abc',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('contact_number', response.data)

    def test_create_doctor_profile_rejects_symbols_in_specialization_and_qualification(self):
        response = self.client.post('/api/admin/doctors/', {
            'user': self.doctor_user.pk,
            'specialization': 'Cardiology123',
            'qualification': 'MBBS123',
            'registration_number': 'REG-5678',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('specialization', response.data)
        self.assertIn('qualification', response.data)

    def test_create_doctor_profile_requires_ten_digits_starting_with_six_to_nine(self):
        for contact_number in ('5123456789', '987654321'):
            with self.subTest(contact_number=contact_number):
                response = self.client.post('/api/admin/doctors/', {
                    'user': self.doctor_user.pk,
                    'specialization': 'Cardiology',
                    'qualification': 'MBBS MD',
                    'registration_number': f'ABC-{contact_number}',
                    'contact_number': contact_number,
                }, format='json')

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn('contact_number', response.data)

    def test_user_api_rejects_non_letter_name_and_non_numeric_phone(self):
        for field, value in (
            ('first_name', 'Jane2'),
            ('last_name', 'Smith!'),
            ('phone', '98765abc'),
        ):
            with self.subTest(field=field):
                response = self.client.patch(
                    f'/api/admin/users/{self.doctor_user.pk}/',
                    {field: value},
                    format='json',
                )

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, response.data)

    def test_create_doctor_profile_rejects_future_date_of_joining(self):
        future_date = (timezone.localdate() + timedelta(days=1)).isoformat()
        response = self.client.post('/api/admin/doctors/', {
            'user': self.doctor_user.pk,
            'specialization': 'Cardiology',
            'qualification': 'MBBS MD',
            'date_of_joining': future_date,
            'registration_number': 'REG-2001',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('date_of_joining', response.data)

    def test_create_doctor_profile_defaults_to_weekdays(self):
        response = self.client.post('/api/admin/doctors/', {
            'user': self.doctor_user.pk,
            'specialization': 'Cardiology',
            'qualification': 'MBBS MD',
            'registration_number': 'REG-2004',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            response.data['available_days'],
            ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        )

    def test_list_doctor_profiles_includes_associated_user_id(self):
        DoctorProfile.objects.create(
            user=self.doctor_user,
            doctor_id='DOC-API-001',
            specialization='Cardiology',
            qualification='MBBS MD',
            registration_number='REG-3001',
        )

        response = self.client.get('/api/admin/doctors/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['user'], self.doctor_user.pk)

    def test_create_doctor_profile_rejects_non_doctor_user(self):
        receptionist = User.objects.create_user(
            username='not_a_doctor',
            email='not-a-doctor@clinic.test',
            password='Password123!',
            role='RECEPTIONIST',
        )
        response = self.client.post('/api/admin/doctors/', {
            'user': receptionist.pk,
            'specialization': 'Cardiology',
            'qualification': 'MBBS MD',
            'registration_number': 'REG-4002',
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_doctor_profile(self):
        profile = DoctorProfile.objects.create(
            user=self.doctor_user,
            doctor_id='DOC-EDIT-001',
            specialization='Cardiology',
            qualification='MBBS MD',
            registration_number='REG-5001',
        )

        response = self.client.patch(
            f'/api/admin/doctors/{profile.pk}/',
            {
                'specialization': 'Neurology',
                'date_of_joining': '2026-10-02',
                'contact_number': '9876504321',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profile.refresh_from_db()
        self.assertEqual(profile.specialization, 'Neurology')
        self.assertEqual(profile.date_of_joining.isoformat(), '2026-10-02')
        self.doctor_user.refresh_from_db()
        self.assertEqual(self.doctor_user.phone, '9876504321')

    def test_delete_doctor_profile_keeps_user_account(self):
        profile = DoctorProfile.objects.create(
            user=self.doctor_user,
            doctor_id='DOC-DELETE-001',
            specialization='Cardiology',
            qualification='MBBS MD',
            registration_number='REG-6001',
        )

        response = self.client.delete(f'/api/admin/doctors/{profile.pk}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(DoctorProfile.objects.filter(pk=profile.pk).exists())
        self.assertTrue(User.objects.filter(pk=self.doctor_user.pk).exists())

    def test_deactivate_doctor_account(self):
        DoctorProfile.objects.create(
            user=self.doctor_user,
            doctor_id='DOC-STATUS-001',
            specialization='Cardiology',
            qualification='MBBS MD',
            registration_number='REG-7001',
        )

        response = self.client.post(
            f'/api/admin/users/{self.doctor_user.pk}/deactivate/'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.doctor_user.refresh_from_db()
        self.assertFalse(self.doctor_user.is_active)

    def test_add_existing_receptionist_account_to_staff_directory(self):
        receptionist = User.objects.create_user(
            username='receptionist_profile_user',
            email='receptionist-profile-user@clinic.test',
            password='Password123!',
            role='RECEPTIONIST',
        )

        response = self.client.post('/api/admin/users/create_staff/', {
            'role': 'RECEPTIONIST',
            'existing_user': receptionist.pk,
            'profile': {
                'phone': '9876543210',
                'qualification': 'Healthcare Administration',
                'date_of_joining': '2026-10-04',
            },
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user']['id'], receptionist.pk)
        self.assertTrue(
            ReceptionistProfile.objects.filter(user=receptionist).exists()
        )
        self.assertEqual(
            ReceptionistProfile.objects.get(user=receptionist).qualification,
            'Healthcare Administration',
        )
        self.assertEqual(
            ReceptionistProfile.objects.get(user=receptionist).date_of_joining.isoformat(),
            '2026-10-04',
        )

    def test_add_staff_rejects_future_date_of_joining(self):
        receptionist = User.objects.create_user(
            username='receptionist_future_joining',
            email='receptionist-future@clinic.test',
            password='Password123!',
            role='RECEPTIONIST',
        )
        future_date = (timezone.localdate() + timedelta(days=1)).isoformat()
        response = self.client.post('/api/admin/users/create_staff/', {
            'role': 'RECEPTIONIST',
            'existing_user': receptionist.pk,
            'profile': {
                'phone': '9876543210',
                'date_of_joining': future_date,
            },
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('profile', response.data)

    def test_add_staff_rejects_non_numeric_phone(self):
        receptionist = User.objects.create_user(
            username='receptionist_invalid_phone',
            email='receptionist-invalid-phone@clinic.test',
            password='Password123!',
            role='RECEPTIONIST',
        )

        response = self.client.post('/api/admin/users/create_staff/', {
            'role': 'RECEPTIONIST',
            'existing_user': receptionist.pk,
            'profile': {'phone': '98765abc'},
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('profile', response.data)

    def test_add_staff_rejects_symbols_in_qualification(self):
        lab_technician = User.objects.create_user(
            username='lab_technician_invalid_qualification',
            email='lab-invalid-qualification@clinic.test',
            password='Password123!',
            role='LAB_TECHNICIAN',
        )

        response = self.client.post('/api/admin/users/create_staff/', {
            'role': 'LAB_TECHNICIAN',
            'existing_user': lab_technician.pk,
            'profile': {
                'qualification': 'BSc_',
                'phone': '9876543210',
            },
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('profile', response.data)

    def test_add_staff_requires_ten_digits_starting_with_six_to_nine(self):
        for index, phone in enumerate(('5123456789', '987654321')):
            with self.subTest(phone=phone):
                receptionist = User.objects.create_user(
                    username=f'receptionist_invalid_format_{index}',
                    email=f'receptionist-invalid-format-{index}@clinic.test',
                    password='Password123!',
                    role='RECEPTIONIST',
                )
                response = self.client.post('/api/admin/users/create_staff/', {
                    'role': 'RECEPTIONIST',
                    'existing_user': receptionist.pk,
                    'profile': {'phone': phone},
                }, format='json')

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn('profile', response.data)

    def test_update_staff_profile_updates_user_and_profile(self):
        receptionist = User.objects.create_user(
            username='receptionist_edit_user',
            email='receptionist-edit@clinic.test',
            password='Password123!',
            role='RECEPTIONIST',
        )
        profile = ReceptionistProfile.objects.create(
            user=receptionist,
            employee_id='REC-EDIT-001',
            phone='9876543210',
        )

        response = self.client.patch(
            f'/api/admin/users/{receptionist.pk}/staff-profile/',
            {
                'user': {'first_name': 'Updated'},
                'profile': {
                    'phone': '9123456780',
                    'qualification': 'Healthcare Administration',
                    'date_of_joining': '2026-10-03',
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        receptionist.refresh_from_db()
        profile.refresh_from_db()
        self.assertEqual(receptionist.first_name, 'Updated')
        self.assertEqual(profile.phone, '9123456780')
        self.assertEqual(profile.qualification, 'Healthcare Administration')
        self.assertEqual(profile.date_of_joining.isoformat(), '2026-10-03')

    def test_update_staff_profile_rejects_future_date_of_joining(self):
        receptionist = User.objects.create_user(
            username='receptionist_future_edit',
            email='receptionist-future-edit@clinic.test',
            password='Password123!',
            role='RECEPTIONIST',
        )
        profile = ReceptionistProfile.objects.create(
            user=receptionist,
            employee_id='REC-FUTURE-EDIT',
            phone='9876543210',
        )
        future_date = (timezone.localdate() + timedelta(days=1)).isoformat()

        response = self.client.patch(
            f'/api/admin/users/{receptionist.pk}/staff-profile/',
            {'profile': {'date_of_joining': future_date}},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('date_of_joining', response.data)
        profile.refresh_from_db()
        self.assertIsNone(profile.date_of_joining)

    def test_delete_staff_profile_keeps_user_account(self):
        receptionist = User.objects.create_user(
            username='receptionist_delete_user',
            email='receptionist-delete@clinic.test',
            password='Password123!',
            role='RECEPTIONIST',
        )
        profile = ReceptionistProfile.objects.create(
            user=receptionist,
            employee_id='REC-DELETE-001',
            phone='9876543210',
        )

        response = self.client.delete(
            f'/api/admin/users/{receptionist.pk}/staff-profile/'
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ReceptionistProfile.objects.filter(pk=profile.pk).exists())
        self.assertTrue(User.objects.filter(pk=receptionist.pk).exists())


class AdminLabTestApiTests(APITestCase):
    def setUp(self):
        admin = User.objects.create_user(
            username='lab_test_admin',
            email='lab-test-admin@clinic.test',
            password='Password123!',
            role='ADMIN',
        )
        self.client.force_authenticate(user=admin)

    def test_create_lab_test_with_category_and_status(self):
        response = self.client.post('/api/admin/lab-tests/', {
            'test_code': 'CBC01',
            'test_name': 'Complete Blood Count 2',
            'category': 'Hematology',
            'description': 'Blood cell count',
            'normal_range': '4.5-11',
            'unit': 'ng/mL',
            'price': '350.00',
            'is_active': True,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['category'], 'Hematology')
        self.assertTrue(response.data['is_active'])
        self.assertTrue(MasterLabTest.objects.filter(test_code='CBC01').exists())

    def test_create_lab_test_rejects_invalid_code_name_category_and_range(self):
        valid_data = {
            'test_code': 'cg12',
            'test_name': 'Complete Blood Count 2',
            'category': 'Hematology 2',
            'normal_range': '4.5 - 11',
            'unit': 'ng/mL',
            'price': '350.00',
        }
        invalid_fields = {
            'test_code': '123cg',
            'test_name': 'Blood Count!',
            'category': 'Hema%^',
            'normal_range': '4.5 - <11',
            'unit': '123',
        }

        for field, invalid_value in invalid_fields.items():
            with self.subTest(field=field):
                response = self.client.post(
                    '/api/admin/lab-tests/',
                    {**valid_data, field: invalid_value},
                    format='json',
                )

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, response.data)

    def test_create_lab_test_rejects_arbitrary_unit(self):
        response = self.client.post('/api/admin/lab-tests/', {
            'test_code': 'TSH01',
            'test_name': 'Thyroid Stimulating Hormone',
            'category': 'Endocrinology',
            'unit': 'dfghjk',
            'price': '350.00',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('unit', response.data)

    def test_update_deactivate_and_delete_lab_test(self):
        lab_test = MasterLabTest.objects.create(
            test_code='CBC02',
            test_name='Complete Blood Count',
            category='Hematology',
            price='350.00',
        )

        response = self.client.patch(
            f'/api/admin/lab-tests/{lab_test.pk}/',
            {'category': 'Pathology', 'is_active': False},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lab_test.refresh_from_db()
        self.assertEqual(lab_test.category, 'Pathology')
        self.assertFalse(lab_test.is_active)

        response = self.client.delete(f'/api/admin/lab-tests/{lab_test.pk}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(MasterLabTest.objects.filter(pk=lab_test.pk).exists())


class AdminMedicineInventoryApiTests(APITestCase):
    def setUp(self):
        admin = User.objects.create_user(
            username='medicine_inventory_admin',
            email='medicine-inventory-admin@clinic.test',
            password='Password123!',
            role='ADMIN',
        )
        self.client.force_authenticate(user=admin)

    def test_medicine_api_includes_inventory_summary_and_reorder_level(self):
        medicine = MasterMedicine.objects.create(
            medicine_name='Inventory Test Medicine',
            reorder_level=12,
        )
        StockMaster.objects.create(
            medicine=medicine,
            batch_number='INV-BATCH-001',
            expiry_date='2027-12-31',
            quantity=7,
            purchase_price='2.00',
            selling_price='3.00',
        )

        response = self.client.get('/api/admin/medicines/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        item = next(row for row in response.data if row['id'] == medicine.pk)
        self.assertEqual(item['stock_level'], 7)
        self.assertEqual(item['reorder_level'], 12)
        self.assertEqual(item['expiry_date'], '2027-12-31')

    def test_medicine_deactivate_and_reorder_level_update(self):
        medicine = MasterMedicine.objects.create(
            medicine_name='Update Test Medicine',
            reorder_level=10,
        )

        response = self.client.patch(
            f'/api/admin/medicines/{medicine.pk}/',
            {'reorder_level': 20, 'is_active': False},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        medicine.refresh_from_db()
        self.assertEqual(medicine.reorder_level, 20)
        self.assertFalse(medicine.is_active)

    def test_create_medicine_with_initial_stock_saves_expiry_date(self):
        response = self.client.post('/api/admin/medicines/', {
            'medicine_name': 'Medicine with Initial Batch',
            'generic_name': 'Test Generic',
            'category': 'Analgesic',
            'reorder_level': 8,
            'initial_stock': {
                'batch_number': 'INITIAL-BATCH-001',
                'expiry_date': '2028-06-30',
                'quantity': 24,
                'purchase_price': '2.00',
                'selling_price': '3.00',
            },
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['stock_level'], 24)
        self.assertEqual(response.data['expiry_date'], '2028-06-30')
        medicine = MasterMedicine.objects.get(pk=response.data['id'])
        batch = StockMaster.objects.get(medicine=medicine)
        self.assertEqual(batch.batch_number, 'INITIAL-BATCH-001')
        self.assertEqual(batch.expiry_date.isoformat(), '2028-06-30')

    def test_create_medicine_without_brand_name_or_manufacturer(self):
        response = self.client.post('/api/admin/medicines/', {
            'generic_name': 'Optional Brand Generic',
            'category': 'Analgesic',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['medicine_name'], '')
        self.assertEqual(response.data['manufacturer'], '')

    def test_create_medicine_rejects_name_starting_with_number(self):
        response = self.client.post('/api/admin/medicines/', {
            'generic_name': '123Medicine',
            'category': 'Analgesic',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('generic_name', response.data)

    def test_stock_batch_can_be_created_for_a_medicine(self):
        medicine = MasterMedicine.objects.create(
            medicine_name='New Stock Batch Medicine',
            reorder_level=15,
        )

        response = self.client.post('/api/admin/stock/', {
            'medicine': medicine.pk,
            'batch_number': 'BATCH-CREATE-001',
            'expiry_date': '2027-12-31',
            'quantity': 25,
            'purchase_price': '2.00',
            'selling_price': '3.00',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['quantity'], 25)
        self.assertEqual(response.data['reorder_level'], 15)

    def test_pharmacy_stock_api_returns_medicine_reorder_level(self):
        medicine = MasterMedicine.objects.create(
            medicine_name='Pharmacy Stock Medicine',
            reorder_level=18,
        )
        StockMaster.objects.create(
            medicine=medicine,
            batch_number='PHARMACY-BATCH-001',
            expiry_date='2027-12-31',
            quantity=30,
            purchase_price='2.00',
            selling_price='3.00',
        )

        response = self.client.get('/api/pharmacy/stock/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['reorder_level'], 18)
        self.assertEqual(response.data[0]['expiry_date'], '2027-12-31')

    def test_stock_batch_can_be_updated_and_deleted_without_transactions(self):
        medicine = MasterMedicine.objects.create(medicine_name='Batch Test Medicine')
        batch = StockMaster.objects.create(
            medicine=medicine,
            batch_number='BATCH-EDIT-001',
            expiry_date='2027-12-31',
            quantity=5,
            purchase_price='1.00',
            selling_price='2.00',
        )

        update_response = self.client.patch(
            f'/api/admin/stock/{batch.pk}/',
            {'quantity': 8},
            format='json',
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data['reorder_level'], medicine.reorder_level)

        delete_response = self.client.delete(f'/api/admin/stock/{batch.pk}/')
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(StockMaster.objects.filter(pk=batch.pk).exists())

    def test_stock_batch_with_transaction_cannot_be_deleted(self):
        medicine = MasterMedicine.objects.create(medicine_name='Protected Batch Medicine')
        batch = StockMaster.objects.create(
            medicine=medicine,
            batch_number='BATCH-PROTECTED-001',
            expiry_date='2027-12-31',
            quantity=5,
            purchase_price='1.00',
            selling_price='2.00',
        )
        StockTransaction.objects.create(
            stock=batch,
            transaction_type='ADJUSTMENT',
            quantity=1,
        )

        response = self.client.delete(f'/api/admin/stock/{batch.pk}/')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(StockMaster.objects.filter(pk=batch.pk).exists())

    def test_medicine_delete_removes_inventory_and_price_history(self):
        medicine = MasterMedicine.objects.create(medicine_name='Medicine To Delete')
        batch = StockMaster.objects.create(
            medicine=medicine,
            batch_number='BATCH-DELETE-001',
            expiry_date='2027-12-31',
            quantity=5,
            purchase_price='1.00',
            selling_price='2.00',
        )
        transaction_record = StockTransaction.objects.create(
            stock=batch,
            transaction_type='ADJUSTMENT',
            quantity=1,
        )
        price = PriceList.objects.create(
            medicine=medicine,
            purchase_price='1.00',
            selling_price='2.00',
            effective_from=timezone.localdate(),
        )

        response = self.client.delete(f'/api/admin/medicines/{medicine.pk}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(MasterMedicine.objects.filter(pk=medicine.pk).exists())
        self.assertFalse(StockMaster.objects.filter(pk=batch.pk).exists())
        self.assertFalse(StockTransaction.objects.filter(pk=transaction_record.pk).exists())
        self.assertFalse(PriceList.objects.filter(pk=price.pk).exists())

    def test_medicine_with_prescription_history_cannot_be_deleted(self):
        doctor_user = User.objects.create_user(
            username='medicine_prescription_doctor',
            password='Password123!',
            role='DOCTOR',
        )
        doctor = DoctorProfile.objects.create(
            user=doctor_user,
            doctor_id='DOC-MED-DELETE-001',
            specialization='General Medicine',
            qualification='MBBS',
            registration_number='REG-8001',
        )
        patient = Patient.objects.create(
            patient_id='PAT-MED-DELETE-001',
            first_name='Test',
            last_name='Patient',
            gender='MALE',
            phone='9000000011',
            emergency_contact_name='Emergency Contact',
            emergency_contact_phone='9000000012',
        )
        appointment = Appointment.objects.create(
            patient=patient,
            doctor=doctor,
        )
        consultation = Consultation.objects.create(
            appointment=appointment,
            doctor=doctor,
            patient=patient,
        )
        prescription = Prescription.objects.create(
            prescription_number='PRES-MED-DELETE-001',
            consultation=consultation,
            patient=patient,
            doctor=doctor,
        )
        medicine = MasterMedicine.objects.create(medicine_name='Prescribed Medicine')
        dosage = MasterDosage.objects.create(dosage_name='Once daily')
        PrescriptionItem.objects.create(
            prescription=prescription,
            medicine=medicine,
            dosage=dosage,
            frequency='Once daily',
            duration='5 days',
            quantity=5,
        )

        response = self.client.delete(f'/api/admin/medicines/{medicine.pk}/')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(MasterMedicine.objects.filter(pk=medicine.pk).exists())


class AdminModuleCrudAndSafetyTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin_crud_tester',
            email='admin_crud@clinic.test',
            password='Password123!',
            role='ADMIN',
        )
        self.doctor_user = User.objects.create_user(
            username='doc_crud_tester',
            email='doc_crud@clinic.test',
            password='Password123!',
            role='DOCTOR',
            first_name='Dr. John',
            last_name='Doe',
        )
        self.doctor_profile = DoctorProfile.objects.create(
            user=self.doctor_user,
            doctor_id='DOC9991',
            specialization='Cardiology',
            qualification='MBBS MD',
            registration_number='REG-9991',
            consultation_fee='500.00',
        )
        self.receptionist_user = User.objects.create_user(
            username='rec_crud_tester',
            email='rec_crud@clinic.test',
            password='Password123!',
            role='RECEPTIONIST',
            first_name='Jane',
            last_name='Smith',
        )
        self.receptionist_profile = ReceptionistProfile.objects.create(
            user=self.receptionist_user,
            employee_id='REC9991',
            phone='9876543210',
        )
        self.pharmacist_user = User.objects.create_user(
            username='pharm_crud_tester',
            email='pharm_crud@clinic.test',
            password='Password123!',
            role='PHARMACIST',
        )
        self.pharmacist_profile = PharmacistProfile.objects.create(
            user=self.pharmacist_user,
            employee_id='PHARM9991',
            qualification='B.Pharm',
            phone='9876543212',
        )
        self.client.force_authenticate(user=self.admin)

    def test_01_edit_user_account_persists(self):
        """1. Edit an account and verify the changes persist."""
        response = self.client.patch(f'/api/admin/users/{self.receptionist_user.pk}/', {
            'first_name': 'Janet',
            'last_name': 'Williams',
            'phone': '9876509876',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.receptionist_user.refresh_from_db()
        self.assertEqual(self.receptionist_user.first_name, 'Janet')
        self.assertEqual(self.receptionist_user.last_name, 'Williams')
        self.assertEqual(self.receptionist_user.phone, '9876509876')

    def test_02_deactivate_user_blocks_login_and_token(self):
        """2. Deactivate an account and confirm it cannot log in."""
        deact_resp = self.client.post(f'/api/admin/users/{self.doctor_user.pk}/deactivate/')
        self.assertEqual(deact_resp.status_code, status.HTTP_200_OK)
        self.doctor_user.refresh_from_db()
        self.assertFalse(self.doctor_user.is_active)

        # Unauthenticated client attempts to login
        self.client.logout()
        token_resp = self.client.post('/api/auth/login/', {
            'username': 'doc_crud_tester',
            'password': 'Password123!',
        }, format='json')
        self.assertEqual(token_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('User account is deactivated', str(token_resp.data))

        # Check protected doctor endpoint blocks inactive user even if authenticated
        self.client.force_authenticate(user=self.doctor_user)
        api_resp = self.client.get('/api/doctor/appointments/')
        self.assertEqual(api_resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_03_reactivate_user_allows_login_again(self):
        """3. Reactivate the account and confirm it can log in again."""
        self.doctor_user.is_active = False
        self.doctor_user.save()

        act_resp = self.client.post(f'/api/admin/users/{self.doctor_user.pk}/activate/')
        self.assertEqual(act_resp.status_code, status.HTTP_200_OK)
        self.doctor_user.refresh_from_db()
        self.assertTrue(self.doctor_user.is_active)

        # Login now succeeds
        self.client.logout()
        token_resp = self.client.post('/api/auth/login/', {
            'username': 'doc_crud_tester',
            'password': 'Password123!',
        }, format='json')
        self.assertEqual(token_resp.status_code, status.HTTP_200_OK)
        self.assertIn('access', token_resp.data)

    def test_04_historical_records_remain_accessible_after_deactivation(self):
        """4. Verify existing historical records remain accessible after deactivation."""
        patient = Patient.objects.create(
            patient_id='PAT-HIST-001',
            first_name='Hist',
            last_name='Patient',
            gender='FEMALE',
            phone='9000000021',
            emergency_contact_name='Contact',
            emergency_contact_phone='9000000022',
        )
        appointment = Appointment.objects.create(
            patient=patient,
            doctor=self.doctor_profile,
            appointment_date=timezone.localdate(),
        )
        consultation = Consultation.objects.create(
            appointment=appointment,
            patient=patient,
            doctor=self.doctor_profile,
            diagnosis='Hypertension',
        )

        # Deactivate doctor
        self.client.post(f'/api/admin/users/{self.doctor_user.pk}/deactivate/')

        # Historical records remain intact and accessible
        self.assertTrue(Appointment.objects.filter(pk=appointment.pk).exists())
        self.assertTrue(Consultation.objects.filter(pk=consultation.pk).exists())
        admin_appt = self.client.get(f'/api/admin/appointments/{appointment.pk}/')
        self.assertEqual(admin_appt.status_code, status.HTTP_200_OK)

    def test_05_edit_medicine_and_sync_stock_quantity(self):
        """5. Edit medicine details and stock quantity."""
        medicine = MasterMedicine.objects.create(
            medicine_name='Paracetamol 500mg',
            category='Analgesics',
            reorder_level=20,
        )
        batch = StockMaster.objects.create(
            medicine=medicine,
            batch_number='PARA-B1',
            expiry_date='2028-06-30',
            quantity=50,
            purchase_price='2.00',
            selling_price='5.00',
        )

        response = self.client.patch(f'/api/admin/medicines/{medicine.pk}/', {
            'medicine_name': 'Paracetamol Extra 650mg',
            'quantity': 75,
            'selling_price': '7.50',
            'batch_number': 'PARA-B1-UPDATED',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        medicine.refresh_from_db()
        batch.refresh_from_db()
        self.assertEqual(medicine.medicine_name, 'Paracetamol Extra 650mg')
        self.assertEqual(batch.quantity, 75)
        self.assertEqual(batch.selling_price, 7.50)
        self.assertEqual(batch.batch_number, 'PARA-B1-UPDATED')

    def test_06_activate_and_deactivate_medicine(self):
        """6. Activate and deactivate a medicine."""
        medicine = MasterMedicine.objects.create(
            medicine_name='Amoxicillin 250mg',
            is_active=True,
        )

        deact_resp = self.client.post(f'/api/admin/medicines/{medicine.pk}/deactivate/')
        self.assertEqual(deact_resp.status_code, status.HTTP_200_OK)
        medicine.refresh_from_db()
        self.assertFalse(medicine.is_active)

        act_resp = self.client.post(f'/api/admin/medicines/{medicine.pk}/activate/')
        self.assertEqual(act_resp.status_code, status.HTTP_200_OK)
        medicine.refresh_from_db()
        self.assertTrue(medicine.is_active)

    def test_07_inactive_or_expired_medicine_cannot_be_dispensed(self):
        """7. Verify inactive or expired medicines cannot be used in prohibited dispensing workflows."""
        patient = Patient.objects.create(
            patient_id='PAT-DISP-001',
            first_name='Dispense',
            last_name='Patient',
            gender='MALE',
            phone='9000000031',
            emergency_contact_name='Contact',
            emergency_contact_phone='9000000032',
        )
        appointment = Appointment.objects.create(
            patient=patient,
            doctor=self.doctor_profile,
            appointment_date=timezone.localdate(),
        )
        consultation = Consultation.objects.create(
            appointment=appointment,
            patient=patient,
            doctor=self.doctor_profile,
        )
        prescription = Prescription.objects.create(
            prescription_number='RX-DISP-001',
            consultation=consultation,
            patient=patient,
            doctor=self.doctor_profile,
        )
        med_inactive = MasterMedicine.objects.create(
            medicine_name='Inactive Med',
            is_active=False,
        )
        StockMaster.objects.create(
            medicine=med_inactive,
            batch_number='INACT-01',
            expiry_date='2028-12-31',
            quantity=100,
            purchase_price='5.00',
            selling_price='10.00',
        )

        dispense1 = Dispense.objects.create(
            dispense_number='DISP-TEST-001',
            prescription=prescription,
            patient=patient,
            pharmacist=self.pharmacist_profile,
            status='PENDING',
        )
        DispenseItem.objects.create(
            dispense=dispense1,
            medicine=med_inactive,
            quantity=2,
            unit_price='10.00',
            total_price='20.00',
        )

        # Pharmacist attempts to dispense inactive medicine
        self.client.force_authenticate(user=self.pharmacist_user)
        resp1 = self.client.post(f'/api/pharmacy/dispenses/{dispense1.pk}/dispense/')
        self.assertEqual(resp1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('is deactivated', str(resp1.data))

        # Test expired medicine cannot be dispensed even if medicine is active
        med_expired = MasterMedicine.objects.create(
            medicine_name='Expired Med',
            is_active=True,
        )
        StockMaster.objects.create(
            medicine=med_expired,
            batch_number='EXP-01',
            expiry_date=timezone.localdate() - timedelta(days=10),
            quantity=100,
            purchase_price='5.00',
            selling_price='10.00',
        )
        dispense2 = Dispense.objects.create(
            dispense_number='DISP-TEST-002',
            prescription=prescription,
            patient=patient,
            pharmacist=self.pharmacist_profile,
            status='PENDING',
        )
        DispenseItem.objects.create(
            dispense=dispense2,
            medicine=med_expired,
            quantity=2,
            unit_price='10.00',
            total_price='20.00',
        )
        resp2 = self.client.post(f'/api/pharmacy/dispenses/{dispense2.pk}/dispense/')
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('expired or insufficient', str(resp2.data))

    def test_08_edit_lab_test_details(self):
        """8. Edit lab stock details and quantity."""
        self.client.force_authenticate(user=self.admin)
        test = MasterLabTest.objects.create(
            test_code='LIPID01',
            test_name='Lipid Profile Standard',
            price='450.00',
            normal_range='100-200',
            category='Biochemistry',
            unit='mg/L',
        )

        response = self.client.patch(f'/api/admin/lab-tests/{test.pk}/', {
            'test_name': 'Comprehensive Lipid Panel',
            'price': '600.00',
            'normal_range': '120-150',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        test.refresh_from_db()
        self.assertEqual(test.test_name, 'Comprehensive Lipid Panel')
        self.assertEqual(test.price, 600.00)
        self.assertEqual(test.normal_range, '120-150')

    def test_09_activate_and_deactivate_lab_test(self):
        """9. Activate and deactivate a lab stock item."""
        test = MasterLabTest.objects.create(
            test_code='THY01',
            test_name='Thyroid Profile',
            price='500.00',
            category='Biochemistry',
            unit='ng/mL',
            is_active=True,
        )

        deact_resp = self.client.post(f'/api/admin/lab-tests/{test.pk}/deactivate/')
        self.assertEqual(deact_resp.status_code, status.HTTP_200_OK)
        test.refresh_from_db()
        self.assertFalse(test.is_active)

        act_resp = self.client.post(f'/api/admin/lab-tests/{test.pk}/activate/')
        self.assertEqual(act_resp.status_code, status.HTTP_200_OK)
        test.refresh_from_db()
        self.assertTrue(test.is_active)

    def test_10_completed_lab_reports_remain_accessible(self):
        """10. Verify completed lab reports remain accessible after test deactivation."""
        patient = Patient.objects.create(
            patient_id='PAT-LAB-001',
            first_name='Lab',
            last_name='Patient',
            gender='MALE',
            phone='9000000041',
            emergency_contact_name='Contact',
            emergency_contact_phone='9000000042',
        )
        test = MasterLabTest.objects.create(
            test_code='CBC01',
            test_name='Complete Blood Count',
            price='300.00',
            category='Hematology',
            unit='cells/µL',
            is_active=True,
        )
        order = LabTestOrder.objects.create(
            order_number='ORD-LAB-001',
            patient=patient,
            doctor=self.doctor_profile,
            test=test,
            status='COMPLETED',
        )
        tech_user = User.objects.create_user(
            username='tech_crud_user',
            role='LAB_TECHNICIAN',
        )
        tech_profile = LabTechnicianProfile.objects.create(
            user=tech_user,
            employee_id='TECH9991',
            phone='9876543219',
        )
        result = LabTestResult.objects.create(
            order=order,
            technician=tech_profile,
            result_value='14.2',
            remarks='Normal hemoglobin',
        )

        # Deactivate lab test
        self.client.post(f'/api/admin/lab-tests/{test.pk}/deactivate/')

        # Order and Result remain intact
        self.assertTrue(LabTestOrder.objects.filter(pk=order.pk).exists())
        self.assertTrue(LabTestResult.objects.filter(pk=result.pk).exists())

    def test_11_delete_account_with_dependencies_safely_rejected(self):
        """11. Attempt to delete records with historical dependencies and verify deletion is safely rejected."""
        patient = Patient.objects.create(
            patient_id='PAT-DEP-001',
            first_name='Dep',
            last_name='Patient',
            gender='MALE',
            phone='9000000051',
            emergency_contact_name='Contact',
            emergency_contact_phone='9000000052',
        )
        Appointment.objects.create(
            patient=patient,
            doctor=self.doctor_profile,
            appointment_date=timezone.localdate(),
        )

        # Attempt to delete doctor
        del_user_resp = self.client.delete(f'/api/admin/users/{self.doctor_user.pk}/')
        self.assertEqual(del_user_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cannot be deleted', str(del_user_resp.data))
        self.assertTrue(User.objects.filter(pk=self.doctor_user.pk).exists())

    def test_12_valid_deletions_work_when_permitted(self):
        """12. Verify valid deletions work when permitted."""
        clean_user = User.objects.create_user(
            username='clean_user_to_delete',
            password='Password123!',
            role='RECEPTIONIST',
        )
        ReceptionistProfile.objects.create(user=clean_user, employee_id='CLEAN01')
        user_del = self.client.delete(f'/api/admin/users/{clean_user.pk}/')
        self.assertEqual(user_del.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=clean_user.pk).exists())

        clean_med = MasterMedicine.objects.create(medicine_name='Clean Medicine')
        med_del = self.client.delete(f'/api/admin/medicines/{clean_med.pk}/')
        self.assertEqual(med_del.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(MasterMedicine.objects.filter(pk=clean_med.pk).exists())

        clean_test = MasterLabTest.objects.create(
            test_code='CLEAN01',
            test_name='Clean Test',
            category='Hematology',
            unit='mg/L',
            price='200.00',
        )
        test_del = self.client.delete(f'/api/admin/lab-tests/{clean_test.pk}/')
        self.assertEqual(test_del.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(MasterLabTest.objects.filter(pk=clean_test.pk).exists())

    def test_13_non_admin_cannot_access_administrative_operations(self):
        """13. Verify non-admin users cannot access administrative operations."""
        self.client.force_authenticate(user=self.receptionist_user)

        resp1 = self.client.get('/api/admin/users/')
        self.assertEqual(resp1.status_code, status.HTTP_403_FORBIDDEN)

        resp2 = self.client.post(f'/api/admin/medicines/1/deactivate/')
        self.assertEqual(resp2.status_code, status.HTTP_403_FORBIDDEN)

        resp3 = self.client.post(f'/api/admin/lab-tests/1/activate/')
        self.assertEqual(resp3.status_code, status.HTTP_403_FORBIDDEN)


class AdminSpecializationApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='spec_admin',
            email='spec-admin@clinic.test',
            password='Password123!',
            role='ADMIN',
        )
        self.doctor_user = User.objects.create_user(
            username='spec_doctor',
            email='spec-doctor@clinic.test',
            password='Password123!',
            role='DOCTOR',
        )
        self.receptionist_user = User.objects.create_user(
            username='spec_receptionist',
            email='spec-rec@clinic.test',
            password='Password123!',
            role='RECEPTIONIST',
        )
        self.client.force_authenticate(user=self.admin)

    def test_list_specializations_authenticated(self):
        """Authenticated users can view specializations."""
        self.client.force_authenticate(user=self.receptionist_user)
        response = self.client.get('/api/admin/specializations/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertGreater(len(response.data), 0)

    def test_create_specialization_success(self):
        """Admin can successfully create a new specialization."""
        response = self.client.post('/api/admin/specializations/', {
            'name': 'Gastroenterology',
            'description': 'Digestive system specialist',
            'is_active': True,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Gastroenterology')
        self.assertTrue(Specialization.objects.filter(name='Gastroenterology').exists())

    def test_create_specialization_empty_name_rejected(self):
        """Empty or whitespace-only name is rejected."""
        response = self.client.post('/api/admin/specializations/', {
            'name': '   ',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)

    def test_create_specialization_duplicate_case_insensitive_rejected(self):
        """Case-insensitive duplicate names are rejected."""
        Specialization.objects.create(name='Endocrinology')
        response = self.client.post('/api/admin/specializations/', {
            'name': '  endocrinology  ',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)

    def test_non_admin_cannot_create_specialization(self):
        """Doctors and receptionists cannot create specializations."""
        self.client.force_authenticate(user=self.doctor_user)
        response = self.client.post('/api/admin/specializations/', {
            'name': 'Rheumatology',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_specialization_renames_doctor_profile(self):
        """Renaming a specialization propagates to doctors assigned that specialization."""
        spec = Specialization.objects.create(name='Orthopedics')
        doctor = DoctorProfile.objects.create(
            user=self.doctor_user,
            doctor_id='DOC-SPEC-1',
            specialization='Orthopedics',
            qualification='MBBS MS',
            registration_number='REG-SPEC-1',
            consultation_fee='500.00',
        )
        response = self.client.put(f'/api/admin/specializations/{spec.pk}/', {
            'name': 'Orthopedic Surgery',
            'is_active': True,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        doctor.refresh_from_db()
        self.assertEqual(doctor.specialization, 'Orthopedic Surgery')

    def test_delete_specialization_with_doctor_soft_deactivates(self):
        """Deleting a specialization assigned to a doctor deactivates it to protect records."""
        spec = Specialization.objects.create(name='Pulmonology')
        DoctorProfile.objects.create(
            user=self.doctor_user,
            doctor_id='DOC-SPEC-2',
            specialization='Pulmonology',
            qualification='MBBS MD',
            registration_number='REG-SPEC-2',
            consultation_fee='600.00',
        )
        response = self.client.delete(f'/api/admin/specializations/{spec.pk}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        spec.refresh_from_db()
        self.assertFalse(spec.is_active)


