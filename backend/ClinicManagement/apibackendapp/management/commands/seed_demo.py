import datetime
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apibackendapp.models import (
    User,
    ReceptionistProfile,
    DoctorProfile,
    LabTechnicianProfile,
    PharmacistProfile,
    Patient,
    MasterDosage,
    MasterMedicine,
    MasterLabTest,
    PriceList,
    StockMaster,
)

DEV_PASSWORD = "DemoPassword123!"


class Command(BaseCommand):
    help = "Seeds demo data for development. Refuses to run if DEBUG is False. Safe to run repeatedly."

    def handle(self, *args, **options):
        if not getattr(settings, 'DEBUG', False):
            raise CommandError("seed_demo can only be run in development when DEBUG=True.")

        self.stdout.write("Seeding demo data...")

        with transaction.atomic():
            # 1. Admin
            admin_user, _ = User.objects.get_or_create(
                username="admin",
                defaults={
                    "email": "admin@clinic.com",
                    "role": "ADMIN",
                    "first_name": "System",
                    "last_name": "Admin",
                    "is_staff": True,
                    "is_superuser": True,
                }
            )
            admin_user.role = "ADMIN"
            admin_user.is_staff = True
            admin_user.is_superuser = True
            admin_user.set_password(DEV_PASSWORD)
            admin_user.save()

            # 2. Receptionist
            reception_user, _ = User.objects.get_or_create(
                username="reception",
                defaults={
                    "email": "reception@clinic.com",
                    "role": "RECEPTIONIST",
                    "first_name": "Sneha",
                    "last_name": "Rao",
                    "is_staff": True,
                }
            )
            reception_user.role = "RECEPTIONIST"
            reception_user.is_staff = True
            reception_user.set_password(DEV_PASSWORD)
            reception_user.save()

            rec_prof = ReceptionistProfile.objects.filter(user=reception_user).first() or \
                       ReceptionistProfile.objects.filter(employee_id="REC0001").first()
            if rec_prof:
                rec_prof.user = reception_user
                rec_prof.employee_id = "REC0001"
                rec_prof.phone = "9876543210"
                rec_prof.save()
            else:
                ReceptionistProfile.objects.create(
                    user=reception_user,
                    employee_id="REC0001",
                    phone="9876543210",
                )

            # 3. Doctor 1 (Primary)
            doc1_user, _ = User.objects.get_or_create(
                username="doctor",
                defaults={
                    "email": "doctor@clinic.com",
                    "role": "DOCTOR",
                    "first_name": "Arun",
                    "last_name": "Kumar",
                    "is_staff": True,
                }
            )
            doc1_user.role = "DOCTOR"
            doc1_user.is_staff = True
            doc1_user.set_password(DEV_PASSWORD)
            doc1_user.save()

            doc1_prof = DoctorProfile.objects.filter(user=doc1_user).first() or \
                        DoctorProfile.objects.filter(doctor_id="DOC0001").first()
            if doc1_prof:
                doc1_prof.user = doc1_user
                doc1_prof.doctor_id = "DOC0001"
                doc1_prof.specialization = "Cardiology"
                doc1_prof.qualification = "MBBS, MD"
                doc1_prof.registration_number = "REG-10001"
                doc1_prof.consultation_fee = 500.00
                doc1_prof.available_from = datetime.time(9, 0)
                doc1_prof.available_to = datetime.time(17, 0)
                doc1_prof.slot_minutes = 15
                doc1_prof.save()
            else:
                DoctorProfile.objects.create(
                    user=doc1_user,
                    doctor_id="DOC0001",
                    specialization="Cardiology",
                    qualification="MBBS, MD",
                    registration_number="REG-10001",
                    consultation_fee=500.00,
                    available_from=datetime.time(9, 0),
                    available_to=datetime.time(17, 0),
                    slot_minutes=15,
                )

            # 4. Doctor 2 (Extra doctor 1)
            doc2_user, _ = User.objects.get_or_create(
                username="doctor2",
                defaults={
                    "email": "doctor2@clinic.com",
                    "role": "DOCTOR",
                    "first_name": "Priya",
                    "last_name": "Sharma",
                    "is_staff": True,
                }
            )
            doc2_user.role = "DOCTOR"
            doc2_user.is_staff = True
            doc2_user.set_password(DEV_PASSWORD)
            doc2_user.save()

            doc2_prof = DoctorProfile.objects.filter(user=doc2_user).first() or \
                        DoctorProfile.objects.filter(doctor_id="DOC0002").first()
            if doc2_prof:
                doc2_prof.user = doc2_user
                doc2_prof.doctor_id = "DOC0002"
                doc2_prof.specialization = "Pediatrics"
                doc2_prof.qualification = "MBBS, DCH"
                doc2_prof.registration_number = "REG-10002"
                doc2_prof.consultation_fee = 400.00
                doc2_prof.available_from = datetime.time(9, 0)
                doc2_prof.available_to = datetime.time(17, 0)
                doc2_prof.slot_minutes = 15
                doc2_prof.save()
            else:
                DoctorProfile.objects.create(
                    user=doc2_user,
                    doctor_id="DOC0002",
                    specialization="Pediatrics",
                    qualification="MBBS, DCH",
                    registration_number="REG-10002",
                    consultation_fee=400.00,
                    available_from=datetime.time(9, 0),
                    available_to=datetime.time(17, 0),
                    slot_minutes=15,
                )

            # 5. Doctor 3 (Extra doctor 2)
            doc3_user, _ = User.objects.get_or_create(
                username="doctor3",
                defaults={
                    "email": "doctor3@clinic.com",
                    "role": "DOCTOR",
                    "first_name": "Vikram",
                    "last_name": "Patel",
                    "is_staff": True,
                }
            )
            doc3_user.role = "DOCTOR"
            doc3_user.is_staff = True
            doc3_user.set_password(DEV_PASSWORD)
            doc3_user.save()

            doc3_prof = DoctorProfile.objects.filter(user=doc3_user).first() or \
                        DoctorProfile.objects.filter(doctor_id="DOC0003").first()
            if doc3_prof:
                doc3_prof.user = doc3_user
                doc3_prof.doctor_id = "DOC0003"
                doc3_prof.specialization = "Dermatology"
                doc3_prof.qualification = "MBBS, DVD"
                doc3_prof.registration_number = "REG-10003"
                doc3_prof.consultation_fee = 450.00
                doc3_prof.available_from = datetime.time(10, 0)
                doc3_prof.available_to = datetime.time(16, 0)
                doc3_prof.slot_minutes = 15
                doc3_prof.save()
            else:
                DoctorProfile.objects.create(
                    user=doc3_user,
                    doctor_id="DOC0003",
                    specialization="Dermatology",
                    qualification="MBBS, DVD",
                    registration_number="REG-10003",
                    consultation_fee=450.00,
                    available_from=datetime.time(10, 0),
                    available_to=datetime.time(16, 0),
                    slot_minutes=15,
                )

            # 6. Lab Technician
            lab_user, _ = User.objects.get_or_create(
                username="lab",
                defaults={
                    "email": "lab@clinic.com",
                    "role": "LAB_TECHNICIAN",
                    "first_name": "Ramesh",
                    "last_name": "Verma",
                    "is_staff": True,
                }
            )
            lab_user.role = "LAB_TECHNICIAN"
            lab_user.is_staff = True
            lab_user.set_password(DEV_PASSWORD)
            lab_user.save()

            lab_prof = LabTechnicianProfile.objects.filter(user=lab_user).first() or \
                       LabTechnicianProfile.objects.filter(employee_id="LAB0001").first()
            if lab_prof:
                lab_prof.user = lab_user
                lab_prof.employee_id = "LAB0001"
                lab_prof.qualification = "B.Sc MLT"
                lab_prof.phone = "9876543211"
                lab_prof.save()
            else:
                LabTechnicianProfile.objects.create(
                    user=lab_user,
                    employee_id="LAB0001",
                    qualification="B.Sc MLT",
                    phone="9876543211",
                )

            # 7. Pharmacist
            pharmacy_user, _ = User.objects.get_or_create(
                username="pharmacy",
                defaults={
                    "email": "pharmacy@clinic.com",
                    "role": "PHARMACIST",
                    "first_name": "Ananya",
                    "last_name": "Iyer",
                    "is_staff": True,
                }
            )
            pharmacy_user.role = "PHARMACIST"
            pharmacy_user.is_staff = True
            pharmacy_user.set_password(DEV_PASSWORD)
            pharmacy_user.save()

            pharm_prof = PharmacistProfile.objects.filter(user=pharmacy_user).first() or \
                         PharmacistProfile.objects.filter(employee_id="PHARM0001").first()
            if pharm_prof:
                pharm_prof.user = pharmacy_user
                pharm_prof.employee_id = "PHARM0001"
                pharm_prof.qualification = "B.Pharm"
                pharm_prof.phone = "9876543212"
                pharm_prof.save()
            else:
                PharmacistProfile.objects.create(
                    user=pharmacy_user,
                    employee_id="PHARM0001",
                    qualification="B.Pharm",
                    phone="9876543212",
                )

            # 8. Sample Patients
            Patient.objects.update_or_create(
                patient_id="PAT0001",
                defaults={
                    "first_name": "John",
                    "last_name": "Doe",
                    "date_of_birth": datetime.date(1990, 1, 15),
                    "gender": "MALE",
                    "blood_group": "O+",
                    "phone": "9876500001",
                    "email": "john.doe@example.com",
                    "address": "123 Main St, Bangalore",
                    "emergency_contact_name": "Jane Doe",
                    "emergency_contact_phone": "9876500002",
                }
            )

            # 9. Master data
            d1, _ = MasterDosage.objects.get_or_create(dosage_name="Once Daily (OD)", defaults={"description": "Take once a day"})
            d2, _ = MasterDosage.objects.get_or_create(dosage_name="Twice Daily (BD)", defaults={"description": "Take twice a day"})
            d3, _ = MasterDosage.objects.get_or_create(dosage_name="Thrice Daily (TDS)", defaults={"description": "Take three times a day"})

            m1, _ = MasterMedicine.objects.get_or_create(
                medicine_name="Paracetamol 500mg",
                defaults={"generic_name": "Acetaminophen", "category": "Tablet", "unit": "Tablet"}
            )
            m2, _ = MasterMedicine.objects.get_or_create(
                medicine_name="Amoxicillin 250mg",
                defaults={"generic_name": "Amoxicillin", "category": "Capsule", "unit": "Capsule"}
            )
            m3, _ = MasterMedicine.objects.get_or_create(
                medicine_name="Cetirizine 10mg",
                defaults={"generic_name": "Cetirizine", "category": "Tablet", "unit": "Tablet"}
            )

            StockMaster.objects.get_or_create(
                medicine=m1,
                batch_number="BATCH001",
                defaults={"expiry_date": datetime.date(2027, 12, 31), "quantity": 100, "purchase_price": 1.50, "selling_price": 2.50}
            )
            StockMaster.objects.get_or_create(
                medicine=m2,
                batch_number="BATCH002",
                defaults={"expiry_date": datetime.date(2027, 12, 31), "quantity": 80, "purchase_price": 5.00, "selling_price": 8.00}
            )
            StockMaster.objects.get_or_create(
                medicine=m3,
                batch_number="BATCH003",
                defaults={"expiry_date": datetime.date(2027, 12, 31), "quantity": 50, "purchase_price": 2.00, "selling_price": 3.00}
            )

            t1, _ = MasterLabTest.objects.get_or_create(
                test_code="LAB001",
                defaults={"test_name": "Complete Blood Count (CBC)", "price": 350.00}
            )
            t2, _ = MasterLabTest.objects.get_or_create(
                test_code="LAB002",
                defaults={"test_name": "Lipid Profile", "price": 600.00}
            )
            t3, _ = MasterLabTest.objects.get_or_create(
                test_code="LAB003",
                defaults={"test_name": "Blood Glucose (Fasting)", "price": 150.00}
            )

            PriceList.objects.get_or_create(
                medicine=m1,
                defaults={
                    "purchase_price": 1.50,
                    "selling_price": 2.50,
                    "effective_from": datetime.date(2026, 1, 1),
                }
            )

        self.stdout.write(self.style.SUCCESS(f"Successfully seeded demo data! Dev password is: {DEV_PASSWORD}"))
