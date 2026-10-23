// ============================================================
// CMS - COMMON LOCAL STORAGE
// File: js/storage.js
// Used by: Admin, Receptionist, Doctor, Lab Technician,
//          Pharmacist
// ============================================================


// ============================================================
// 1. STORAGE KEYS
// ============================================================

const STORAGE_KEYS = {

    // Admin
    doctors: "cms_doctors",
    staff: "cms_staff",
    users: "cms_users",

    // Receptionist
    patients: "cms_patients",
    appointments: "cms_appointments",

    // Doctor
    consultations: "cms_consultations",
    prescriptions: "cms_prescriptions",

    // Lab
    labTests: "cms_lab_tests",
    labOrders: "cms_lab_orders",

    // Pharmacy
    medicines: "cms_medicines",
    pharmacyPrescriptions: "cms_pharmacy_prescriptions",

    // Billing
    billing: "cms_billing",

    // Common
    notifications: "cms_notifications"
};


// ============================================================
// 2. GET DATA
// ============================================================

function getData(key) {

    const data = localStorage.getItem(key);

    if (!data) {
        return [];
    }

    try {

        return JSON.parse(data);

    } catch (error) {

        console.error("Error reading localStorage:", error);

        return [];
    }
}


// ============================================================
// 3. SAVE DATA
// ============================================================

function saveData(key, data) {

    try {

        localStorage.setItem(
            key,
            JSON.stringify(data)
        );

        return true;

    } catch (error) {

        console.error("Error saving data:", error);

        alert("Unable to save data.");

        return false;
    }
}


// ============================================================
// 4. REMOVE DATA
// ============================================================

function removeData(key) {

    localStorage.removeItem(key);
}


// ============================================================
// 5. CLEAR ALL CMS DATA
// ============================================================

function clearAllCMSData() {

    const confirmClear = confirm(
        "Are you sure you want to delete all CMS data?"
    );

    if (!confirmClear) {
        return;
    }

    Object.values(STORAGE_KEYS).forEach(function (key) {

        localStorage.removeItem(key);

    });

    alert("All CMS data has been cleared.");

    location.reload();
}


// ============================================================
// 6. GENERATE UNIQUE ID
// ============================================================

function generateId(prefix) {

    return prefix + Date.now();
}


// ============================================================
// 7. INITIALIZE STORAGE
// ============================================================

function initializeStorage() {

    Object.values(STORAGE_KEYS).forEach(function (key) {

        if (!localStorage.getItem(key)) {

            localStorage.setItem(
                key,
                JSON.stringify([])
            );

        }

    });

}


// ============================================================
// 8. DOCTOR FUNCTIONS
// ============================================================

function getDoctors() {

    return getData(STORAGE_KEYS.doctors);
}


function saveDoctors(doctors) {

    return saveData(
        STORAGE_KEYS.doctors,
        doctors
    );
}


// ============================================================
// 9. STAFF FUNCTIONS
// ============================================================

function getStaff() {

    return getData(STORAGE_KEYS.staff);
}


function saveStaff(staff) {

    return saveData(
        STORAGE_KEYS.staff,
        staff
    );
}


// ============================================================
// 10. USER FUNCTIONS
// ============================================================

function getUsers() {

    return getData(STORAGE_KEYS.users);
}


function saveUsers(users) {

    return saveData(
        STORAGE_KEYS.users,
        users
    );
}


// ============================================================
// 11. PATIENT FUNCTIONS
// ============================================================

function getPatients() {

    return getData(STORAGE_KEYS.patients);
}


function savePatients(patients) {

    return saveData(
        STORAGE_KEYS.patients,
        patients
    );
}


// ============================================================
// 12. APPOINTMENT FUNCTIONS
// ============================================================

function getAppointments() {

    return getData(STORAGE_KEYS.appointments);
}


function saveAppointments(appointments) {

    return saveData(
        STORAGE_KEYS.appointments,
        appointments
    );
}


// ============================================================
// 13. CONSULTATION FUNCTIONS
// ============================================================

function getConsultations() {

    return getData(STORAGE_KEYS.consultations);
}


