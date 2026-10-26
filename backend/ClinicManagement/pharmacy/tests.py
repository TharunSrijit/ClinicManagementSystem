from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apibackendapp.models import (
    User,
    Patient,
    DoctorProfile,
    PharmacistProfile,
    Consultation,
    MasterDosage,
    MasterMedicine,
    StockMaster,
    PriceList,
    Prescription,
    PrescriptionItem,
    Dispense,
    DispenseItem,
    PharmacyInvoice,
    PharmacyPayment,
)


class PharmacyWorkflowTests(APITestCase):
    def setUp(self):
        # Pharmacist user
        self.ph_user = User.objects.create_user(
            username='pharm_tester',
            email='pharm@clinic.test',
            password='Password123!',
            role='PHARMACIST'
        )
        self.pharmacist = PharmacistProfile.objects.create(
            user=self.ph_user,
            employee_id='PHM0001',
            qualification='B.Pharm',
            phone='9876543210'
        )

        # Doctor user & profile
        self.doc_user = User.objects.create_user(
            username='doc_tester',
            email='doc@clinic.test',
            password='Password123!',
            role='DOCTOR'
        )
        self.doctor = DoctorProfile.objects.create(
            user=self.doc_user,
            doctor_id='DOC0001',
            specialization='General Medicine',
            qualification='MBBS MD',
            registration_number='REG-DOC-001',
            consultation_fee='500.00'
        )

        # Patient
        self.patient = Patient.objects.create(
            patient_id='P10001',
            first_name='Rahul',
            last_name='Sharma',
            date_of_birth='1990-05-15',
            gender='MALE',
            phone='9876501234'
        )

        # Consultation
        self.consultation = Consultation.objects.create(
            doctor=self.doctor,
            patient=self.patient,
            consultation_date=timezone.now(),
            symptoms='Fever and cough',
            diagnosis='Acute Bronchitis'
        )

        # Dosage & Medicine
        self.dosage = MasterDosage.objects.create(dosage_name='500mg Tablet')
        self.med_amox = MasterMedicine.objects.create(
            medicine_name='Amoxicillin 500mg',
            generic_name='Amoxicillin',
            manufacturer='Cipla',
            category='Antibiotic',
            unit='Strip',
            is_active=True
        )
        self.med_pcm = MasterMedicine.objects.create(
            medicine_name='Paracetamol 650mg',
            generic_name='Paracetamol',
            manufacturer='Micro Labs',
            category='Analgesic',
            unit='Strip',
            is_active=True
        )

        # PriceList entries
        PriceList.objects.create(
            medicine=self.med_amox,
            purchase_price='5.00',
            selling_price='12.00',
            effective_from=timezone.localdate(),
            is_active=True
        )
        PriceList.objects.create(
            medicine=self.med_pcm,
            purchase_price='1.50',
            selling_price='3.50',
            effective_from=timezone.localdate(),
            is_active=True
        )

        # Stock in StockMaster
        future_date = timezone.localdate() + timedelta(days=365)
        self.stock_amox = StockMaster.objects.create(
            medicine=self.med_amox,
            batch_number='AMX-BATCH-1',
            expiry_date=future_date,
            quantity=100,
            purchase_price='5.00',
            selling_price='12.00'
        )
        self.stock_pcm = StockMaster.objects.create(
            medicine=self.med_pcm,
            batch_number='PCM-BATCH-1',
            expiry_date=future_date,
            quantity=200,
            purchase_price='1.50',
            selling_price='3.50'
        )

        # Prescription with 10 Amoxicillin and 20 Paracetamol
        self.prescription = Prescription.objects.create(
            prescription_number='RX00001',
            consultation=self.consultation,
            patient=self.patient,
            doctor=self.doctor,
            notes='Take with water after meals.'
        )
        self.rx_item_amox = PrescriptionItem.objects.create(
            prescription=self.prescription,
            medicine=self.med_amox,
            dosage=self.dosage,
            frequency='Thrice daily',
            duration='5 days',
            quantity=10
        )
        self.rx_item_pcm = PrescriptionItem.objects.create(
            prescription=self.prescription,
            medicine=self.med_pcm,
            dosage=self.dosage,
            frequency='Twice daily',
            duration='5 days',
            quantity=20
        )

        self.client.force_authenticate(user=self.ph_user)

    def test_01_prescription_initial_status_is_awaiting_billing(self):
        """Prescription queue shows status Awaiting Pharmacy Billing initially."""
        resp = self.client.get(f'/api/pharmacy/prescriptions/{self.prescription.id}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['dispensing_status'], 'AWAITING_BILLING')
        self.assertEqual(len(resp.data['items']), 2)
        # Check quantities and price
        amox_item = next(it for it in resp.data['items'] if it['medicine'] == self.med_amox.id)
        self.assertEqual(amox_item['prescribed_quantity'], 10)
        self.assertEqual(amox_item['dispensed_quantity'], 0)
        self.assertEqual(amox_item['remaining_quantity'], 10)
        self.assertEqual(amox_item['unit_price'], '12.00')

    def test_02_create_bill_partial_dispensing_for_affordability(self):
        """Pharmacist can bill partial quantity (6 out of 10) with reason."""
        resp = self.client.post(f'/api/pharmacy/prescriptions/{self.prescription.id}/create_bill/', {
            'items': [
                {'medicine_id': self.med_amox.id, 'quantity': 6, 'reason': 'Affordability'},
                {'medicine_id': self.med_pcm.id, 'quantity': 10, 'reason': 'Affordability'}
            ],
            'partial_reason': 'Patient Affordability',
            'notes': 'Patient requested 3-day supply due to budget constraints'
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        invoice_data = resp.data
        self.assertEqual(invoice_data['status'], 'PENDING')
        # Subtotal: (6 * 12.00) + (10 * 3.50) = 72 + 35 = 107.00
        self.assertEqual(Decimal(invoice_data['total_amount']), Decimal('107.00'))
        self.assertIn('Patient Affordability', invoice_data['dispense_notes'])

        # Verify prescription status is now Awaiting Payment
        rx_resp = self.client.get(f'/api/pharmacy/prescriptions/{self.prescription.id}/')
        self.assertEqual(rx_resp.data['dispensing_status'], 'AWAITING_PAYMENT')

    def test_03_payment_gating_blocks_unpaid_dispense(self):
        """Attempting to dispense medicine against an unpaid bill is strictly rejected."""
        bill_resp = self.client.post(f'/api/pharmacy/prescriptions/{self.prescription.id}/create_bill/', {
            'items': [{'medicine_id': self.med_amox.id, 'quantity': 5}]
        }, format='json')
        dispense_id = bill_resp.data['dispense']

        # Try to call dispense without paying
        disp_resp = self.client.post(f'/api/pharmacy/dispenses/{dispense_id}/dispense/')
        self.assertEqual(disp_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Payment required', disp_resp.data['detail'])

        # Stock should NOT have been deducted
        self.stock_amox.refresh_from_db()
        self.assertEqual(self.stock_amox.quantity, 100)

    def test_04_payment_settlement_and_successful_dispense(self):
        """After recording payment, dispensing succeeds and atomically updates inventory."""
        bill_resp = self.client.post(f'/api/pharmacy/prescriptions/{self.prescription.id}/create_bill/', {
            'items': [{'medicine_id': self.med_amox.id, 'quantity': 6}],
            'partial_reason': 'Patient Affordability'
        }, format='json')
        invoice_id = bill_resp.data['id']
        dispense_id = bill_resp.data['dispense']

        # Settle invoice
        pay_resp = self.client.post('/api/pharmacy/payments/', {
            'invoice': invoice_id,
            'amount': '72.00',
            'payment_method': 'CASH',
            'transaction_id': 'CASH-REC-001'
        }, format='json')
        self.assertEqual(pay_resp.status_code, status.HTTP_201_CREATED)

        # Check invoice is now PAID
        inv_check = self.client.get(f'/api/pharmacy/invoices/{invoice_id}/')
        self.assertEqual(inv_check.data['status'], 'PAID')

        # Prescription should be READY_FOR_DISPENSING
        rx_check = self.client.get(f'/api/pharmacy/prescriptions/{self.prescription.id}/')
        self.assertEqual(rx_check.data['dispensing_status'], 'READY_FOR_DISPENSING')

        # Now execute dispensing
        disp_resp = self.client.post(f'/api/pharmacy/dispenses/{dispense_id}/dispense/')
        self.assertEqual(disp_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(disp_resp.data['status'], 'DISPENSED')

        # Verify stock deducted: 100 - 6 = 94
        self.stock_amox.refresh_from_db()
        self.assertEqual(self.stock_amox.quantity, 94)

        # Verify prescription is now PARTIALLY_DISPENSED
        rx_check2 = self.client.get(f'/api/pharmacy/prescriptions/{self.prescription.id}/')
        self.assertEqual(rx_check2.data['dispensing_status'], 'PARTIALLY_DISPENSED')
        amox_item = next(it for it in rx_check2.data['items'] if it['medicine'] == self.med_amox.id)
        self.assertEqual(amox_item['dispensed_quantity'], 6)
        self.assertEqual(amox_item['remaining_quantity'], 4)

    def test_05_subsequent_dispensing_completes_prescription(self):
        """Dispensing remaining balance marks prescription FULLY_DISPENSED."""
        # 1. First partial bill (6 Amoxicillin + 20 PCM)
        bill1 = self.client.post(f'/api/pharmacy/prescriptions/{self.prescription.id}/create_bill/', {
            'items': [
                {'medicine_id': self.med_amox.id, 'quantity': 6},
                {'medicine_id': self.med_pcm.id, 'quantity': 20}
            ]
        }, format='json')
        inv1_id = bill1.data['id']
        disp1_id = bill1.data['dispense']

        # Pay & dispense bill 1
        self.client.post('/api/pharmacy/payments/', {
            'invoice': inv1_id,
            'amount': bill1.data['total_amount'],
            'payment_method': 'UPI',
            'transaction_id': 'UPI-7718'
        }, format='json')
        self.client.post(f'/api/pharmacy/dispenses/{disp1_id}/dispense/')

        # 2. Later, patient purchases the remaining 4 Amoxicillin
        bill2 = self.client.post(f'/api/pharmacy/prescriptions/{self.prescription.id}/create_bill/', {
            'items': [{'medicine_id': self.med_amox.id, 'quantity': 4}]
        }, format='json')
        self.assertEqual(bill2.status_code, status.HTTP_201_CREATED)
        inv2_id = bill2.data['id']
        disp2_id = bill2.data['dispense']

        # Pay & dispense bill 2
        self.client.post('/api/pharmacy/payments/', {
            'invoice': inv2_id,
            'amount': bill2.data['total_amount'],
            'payment_method': 'CARD'
        }, format='json')
        self.client.post(f'/api/pharmacy/dispenses/{disp2_id}/dispense/')

        # Verify prescription is now FULLY_DISPENSED
        rx_final = self.client.get(f'/api/pharmacy/prescriptions/{self.prescription.id}/')
        self.assertEqual(rx_final.data['dispensing_status'], 'FULLY_DISPENSED')
        amox_item = next(it for it in rx_final.data['items'] if it['medicine'] == self.med_amox.id)
        self.assertEqual(amox_item['remaining_quantity'], 0)

        # Total stock deducted: 10 Amox (100 - 10 = 90) and 20 PCM (200 - 20 = 180)
        self.stock_amox.refresh_from_db()
        self.stock_pcm.refresh_from_db()
        self.assertEqual(self.stock_amox.quantity, 90)
        self.assertEqual(self.stock_pcm.quantity, 180)

    def test_06_reject_quantity_exceeding_prescription(self):
        """Pharmacist cannot bill more than remaining un-dispensed quantity."""
        resp = self.client.post(f'/api/pharmacy/prescriptions/{self.prescription.id}/create_bill/', {
            'items': [{'medicine_id': self.med_amox.id, 'quantity': 15}]
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('exceeds remaining', resp.data['detail'])

    def test_07_reject_duplicate_pending_bill(self):
        """Cannot create two pending bills simultaneously for the same prescription."""
        self.client.post(f'/api/pharmacy/prescriptions/{self.prescription.id}/create_bill/', {
            'items': [{'medicine_id': self.med_amox.id, 'quantity': 5}]
        }, format='json')

        # Second attempt while first is pending
        resp2 = self.client.post(f'/api/pharmacy/prescriptions/{self.prescription.id}/create_bill/', {
            'items': [{'medicine_id': self.med_amox.id, 'quantity': 5}]
        }, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already exists', resp2.data['detail'])
