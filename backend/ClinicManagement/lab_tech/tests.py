import datetime

from rest_framework import status
from rest_framework.test import APITestCase

from apibackendapp.models import (
    User,
    DoctorProfile,
    LabTechnicianProfile,
    Patient,
    MasterLabTest,
    LabTestOrder,
    LabInvoice,
)


class LabWorkflowTests(APITestCase):
    """Doctor requests -> bill -> payment -> sample -> processing -> result -> doctor sees it."""

    @classmethod
    def setUpTestData(cls):
        cls.doctor_user = User.objects.create_user(
            username='lab_doc', email='lab_doc@clinic.com', password='Pass12345!', role='DOCTOR',
            first_name='Meera', last_name='Nair',
        )
        cls.doctor = DoctorProfile.objects.create(
            user=cls.doctor_user, doctor_id='DOC_LAB', specialization='General',
            qualification='MBBS', registration_number='REG_LAB', consultation_fee=300,
            available_from=datetime.time(9, 0), available_to=datetime.time(17, 0), slot_minutes=15,
        )
        cls.tech_user = User.objects.create_user(
            username='lab_tech', email='lab_tech@clinic.com', password='Pass12345!', role='LAB_TECHNICIAN',
            first_name='Ravi', last_name='Kumar',
        )
        cls.tech = LabTechnicianProfile.objects.create(
            user=cls.tech_user, employee_id='LT001', qualification='DMLT', phone='9000000001',
        )
        cls.patient = Patient.objects.create(
            patient_id='PAT_LAB_01', first_name='Anu', last_name='Thomas',
            date_of_birth=datetime.date(1990, 5, 1), gender='FEMALE',
            phone='9000000002', email='anu@example.com',
        )
        cls.test = MasterLabTest.objects.create(
            test_code='FBS', test_name='Fasting Blood Sugar', price=200,
            normal_range='70-100', unit='mg/dL', is_active=True,
        )

    def make_order(self):
        return LabTestOrder.objects.create(patient=self.patient, doctor=self.doctor, test=self.test)

    def post(self, order, action, data=None):
        return self.client.post(f'/api/lab/lab-orders/{order.id}/{action}/', data or {}, format='json')

    def setUp(self):
        self.client.force_authenticate(self.tech_user)

    def test_order_numbers_are_generated_and_unique(self):
        a, b = self.make_order(), self.make_order()
        self.assertTrue(a.order_number.startswith('LAB'))
        self.assertNotEqual(a.order_number, b.order_number)

    def test_full_workflow_reaches_doctor(self):
        order = self.make_order()

        # Sample cannot be collected before payment
        self.assertEqual(self.post(order, 'collect_sample').status_code, status.HTTP_400_BAD_REQUEST)

        resp = self.post(order, 'generate_bill', {'discount': '20'})
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data['status'], 'PAYMENT_PENDING')
        self.assertEqual(resp.data['invoice']['total_amount'], '180.00')

        # Partial payment keeps it pending
        resp = self.post(order, 'record_payment', {'amount': '80', 'payment_method': 'CASH'})
        self.assertEqual(resp.data['status'], 'PAYMENT_PENDING')
        self.assertEqual(resp.data['invoice']['status'], 'PARTIAL')

        # Over-payment is rejected
        resp = self.post(order, 'record_payment', {'amount': '500', 'payment_method': 'CASH'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

        # UPI needs a reference
        resp = self.post(order, 'record_payment', {'payment_method': 'UPI'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

        # Pay the balance
        resp = self.post(order, 'record_payment', {'payment_method': 'UPI', 'transaction_id': 'UPI123'})
        self.assertEqual(resp.data['status'], 'PAID')
        self.assertEqual(resp.data['invoice']['status'], 'PAID')
        self.assertEqual(resp.data['invoice']['balance'], '0.00')

        self.assertEqual(self.post(order, 'collect_sample').data['status'], 'SAMPLE_COLLECTED')
        # Result cannot be entered before processing
        self.assertEqual(self.post(order, 'submit_result', {'result_value': '90'}).status_code, 400)
        self.assertEqual(self.post(order, 'start_processing').data['status'], 'PROCESSING')

        resp = self.post(order, 'submit_result', {
            'result_value': '128', 'result_status': 'ABNORMAL', 'remarks': 'High',
        })
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data['status'], 'COMPLETED')
        self.assertIsNotNone(resp.data['completed_at'])
        self.assertEqual(resp.data['result']['technician_name'], 'Ravi Kumar')

        # Second submission is rejected
        self.assertEqual(self.post(order, 'submit_result', {'result_value': '1'}).status_code, 400)

        # Doctor now sees the result
        self.client.force_authenticate(self.doctor_user)
        resp = self.client.get('/api/doctor/lab-orders/')
        self.assertEqual(resp.status_code, 200)
        rows = resp.data if isinstance(resp.data, list) else resp.data['results']
        self.assertEqual(rows[0]['status'], 'COMPLETED')
        self.assertEqual(rows[0]['result']['result_value'], '128')
        self.assertEqual(rows[0]['unit'], 'mg/dL')

    def test_status_filter_and_summary(self):
        new_order = self.make_order()
        billed = self.make_order()
        self.post(billed, 'generate_bill')

        resp = self.client.get('/api/lab/lab-orders/', {'status': 'ORDERED'})
        ids = [r['id'] for r in (resp.data if isinstance(resp.data, list) else resp.data['results'])]
        self.assertEqual(ids, [new_order.id])

        resp = self.client.get('/api/lab/lab-orders/', {'status': 'ACTIVE'})
        rows = resp.data if isinstance(resp.data, list) else resp.data['results']
        self.assertEqual(len(rows), 2)

        summary = self.client.get('/api/lab/lab-orders/summary/').data
        self.assertEqual(summary['by_status']['ORDERED'], 1)
        self.assertEqual(summary['by_status']['PAYMENT_PENDING'], 1)
        self.assertEqual(summary['active'], 2)

    def test_cancel_only_before_payment(self):
        order = self.make_order()
        self.post(order, 'generate_bill')
        resp = self.post(order, 'cancel')
        self.assertEqual(resp.data['status'], 'CANCELLED')
        self.assertEqual(LabInvoice.objects.get(lab_order=order).status, 'CANCELLED')

        paid = self.make_order()
        self.post(paid, 'generate_bill')
        self.post(paid, 'record_payment', {'payment_method': 'CASH'})
        self.assertEqual(self.post(paid, 'cancel').status_code, 400)

    def test_orders_cannot_be_edited_directly(self):
        order = self.make_order()
        resp = self.client.patch(f'/api/lab/lab-orders/{order.id}/', {'status': 'COMPLETED'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_doctor_cannot_change_status(self):
        order = self.make_order()
        self.client.force_authenticate(self.doctor_user)
        self.client.patch(f'/api/doctor/lab-orders/{order.id}/', {'status': 'COMPLETED'}, format='json')
        order.refresh_from_db()
        self.assertEqual(order.status, 'ORDERED')