function saveConsultations(consultations) {

    return saveData(
        STORAGE_KEYS.consultations,
        consultations
    );
}


// ============================================================
// 14. PRESCRIPTION FUNCTIONS
// ============================================================

function getPrescriptions() {

    return getData(STORAGE_KEYS.prescriptions);
}


function savePrescriptions(prescriptions) {

    return saveData(
        STORAGE_KEYS.prescriptions,
        prescriptions
    );
}


// ============================================================
// 15. LAB TEST FUNCTIONS
// ============================================================

function getLabTests() {

    return getData(STORAGE_KEYS.labTests);
}


function saveLabTests(labTests) {

    return saveData(
        STORAGE_KEYS.labTests,
        labTests
    );
}


function getLabOrders() {

    return getData(STORAGE_KEYS.labOrders);
}


function saveLabOrders(labOrders) {

    return saveData(
        STORAGE_KEYS.labOrders,
        labOrders
    );
}


// ============================================================
// 16. BILLING FUNCTIONS
// ============================================================

function getBilling() {

    return getData(STORAGE_KEYS.billing);
}


function saveBilling(bills) {

    return saveData(
        STORAGE_KEYS.billing,
        bills
    );
}


// ============================================================
// 17. MEDICINE FUNCTIONS
// ============================================================

function getMedicines() {

    return getData(STORAGE_KEYS.medicines);
}


function saveMedicines(medicines) {

    return saveData(
        STORAGE_KEYS.medicines,
        medicines
    );
}


// ============================================================
// 18. PHARMACY PRESCRIPTION FUNCTIONS
// ============================================================

function getPharmacyPrescriptions() {

    return getData(
        STORAGE_KEYS.pharmacyPrescriptions
    );
}


function savePharmacyPrescriptions(
    prescriptions
) {

    return saveData(
        STORAGE_KEYS.pharmacyPrescriptions,
        prescriptions
    );
}


// ============================================================
// 19. NOTIFICATION FUNCTIONS
// ============================================================

function getNotifications() {

    return getData(
        STORAGE_KEYS.notifications
    );
}


function saveNotifications(notifications) {

    return saveData(
        STORAGE_KEYS.notifications,
        notifications
    );
}


// ============================================================
// 20. FIND ITEM BY ID
// ============================================================

function findById(key, id) {

    const data = getData(key);

    return data.find(function (item) {

        return item.id === id;

    });
}


// ============================================================
// 21. DELETE ITEM BY ID
// ============================================================

function deleteById(key, id) {

    const data = getData(key);

    const updatedData = data.filter(function (item) {

        return item.id !== id;

    });

    saveData(key, updatedData);

    return updatedData;
}


// ============================================================
// 22. UPDATE ITEM BY ID
// ============================================================

function updateById(key, id, updatedItem) {

    const data = getData(key);

    const index = data.findIndex(function (item) {

        return item.id === id;

    });

    if (index === -1) {

        return false;

    }

    data[index] = updatedItem;

    saveData(key, data);

    return true;
}


// ============================================================
// 23. ADD ITEM
// ============================================================

function addItem(key, item) {

    const data = getData(key);

    data.push(item);

    saveData(key, data);

    return item;
}


// ============================================================
// 24. CHECK EMAIL EXISTS
// ============================================================

function emailExists(email) {

    const users = getUsers();

    return users.some(function (user) {

        return user.email.toLowerCase() ===
               email.toLowerCase();

    });
}


// ============================================================
// 25. GET ACTIVE USERS
// ============================================================

function getActiveUsers() {

    const users = getUsers();

    return users.filter(function (user) {

        return user.status === "Active";

    });
}


// ============================================================
// 26. GET ACTIVE DOCTORS
// ============================================================

function getActiveDoctors() {

    const doctors = getDoctors();

    return doctors.filter(function (doctor) {

        return doctor.status === "Active";

    });
}


// ============================================================
// 27. GET ACTIVE STAFF
// ============================================================

function getActiveStaff() {

    const staff = getStaff();

    return staff.filter(function (person) {

        return person.status === "Active";

    });
}


// ============================================================
// 28. INITIALIZE WHEN PAGE LOADS
// ============================================================

initializeStorage();