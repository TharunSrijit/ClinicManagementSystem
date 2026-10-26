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
    StockMaster,
    StockTransaction,
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
