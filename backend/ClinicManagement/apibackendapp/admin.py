from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    User,
    ReceptionistProfile,
    DoctorProfile,
    LabTechnicianProfile,
    PharmacistProfile,
    Patient,
    MedicalHistory,
    Appointment,
    ConsultationInvoice,
    ConsultationPayment,
    Token,
    Consultation,
    MasterDosage,
    MasterMedicine,
    Prescription,
    PrescriptionItem,
    MasterLabTest,
    LabTestOrder,
    LabTestResult,
    Dispense,
    DispenseItem,
    StockMaster,
    StockTransaction,
    PriceList,
    LabInvoice,
    LabPayment,
    PharmacyInvoice,
    PharmacyPayment,
)

admin.site.register(User, BaseUserAdmin)
admin.site.register(ReceptionistProfile)
admin.site.register(DoctorProfile)
admin.site.register(LabTechnicianProfile)
admin.site.register(PharmacistProfile)
admin.site.register(Patient)
admin.site.register(MedicalHistory)
admin.site.register(Appointment)
admin.site.register(ConsultationInvoice)
admin.site.register(ConsultationPayment)
admin.site.register(Token)
admin.site.register(Consultation)
admin.site.register(MasterDosage)
admin.site.register(MasterMedicine)
admin.site.register(Prescription)
admin.site.register(PrescriptionItem)
admin.site.register(MasterLabTest)
admin.site.register(LabTestOrder)
admin.site.register(LabTestResult)
admin.site.register(Dispense)
admin.site.register(DispenseItem)
admin.site.register(StockMaster)
admin.site.register(StockTransaction)
admin.site.register(PriceList)
admin.site.register(LabInvoice)
admin.site.register(LabPayment)
admin.site.register(PharmacyInvoice)
admin.site.register(PharmacyPayment)
