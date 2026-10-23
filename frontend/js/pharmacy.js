// ============================================================
// CMS - PHARMACY JAVASCRIPT
// File: js/pharmacy.js
//
// Pharmacy module only.
// Medicine master source: cms_medicines
// Billing source: cms_billing
// Receipt source: cms_receipts
// Prescriptions source: cms_prescriptions
//
// Workflow Rules:
// 1. Doctor creates Prescription (cms_prescriptions)
// 2. Pharmacy generates Bill (cms_billing) -> status: "Unpaid" (NO stock deduction)
// 3. Payment is processed -> status: "Paid" (NO stock deduction)
// 4. Medicine is Dispensed -> stock deducted ONCE from cms_medicines
// 5. Dispensing is strictly BLOCKED if bill is Unpaid
// 6. Dispensing cannot occur more than once for any prescription/bill
// ============================================================


// ============================================================
// 1. AUTH GUARD
// ============================================================

const loggedInUser = JSON.parse(
    localStorage.getItem("loggedInUser") || "null"
);

if (
    !loggedInUser ||
    (loggedInUser.role !== "pharmacist" &&
     loggedInUser.role !== "admin" &&
     loggedInUser.userRole !== "pharmacist" &&
     loggedInUser.userRole !== "admin")
) {
    window.location.href = "../index.html";
}


// ============================================================
// 2. LOGOUT & USER UI
// ============================================================

function logout() {
    if (typeof confirm === "function" && !confirm("Are you sure you want to logout?")) {
        return;
    }

    localStorage.removeItem("loggedInUser");
    window.location.href = "../index.html";
}

function getInitials(name) {
    return (name || "?")
        .split(" ")
        .map(function (w) { return w[0]; })
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

function initPharmacyUI() {
    if (!loggedInUser) return;

    const name = loggedInUser.fullName ||
                 loggedInUser.name ||
                 loggedInUser.username ||
                 "Pharmacist";

    const initials = getInitials(name);

    const sidebarAvatar = document.getElementById("sidebarAvatar");
    const sidebarName = document.getElementById("sidebarName");
    const topbarAvatar = document.getElementById("topbarAvatar");
    const topbarName = document.getElementById("topbarName");
    const topbarDate = document.getElementById("topbarDate");
    const timeOfDay = document.getElementById("timeOfDay");
    const welcomeName = document.getElementById("welcomeName");

    if (sidebarAvatar) sidebarAvatar.textContent = initials;
    if (sidebarName) sidebarName.textContent = name;
    if (topbarAvatar) topbarAvatar.textContent = initials;
    if (topbarName) topbarName.textContent = name;
    if (welcomeName) welcomeName.textContent = "Welcome back, " + name + "!";

    const now = new Date();
    const hour = now.getHours();
    if (timeOfDay) {
        timeOfDay.textContent = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    }
    if (topbarDate) {
        topbarDate.textContent = now.toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    }
}


// ============================================================
// 3. COMMON HELPERS
// ============================================================

function getToday() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showMessage(elementId, message, type = "success") {
    const element = document.getElementById(elementId);
    if (!element) {
        return;
    }

    const className =
        type === "error"
            ? "badge badge-danger"
            : "badge badge-success";

    element.innerHTML = `
        <span class="${className}">
            ${escapeHtml(message)}
        </span>
    `;
}

function getExpiryDate(medicine) {
    return medicine?.expiryDate || medicine?.expiry || "";
}

function isMedicineExpired(medicine) {
    const expiry = getExpiryDate(medicine);
    if (!expiry) {
        return false;
    }

    const today = new Date();
    const expiryDate = new Date(expiry);

    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    return expiryDate < today;
}

function isMedicineActive(medicine) {
    return String(medicine?.status || "Active").toLowerCase() === "active";
}

function isMedicineAvailable(medicine) {
    return (
        medicine &&
        isMedicineActive(medicine) &&
        Number(medicine.stock) > 0 &&
        !isMedicineExpired(medicine)
    );
}


// ============================================================
// 4. MEDICINE MASTER - SINGLE SOURCE OF TRUTH
// ============================================================

function getStoredMedicines() {
    try {
        const raw = localStorage.getItem("cms_medicines");
        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("Error reading cms_medicines:", error);
        return [];
    }
}

function saveStoredMedicines(data) {
    if (!Array.isArray(data)) {
        return false;
    }

    try {
        localStorage.setItem("cms_medicines", JSON.stringify(data));
        medicines = data;
        return true;
    } catch (error) {
        console.error("Error saving cms_medicines:", error);
        return false;
    }
}

let medicines = getStoredMedicines();

function findMedicineById(id, source = medicines) {
    if (!id) {
        return null;
    }

    const targetId = String(id).trim().toLowerCase();

    return source.find(function (medicine) {
        return String(medicine.id).trim().toLowerCase() === targetId;
    }) || null;
}

function findMedicineByName(name, source = medicines) {
    if (!name) {
        return null;
    }

    const cleanName = String(name).trim().toLowerCase();

    // Exact match
    let medicine = source.find(function (item) {
        return String(item.name || "").trim().toLowerCase() === cleanName;
    });

    if (medicine) {
        return medicine;
    }

    // Partial compatibility
    medicine = source.find(function (item) {
        const itemName = String(item.name || "").trim().toLowerCase();
        return (
            itemName.startsWith(cleanName) ||
            cleanName.startsWith(itemName) ||
            itemName.includes(cleanName)
        );
    });

    return medicine || null;
}


// ============================================================
// 5. PRESCRIPTIONS
// ============================================================

const DEFAULT_PRESCRIPTIONS = [
    {
        id: "RX-98201",
        date: getToday(),
        patientId: "PAT001",
        patientName: "Rahul Menon",
        doctorName: "Dr. Arun Kumar",
        status: "Pending Dispensation",
        medicines: [
            {
                medicineId: "MED001",
                medicine: "Paracetamol 500mg",
                dosage: "1 Tab",
                frequency: "1-0-1",
                duration: "3 Days",
                instructions: "After food",
                quantity: 6
            },
            {
                medicineId: "MED005",
                medicine: "Omeprazole 20mg",
                dosage: "1 Cap",
                frequency: "1-0-0",
                duration: "5 Days",
                instructions: "Before food",
                quantity: 5
            }
        ]
    },
    {
        id: "RX-98202",
        date: getToday(),
        patientId: "PAT002",
        patientName: "Anu Thomas",
        doctorName: "Dr. Arun Kumar",
        status: "Dispensed",
        medicines: [
            {
                medicineId: "MED002",
                medicine: "Amoxicillin 500mg",
                dosage: "1 Cap",
                frequency: "1-0-1",
                duration: "5 Days",
                instructions: "After food",
                quantity: 10
            },
            {
                medicineId: "MED003",
                medicine: "Cetirizine 10mg",
                dosage: "1 Tab",
                frequency: "0-0-1",
                duration: "5 Days",
                instructions: "Bedtime",
                quantity: 5
            }
        ]
    },
    {
        id: "RX-98203",
        date: getToday(),
        patientId: "PAT003",
        patientName: "Arjun Kumar",
        doctorName: "Dr. Arun Kumar",
        status: "Pending Dispensation",
        medicines: [
            {
                medicineId: "MED004",
                medicine: "Azithromycin 250mg",
                dosage: "1 Tab",
                frequency: "1-0-0",
                duration: "5 Days",
                instructions: "Morning after food",
                quantity: 5
            },
            {
                medicineId: "MED007",
                medicine: "Vitamin C 500mg",
                dosage: "1 Tab",
                frequency: "0-1-0",
                duration: "30 Days",
                instructions: "Lunch",
                quantity: 30
            }
        ]
    },
    {
        id: "RX-98190",
        date: "2026-02-14",
        patientId: "PAT005",
        patientName: "Suresh Babu",
        doctorName: "Dr. Arun Kumar",
        status: "Dispensed",
        medicines: [
            {
                medicineId: "MED006",
                medicine: "Cough Syrup 100ml",
                dosage: "10ml",
                frequency: "1-0-1",
                duration: "7 Days",
                instructions: "With warm water",
                quantity: 1
            },
            {
                medicineId: "MED001",
                medicine: "Paracetamol 500mg",
                dosage: "1 Tab",
                frequency: "1-0-0",
                duration: "3 Days",
                instructions: "Before breakfast",
                quantity: 3
            }
        ]
    }
];

function getStoredPrescriptions() {
    try {
        const raw = localStorage.getItem("cms_prescriptions");
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }
    } catch (error) {
        console.error("Error reading cms_prescriptions:", error);
    }

    localStorage.setItem("cms_prescriptions", JSON.stringify(DEFAULT_PRESCRIPTIONS));
    return DEFAULT_PRESCRIPTIONS.slice();
}

function saveStoredPrescriptions(data) {
    try {
        localStorage.setItem("cms_prescriptions", JSON.stringify(data));
        return true;
    } catch (error) {
        console.error("Error saving prescriptions:", error);
        return false;
    }
}


// ============================================================
// 6. PRESCRIPTION QUEUE
// ============================================================

function viewPrescription(id) {
    window.location.href = "prescription-details.html?id=" + encodeURIComponent(id);
}

function loadPrescriptionQueue() {
    const tableBody = document.getElementById("prescriptionQueue");
    if (!tableBody) {
        return;
    }

    const prescriptions = getStoredPrescriptions();
    const countElement = document.getElementById("queueCount") || document.querySelector(".table-count");

    const pendingCount = prescriptions.filter(function (rx) {
        return rx.status === "Pending" || rx.status === "Pending Dispensation";
    }).length;

    if (countElement) {
        countElement.innerText = pendingCount;
    }

    if (prescriptions.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;padding:24px;">
                    No prescriptions in queue.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = prescriptions.map(function (rx) {
        const isPending = rx.status === "Pending" || rx.status === "Pending Dispensation";

        return `
            <tr>
                <td class="td-mono">${escapeHtml(rx.id)}</td>
                <td class="td-primary">${escapeHtml(rx.patientName || rx.patientId || "—")}</td>
                <td>${escapeHtml(rx.doctorName || "—")}</td>
                <td>${escapeHtml(rx.date || "—")}</td>
                <td>
                    <span class="badge ${isPending ? "badge-warning" : "badge-success"}">
                        ${isPending ? "Pending" : "Dispensed"}
                    </span>
                </td>
                <td class="td-actions">
                    <a href="prescription-details.html?id=${encodeURIComponent(rx.id)}" class="btn btn-primary btn-sm">
                        View
                    </a>
                </td>
            </tr>
        `;
    }).join("");
}


// ============================================================
// 7. PRESCRIPTION DETAILS
// ============================================================

function loadPrescriptionDetails() {
    const tableBody = document.getElementById("rxMedicinesTable");
    if (!tableBody) {
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const prescriptionId = params.get("id");
    const prescriptions = getStoredPrescriptions();

    let prescription = null;
    if (prescriptionId) {
        prescription = prescriptions.find(function (item) {
            return String(item.id).toLowerCase() === String(prescriptionId).toLowerCase();
        });
    }

    if (!prescription && prescriptions.length > 0) {
        prescription = prescriptions[0];
    }

    if (!prescription) {
        const title = document.getElementById("rxTitle");
        if (title) title.innerText = "No Prescription Found";

        tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center;padding:24px;">
                    Prescription not found.
                </td>
            </tr>
        `;
        return;
    }

    const isPending = prescription.status === "Pending" || prescription.status === "Pending Dispensation";

    const title = document.getElementById("rxTitle");
    if (title) title.innerText = "Prescription " + prescription.id;

    const status = document.getElementById("rxStatusBadge");
    if (status) {
        status.className = "badge " + (isPending ? "badge-warning" : "badge-success");
        status.innerText = isPending ? "Pending" : "Dispensed";
    }

    const patient = document.getElementById("rxPatient");
    if (patient) {
        patient.innerText = (prescription.patientName || "—") + (prescription.patientId ? " (" + prescription.patientId + ")" : "");
    }

    const doctor = document.getElementById("rxDoctor");
    if (doctor) doctor.innerText = prescription.doctorName || "—";

    const date = document.getElementById("rxDate");
    if (date) date.innerText = prescription.date || "—";

    const rxId = document.getElementById("rxId");
    if (rxId) rxId.innerText = prescription.id;

    const prescriptionMedicines = prescription.medicines || [];

    if (prescriptionMedicines.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center;padding:20px;">
                    No medicines listed.
                </td>
            </tr>
        `;
    } else {
        tableBody.innerHTML = prescriptionMedicines.map(function (medicine) {
            const name = medicine.medicine || medicine.name || "—";
            const dosage = medicine.dosage || "—";
            const duration = [medicine.frequency, medicine.duration].filter(Boolean).join(" · ") || "—";
            const instructions = medicine.instructions || (medicine.quantity ? "Qty: " + medicine.quantity : "—");

            return `
                <tr>
                    <td class="td-primary">${escapeHtml(name)}</td>
                    <td>${escapeHtml(dosage)}</td>
                    <td>${escapeHtml(duration)}</td>
                    <td>${escapeHtml(instructions)}</td>
                </tr>
            `;
        }).join("");
    }

    // Dynamic Action Container Based on Intended Pharmacy Workflow
    const actionContainer = document.getElementById("rxActionContainer");
    if (actionContainer) {
        const bills = getStoredBills();
        const linkedBill = bills.find(function (b) {
            return String(b.prescriptionId || "").trim().toLowerCase() === String(prescription.id).trim().toLowerCase();
        });

        if (isPending) {
            if (!linkedBill) {
                // Step 1: No bill yet -> Generate Pharmacy Bill
                actionContainer.innerHTML = `
                    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;width:100%;">
                        <button class="btn btn-primary" onclick="generateBillFromPrescription('${escapeHtml(prescription.id)}')">
                            📄 Generate Pharmacy Bill
                        </button>
                        <span style="font-size:13px;color:var(--text-muted,#718096);">
                            Generates bill using current master prices. Payment is required prior to dispensing.
                        </span>
                    </div>
                `;
            } else if (linkedBill.status === "Unpaid") {
                // Step 2: Bill generated but Unpaid -> Payment required
                actionContainer.innerHTML = `
                    <div style="display:flex;flex-direction:column;gap:10px;width:100%;">
                        <div style="padding:10px 16px;background:var(--warning-light,#fff8e1);color:var(--warning-dark,#b7791f);border-radius:6px;font-weight:600;display:flex;align-items:center;gap:8px;">
                            <span>⚠️</span>
                            <span>Pharmacy Bill <strong>${escapeHtml(linkedBill.id)}</strong> generated (Unpaid — ₹${Number(linkedBill.amount || 0).toFixed(2)}). Payment is required before dispensing.</span>
                        </div>
                        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                            <a href="pharmacy-billing.html?billId=${encodeURIComponent(linkedBill.id)}" class="btn btn-primary">
                                💳 Collect Payment / Pay Bill (${escapeHtml(linkedBill.id)})
                            </a>
                            <button class="btn btn-secondary" onclick="alert('Payment is required before dispensing the medicine.')">
                                💊 Dispense (Blocked — Unpaid)
                            </button>
                        </div>
                    </div>
                `;
            } else if (linkedBill.status === "Paid") {
                // Step 3: Bill is Paid -> Allow Dispensing
                actionContainer.innerHTML = `
                    <div style="display:flex;flex-direction:column;gap:10px;width:100%;">
                        <div style="padding:10px 16px;background:var(--success-light,#e8f8f0);color:var(--success,#27ae60);border-radius:6px;font-weight:600;">
                            ✓ Bill ${escapeHtml(linkedBill.id)} is Paid (₹${Number(linkedBill.amount || 0).toFixed(2)}). Ready to dispense.
                        </div>
                        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                            <button class="btn btn-success" onclick="dispenseCurrentPrescription('${escapeHtml(prescription.id)}')">
                                💊 Dispense Prescribed Medicines
                            </button>
                            <a href="pharmacy-billing.html?billId=${encodeURIComponent(linkedBill.id)}" class="btn btn-outline">
                                🧾 View Receipt (${escapeHtml(linkedBill.id)})
                            </a>
                        </div>
                    </div>
                `;
            }
        } else {
            // Already Dispensed
            actionContainer.innerHTML = `
                <div style="display:flex;flex-direction:column;gap:10px;width:100%;">
                    <div style="padding:10px 16px;background:var(--success-light,#e8f8f0);color:var(--success,#27ae60);border-radius:6px;font-weight:600;">
                        ✓ All prescribed medicines have been dispensed.
                    </div>
                    ${
                        linkedBill
                            ? `
                                <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                                    <span class="badge badge-success">
                                        Bill ${escapeHtml(linkedBill.id)}: ${escapeHtml(linkedBill.status)} (₹${Number(linkedBill.amount || 0).toFixed(2)})
                                    </span>
                                    <a href="pharmacy-billing.html?billId=${encodeURIComponent(linkedBill.id)}" class="btn btn-outline btn-sm">
                                        🧾 View Bill / Receipt
                                    </a>
                                </div>
                            `
                            : ""
                    }
                </div>
            `;
        }
    }
}


// ============================================================
// 8. GENERATE PHARMACY BILL FROM PRESCRIPTION
// ============================================================

function generateBillFromPrescription(rxId) {
    const prescriptions = getStoredPrescriptions();
    const prescription = prescriptions.find(function (rx) {
        return String(rx.id).trim().toLowerCase() === String(rxId).trim().toLowerCase();
    });

    if (!prescription) {
        alert("Prescription not found.");
        return;
    }

    const bills = getStoredBills();
    let existingBill = bills.find(function (b) {
        return String(b.prescriptionId || "").trim().toLowerCase() === String(prescription.id).trim().toLowerCase();
    });

    if (existingBill) {
        sessionStorage.setItem("cms_last_pharmacy_bill", existingBill.id);
        alert("A Pharmacy bill already exists for this prescription (Bill ID: " + existingBill.id + "). Redirecting to billing...");
        window.location.href = "pharmacy-billing.html?billId=" + encodeURIComponent(existingBill.id);
        return;
    }

    const currentMedicines = getStoredMedicines();
    const prescribedList = prescription.medicines || [];

    if (prescribedList.length === 0) {
        alert("Prescription contains no medicines.");
        return;
    }

    const billItems = [];
    let totalAmount = 0;

    // Validate medicines against master data
    for (const prescribed of prescribedList) {
        const medicineId = prescribed.medicineId || prescribed.id;
        let masterMedicine = medicineId ? findMedicineById(medicineId, currentMedicines) : null;

        if (!masterMedicine) {
            masterMedicine = findMedicineByName(prescribed.medicine || prescribed.name, currentMedicines);
        }

        if (!masterMedicine) {
            alert("Medicine not found in Admin Medicine Master: " + (prescribed.medicine || prescribed.name || "Unknown"));
            return;
        }

        if (!isMedicineActive(masterMedicine)) {
            alert(masterMedicine.name + " is not Active and cannot be billed.");
            return;
        }

        if (isMedicineExpired(masterMedicine)) {
            alert(masterMedicine.name + " is expired and cannot be billed.");
            return;
        }

        const quantity = Number(prescribed.quantity) || 1;
        if (!Number.isInteger(quantity) || quantity <= 0) {
            alert("Invalid quantity for " + masterMedicine.name);
            return;
        }

        const unitPrice = Number(masterMedicine.price || 0);
        const lineTotal = Number((unitPrice * quantity).toFixed(2));
        totalAmount += lineTotal;

        billItems.push({
            medicineId: masterMedicine.id,
            medicine: masterMedicine.name,
            name: masterMedicine.name,
            category: masterMedicine.category || "",
            unit: masterMedicine.unit || "",
            quantity: quantity,
            price: unitPrice,
            unitPrice: unitPrice,
            lineTotal: lineTotal,
            total: lineTotal
        });
    }

    // Create ONE Pharmacy bill (NO STOCK DEDUCTION)
    const bill = {
        id: generateBillId(),
        type: "Pharmacy",
        patientId: prescription.patientId || "",
        patient: prescription.patientName || "",
        patientName: prescription.patientName || "",
        prescriptionId: prescription.id,
        doctor: prescription.doctorName || "",
        amount: Number(totalAmount.toFixed(2)),
        status: "Unpaid",
        method: "",
        reference: "",
        date: getToday(),
        createdAt: new Date().toISOString(),
        dispensed: false,
        items: billItems
    };

    bills.push(bill);
    if (!saveStoredBills(bills)) {
        alert("Unable to create Pharmacy bill.");
        return;
    }

    sessionStorage.setItem("cms_last_pharmacy_bill", bill.id);

    alert(
        "Pharmacy Bill " + bill.id + " generated successfully for Prescription " + prescription.id + ".\n\n" +
        "Status: Unpaid\nTotal: ₹" + bill.amount.toFixed(2) + "\n\n" +
        "Please collect payment before dispensing medicines."
    );

    // Redirect to billing/payment page
    window.location.href = "pharmacy-billing.html?billId=" + encodeURIComponent(bill.id);
}


// ============================================================
// 9. ATOMIC PRESCRIPTION DISPENSING (AFTER PAYMENT ONLY)
// ============================================================

function dispenseCurrentPrescription(rxId) {
    const prescriptions = getStoredPrescriptions();
    const prescription = prescriptions.find(function (rx) {
        return String(rx.id).trim().toLowerCase() === String(rxId).trim().toLowerCase();
    });

    if (!prescription) {
        alert("Prescription not found.");
        return;
    }

    // Rule: Check if already dispensed
    if (prescription.status === "Dispensed") {
        alert("This prescription has already been dispensed.");
        return;
    }

    // Rule: Payment must happen BEFORE dispensing
    const bills = getStoredBills();
    const linkedBill = bills.find(function (b) {
        return String(b.prescriptionId || "").trim().toLowerCase() === String(prescription.id).trim().toLowerCase();
    });

    if (!linkedBill || linkedBill.status !== "Paid") {
        alert("Payment is required before dispensing the medicine.");
        return;
    }

    if (linkedBill.dispensed) {
        alert("This prescription has already been dispensed.");
        return;
    }

    const currentMedicines = getStoredMedicines();
    const prescribedList = prescription.medicines || [];

    if (prescribedList.length === 0) {
        alert("Prescription contains no medicines.");
        return;
    }

    const requiredMap = new Map();

    // --------------------------------------------------------
    // FIRST PASS: Validate all medicines atomically
    // --------------------------------------------------------
    for (const prescribed of prescribedList) {
        const medicineId = prescribed.medicineId || prescribed.id;
        let masterMedicine = medicineId ? findMedicineById(medicineId, currentMedicines) : null;

        if (!masterMedicine) {
            masterMedicine = findMedicineByName(prescribed.medicine || prescribed.name, currentMedicines);
        }

        if (!masterMedicine) {
            alert("Medicine not found in Admin Medicine Master: " + (prescribed.medicine || prescribed.name || "Unknown"));
            return;
        }

        if (!isMedicineActive(masterMedicine)) {
            alert(masterMedicine.name + " is not Active and cannot be dispensed.");
            return;
        }

        if (isMedicineExpired(masterMedicine)) {
            alert(masterMedicine.name + " is expired and cannot be dispensed.");
            return;
        }

        const quantity = Number(prescribed.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
            alert("Invalid quantity for " + masterMedicine.name);
            return;
        }

        const medKey = String(masterMedicine.id).trim().toLowerCase();
        const existing = requiredMap.get(medKey);

        if (existing) {
            existing.quantity += quantity;
        } else {
            requiredMap.set(medKey, {
                medicine: masterMedicine,
                quantity: quantity
            });
        }
    }

    // --------------------------------------------------------
    // SECOND PASS: Validate stock for ALL items before deducting anything
    // --------------------------------------------------------
    for (const item of requiredMap.values()) {
        const medicine = findMedicineById(item.medicine.id, currentMedicines);
        if (!medicine) {
            alert("Medicine no longer exists in the master.");
            return;
        }

        const stock = Number(medicine.stock);
        if (!Number.isInteger(stock) || stock < item.quantity) {
            alert(
                "Insufficient stock for " + medicine.name +
                ". Available: " + stock +
                ", Required: " + item.quantity +
                ". No medicines were dispensed."
            );
            return;
        }
    }

    // --------------------------------------------------------
    // THIRD PASS: Deduct stock ONCE and update status
    // --------------------------------------------------------
    const deductedDetails = [];

    for (const item of requiredMap.values()) {
        const medicine = findMedicineById(item.medicine.id, currentMedicines);
        medicine.stock = Number(medicine.stock) - item.quantity;
        deductedDetails.push(medicine.name + " (-" + item.quantity + ", stock left: " + medicine.stock + ")");
    }

    // Save stock to cms_medicines
    if (!saveStoredMedicines(currentMedicines)) {
        alert("Unable to save stock changes.");
        return;
    }

    // Mark prescription as Dispensed
    prescription.status = "Dispensed";
    saveStoredPrescriptions(prescriptions);

    // Mark bill as dispensed
    linkedBill.dispensed = true;
    linkedBill.dispensedDate = getToday();
    saveStoredBills(bills);

    // Update receipt if needed
    createPharmacyReceipt(linkedBill);

    alert(
        "Prescription " + prescription.id + " dispensed successfully!\n\n" +
        "Stock updated:\n• " + deductedDetails.join("\n• ")
    );

    loadPrescriptionDetails();
    loadStock();
    loadInventory();
    updateDashboard();
    populateMedicineDropdowns();
}


// ============================================================
// 10. EXPIRY STATUS
// ============================================================

function getExpiryStatus(expiry) {
    if (!expiry) {
        return {
            text: "No Expiry",
            className: "badge-warning"
        };
    }

    const today = new Date();
    const expiryDate = new Date(expiry);

    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    if (expiryDate < today) {
        return {
            text: "Expired",
            className: "badge-danger"
        };
    }

    const difference = expiryDate - today;
    const days = Math.ceil(difference / (1000 * 60 * 60 * 24));

    if (days <= 30) {
        return {
            text: "Expiring Soon",
            className: "badge-warning"
        };
    }

    return {
        text: "Valid",
        className: "badge-success"
    };
}


// ============================================================
// 11. STOCK STATUS
// ============================================================

function getStockStatus(stock, reorderLevel = 0) {
    stock = Number(stock || 0);
    reorderLevel = Number(reorderLevel || 0);

    if (stock === 0) {
        return {
            text: "Out of Stock",
            className: "badge-danger"
        };
    }

    if (stock <= reorderLevel) {
        return {
            text: "Low Stock",
            className: "badge-warning"
        };
    }

    return {
        text: "Available",
        className: "badge-success"
    };
}


// ============================================================
// 12. MEDICINE INVENTORY
// ============================================================

function loadInventory() {
    const table = document.getElementById("inventoryTable");
    if (!table) {
        return;
    }

    const currentMedicines = getStoredMedicines();
    medicines = currentMedicines;
    table.innerHTML = "";

    if (currentMedicines.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center;padding:24px;">
                    No medicines found in Admin Medicine Master.
                </td>
            </tr>
        `;
        return;
    }

    currentMedicines.forEach(function (medicine) {
        const stockStatus = getStockStatus(medicine.stock, medicine.reorderLevel);
        const expiryStatus = getExpiryStatus(getExpiryDate(medicine));
        const masterStatus = medicine.status || "Active";

        table.innerHTML += `
            <tr>
                <td class="td-mono">${escapeHtml(medicine.id)}</td>
                <td class="td-primary">${escapeHtml(medicine.name)}</td>
                <td>${escapeHtml(medicine.category || "-")}</td>
                <td>${escapeHtml(medicine.unit || "-")}</td>
                <td>₹${Number(medicine.price || 0).toFixed(2)}</td>
                <td>${Number(medicine.stock || 0)}</td>
                <td>${Number(medicine.reorderLevel || 0)}</td>
                <td>${escapeHtml(medicine.batchNo || "-")}</td>
                <td>${escapeHtml(getExpiryDate(medicine) || "-")}</td>
                <td>
                    <span class="badge ${String(masterStatus).toLowerCase() === "active" ? "badge-success" : "badge-danger"}">
                        ${escapeHtml(masterStatus)}
                    </span>
                    <br>
                    <span class="badge ${expiryStatus.className}">
                        ${expiryStatus.text}
                    </span>
                    <br>
                    <span class="badge ${stockStatus.className}">
                        ${stockStatus.text}
                    </span>
                </td>
            </tr>
        `;
    });
}


// ============================================================
// 13. STOCK PAGE
// ============================================================

function loadStock() {
    const table = document.getElementById("stockTable");
    if (!table) {
        return;
    }

    const currentMedicines = getStoredMedicines();
    medicines = currentMedicines;
    table.innerHTML = "";

    if (currentMedicines.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center;padding:24px;">
                    No stock records found.
                </td>
            </tr>
        `;
        return;
    }

    currentMedicines.forEach(function (medicine) {
        const stockStatus = getStockStatus(medicine.stock, medicine.reorderLevel);
        const expiryStatus = getExpiryStatus(getExpiryDate(medicine));

        table.innerHTML += `
            <tr>
                <td class="td-mono">${escapeHtml(medicine.id)}</td>
                <td class="td-primary">${escapeHtml(medicine.name)}</td>
                <td>${Number(medicine.stock || 0)}</td>
                <td>${Number(medicine.reorderLevel || 0)}</td>
                <td>${escapeHtml(medicine.unit || "-")}</td>
                <td>${escapeHtml(medicine.batchNo || "-")}</td>
                <td>${escapeHtml(getExpiryDate(medicine) || "-")}</td>
                <td>
                    <span class="badge ${stockStatus.className}">
                        ${stockStatus.text}
                    </span>
                    <br>
                    <span class="badge ${expiryStatus.className}">
                        ${expiryStatus.text}
                    </span>
                </td>
            </tr>
        `;
    });
}


// ============================================================
// 14. MEDICINE DROPDOWNS
// ============================================================

function populateMedicineDropdowns() {
    const currentMedicines = getStoredMedicines();
    medicines = currentMedicines;

    // Billing select
    const billSelect = document.getElementById("billMedicine");
    if (billSelect) {
        const currentValue = billSelect.value;
        billSelect.innerHTML = `<option value="">Select Medicine</option>`;

        currentMedicines
            .filter(function (medicine) { return isMedicineAvailable(medicine); })
            .forEach(function (medicine) {
                billSelect.innerHTML += `
                    <option value="${escapeHtml(medicine.id)}">
                        ${escapeHtml(medicine.name)} - ₹${Number(medicine.price || 0).toFixed(2)}
                    </option>
                `;
            });

        if (currentValue && currentMedicines.some(function (m) { return String(m.id) === String(currentValue) && isMedicineAvailable(m); })) {
            billSelect.value = currentValue;
        }
    }

    updateBillingMedicineDetails();
}


// ============================================================
// 16. BILLING CART (FOR DIRECT SALE)
// ============================================================

let pharmacyCart = [];

function getBillingMedicine() {
    const select = document.getElementById("billMedicine");
    if (!select || !select.value) {
        return null;
    }

    const currentMedicines = getStoredMedicines();
    return findMedicineById(select.value, currentMedicines);
}

function updateBillingMedicineDetails() {
    const medicine = getBillingMedicine();
    const priceField = document.getElementById("billPrice");
    const stockField = document.getElementById("billStock");
    const reorderField = document.getElementById("billReorderLevel");

    if (!medicine) {
        if (priceField) priceField.value = "₹0.00";
        if (stockField) stockField.innerText = "0";
        if (reorderField) reorderField.innerText = "0";
        calculateBill();
        return;
    }

    if (priceField) priceField.value = "₹" + Number(medicine.price || 0).toFixed(2);
    if (stockField) stockField.innerText = Number(medicine.stock || 0);
    if (reorderField) reorderField.innerText = Number(medicine.reorderLevel || 0);

    calculateBill();
}

function calculateBill() {
    const select = document.getElementById("billMedicine");
    const quantityInput = document.getElementById("billQuantity");
    const totalElement = document.getElementById("total");

    if (!totalElement) {
        return;
    }

    const medicine = select && select.value ? findMedicineById(select.value, getStoredMedicines()) : null;
    const quantity = Number(quantityInput ? quantityInput.value : 0);

    const cartTotal = pharmacyCart.reduce(function (sum, item) {
        return sum + (item.quantity * item.price);
    }, 0);

    if (!medicine || !Number.isFinite(quantity) || quantity <= 0) {
        totalElement.innerText = cartTotal.toFixed(2);
        return;
    }

    const selectedTotal = Number(medicine.price || 0) * quantity;
    totalElement.innerText = (cartTotal + selectedTotal).toFixed(2);
}

function addMedicineToBill() {
    const medicine = getBillingMedicine();
    const quantityInput = document.getElementById("billQuantity");
    const quantity = Number(quantityInput ? quantityInput.value : 0);

    if (!medicine) {
        showMessage("billMessage", "Please select a medicine.", "error");
        return;
    }

    if (!isMedicineActive(medicine)) {
        showMessage("billMessage", "This medicine is not Active.", "error");
        return;
    }

    if (isMedicineExpired(medicine)) {
        showMessage("billMessage", "Expired medicines cannot be billed.", "error");
        return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
        showMessage("billMessage", "Quantity must be a whole number greater than zero.", "error");
        return;
    }

    const currentMedicines = getStoredMedicines();
    const freshMedicine = findMedicineById(medicine.id, currentMedicines);

    if (!freshMedicine) {
        showMessage("billMessage", "Medicine no longer exists in the master.", "error");
        return;
    }

    const existing = pharmacyCart.find(function (item) {
        return String(item.medicineId) === String(freshMedicine.id);
    });

    const existingQuantity = existing ? existing.quantity : 0;
    const requestedTotal = existingQuantity + quantity;

    if (requestedTotal > Number(freshMedicine.stock || 0)) {
        showMessage("billMessage", "Insufficient stock. Available: " + Number(freshMedicine.stock || 0), "error");
        return;
    }

    if (existing) {
        existing.quantity = requestedTotal;
        existing.price = Number(freshMedicine.price || 0);
    } else {
        pharmacyCart.push({
            medicineId: freshMedicine.id,
            name: freshMedicine.name,
            category: freshMedicine.category || "",
            unit: freshMedicine.unit || "",
            price: Number(freshMedicine.price || 0),
            quantity: quantity
        });
    }

    renderPharmacyCart();
    if (quantityInput) quantityInput.value = "1";
    showMessage("billMessage", "Medicine added to bill.");
}

function removeMedicineFromBill(medicineId) {
    pharmacyCart = pharmacyCart.filter(function (item) {
        return String(item.medicineId) !== String(medicineId);
    });
    renderPharmacyCart();
}

function renderPharmacyCart() {
    const tableBody = document.getElementById("billingCart");
    if (!tableBody) {
        calculateBill();
        return;
    }

    tableBody.innerHTML = "";

    if (pharmacyCart.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center;">
                    No medicines added
                </td>
            </tr>
        `;
        const total = document.getElementById("total");
        if (total) total.innerText = "0.00";
        return;
    }

    let grandTotal = 0;
    pharmacyCart.forEach(function (item) {
        const lineTotal = item.price * item.quantity;
        grandTotal += lineTotal;

        tableBody.innerHTML += `
            <tr>
                <td>${escapeHtml(item.name)}</td>
                <td>${item.quantity}</td>
                <td>₹${item.price.toFixed(2)}</td>
                <td>₹${lineTotal.toFixed(2)}</td>
                <td>
                    <button type="button" class="btn btn-danger btn-sm" onclick="removeMedicineFromBill('${escapeHtml(item.medicineId)}')">
                        Remove
                    </button>
                </td>
            </tr>
        `;
    });

    const total = document.getElementById("total");
    if (total) total.innerText = grandTotal.toFixed(2);
}


// ============================================================
// 17. BILL STORAGE
// ============================================================

function getStoredBills() {
    try {
        const raw = localStorage.getItem("cms_billing");
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("Error reading cms_billing:", error);
        return [];
    }
}

function saveStoredBills(bills) {
    try {
        localStorage.setItem("cms_billing", JSON.stringify(bills));
        return true;
    } catch (error) {
        console.error("Error saving cms_billing:", error);
        return false;
    }
}

function generateBillId() {
    const bills = getStoredBills();
    const timestamp = Date.now();
    return "PHB-" + timestamp + "-" + String(bills.length + 1).padStart(3, "0");
}


// ============================================================
// 18. GENERATE DIRECT PHARMACY BILL (NO STOCK DEDUCTION)
// ============================================================

function generateBill() {
    const patientNameInput = document.getElementById("patientName");
    const patientIdInput = document.getElementById("patientId");

    const patientName = patientNameInput ? patientNameInput.value.trim() : "";
    const patientId = patientIdInput ? patientIdInput.value.trim() : "";

    if (!patientName) {
        showMessage("billMessage", "Please enter patient name.", "error");
        return;
    }

    if (pharmacyCart.length === 0) {
        showMessage("billMessage", "Please add at least one medicine.", "error");
        return;
    }

    const currentMedicines = getStoredMedicines();
    const validationItems = [];
    const aggregatedQuantities = new Map();

    // Validate cart items against master data
    for (const cartItem of pharmacyCart) {
        const medicine = findMedicineById(cartItem.medicineId, currentMedicines);
        if (!medicine) {
            showMessage("billMessage", "Medicine no longer exists: " + cartItem.name, "error");
            return;
        }

        if (!isMedicineActive(medicine)) {
            showMessage("billMessage", medicine.name + " is not Active.", "error");
            return;
        }

        if (isMedicineExpired(medicine)) {
            showMessage("billMessage", medicine.name + " is expired.", "error");
            return;
        }

        const quantity = Number(cartItem.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
            showMessage("billMessage", "Invalid quantity for " + medicine.name, "error");
            return;
        }

        const medKey = String(medicine.id).trim().toLowerCase();
        const currentAgg = aggregatedQuantities.get(medKey) || 0;
        const newAgg = currentAgg + quantity;
        aggregatedQuantities.set(medKey, newAgg);

        const stock = Number(medicine.stock || 0);
        if (newAgg > stock) {
            showMessage("billMessage", "Insufficient stock for " + medicine.name + ". Available: " + stock + ", Required: " + newAgg, "error");
            return;
        }

        validationItems.push({
            medicine: medicine,
            quantity: quantity,
            price: Number(medicine.price || 0),
            lineTotal: Number((Number(medicine.price || 0) * quantity).toFixed(2))
        });
    }

    // CREATE BILL (Status: Unpaid). DO NOT DEDUCT STOCK AT BILL GENERATION TIME.
    const totalAmount = validationItems.reduce(function (sum, item) {
        return sum + item.lineTotal;
    }, 0);

    const bill = {
        id: generateBillId(),
        type: "Pharmacy",
        patientId: patientId,
        patient: patientName,
        patientName: patientName,
        prescriptionId: "",
        doctor: "",
        amount: Number(totalAmount.toFixed(2)),
        status: "Unpaid",
        method: "",
        reference: "",
        date: getToday(),
        createdAt: new Date().toISOString(),
        dispensed: false,
        items: validationItems.map(function (item) {
            return {
                medicineId: item.medicine.id,
                medicine: item.medicine.name,
                name: item.medicine.name,
                category: item.medicine.category || "",
                unit: item.medicine.unit || "",
                quantity: item.quantity,
                price: item.price,
                unitPrice: item.price,
                lineTotal: item.lineTotal,
                total: item.lineTotal
            };
        })
    };

    const bills = getStoredBills();
    bills.push(bill);

    if (!saveStoredBills(bills)) {
        showMessage("billMessage", "Unable to save bill.", "error");
        return;
    }

    sessionStorage.setItem("cms_last_pharmacy_bill", bill.id);
    pharmacyCart = [];

    renderPharmacyCart();
    showMessage("billMessage", "Pharmacy bill " + bill.id + " generated successfully. Status: Unpaid. (Stock unchanged until dispensing)");
    displayPharmacyBill(bill);
    loadPharmacyBillHistory();
}


// ============================================================
// 18A. RESET NEW BILL FORM
// ============================================================

function resetNewBillForm(showNotice) {
    if (showNotice === undefined) {
        showNotice = true;
    }

    // Clear patient fields
    const patientName = document.getElementById("patientName");
    if (patientName) patientName.value = "";

    const patientId = document.getElementById("patientId");
    if (patientId) patientId.value = "";

    // Reset medicine selection & quantity
    const billMedicine = document.getElementById("billMedicine");
    if (billMedicine) billMedicine.value = "";

    const billQuantity = document.getElementById("billQuantity");
    if (billQuantity) billQuantity.value = "1";

    const billPrice = document.getElementById("billPrice");
    if (billPrice) billPrice.value = "₹0.00";

    const billStock = document.getElementById("billStock");
    if (billStock) billStock.innerText = "0";

    const billReorderLevel = document.getElementById("billReorderLevel");
    if (billReorderLevel) billReorderLevel.innerText = "0";

    // Clear cart & total
    pharmacyCart = [];
    renderPharmacyCart();

    // Reset payment fields
    const paymentMethod = document.getElementById("paymentMethod");
    if (paymentMethod) paymentMethod.value = "";

    const paymentReference = document.getElementById("paymentReference");
    if (paymentReference) {
        paymentReference.value = "";
        paymentReference.placeholder = "Required for UPI/Card";
    }

    // Clear temporary messages
    const billMessage = document.getElementById("billMessage");
    if (billMessage) {
        billMessage.innerText = "";
        billMessage.className = "";
    }

    const paymentMessage = document.getElementById("paymentMessage");
    if (paymentMessage) {
        paymentMessage.innerText = "";
        paymentMessage.className = "";
    }

    // Hide/clear receipt output
    const receipt = document.getElementById("pharmacyBillReceipt");
    if (receipt) {
        receipt.innerHTML = "";
        receipt.style.display = "none";
    }

    // Clear session state and clean URL if parameters were present
    sessionStorage.removeItem("cms_last_pharmacy_bill");

    if (window.history && window.history.replaceState && window.location.search) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    }

    if (showNotice && billMessage) {
        showMessage("billMessage", "Direct sale form cleared. Ready for a new bill.");
    }
}


// ============================================================
// 18B. PHARMACY BILL HISTORY
// ============================================================

function loadPharmacyBillHistory(filterText, statusFilter) {
    const historyBody = document.getElementById("pharmacyBillHistoryBody");
    const countBadge = document.getElementById("pharmacyBillHistoryCount");
    if (!historyBody) return;

    const allBills = getStoredBills();

    // Strictly filter to Pharmacy bills only (Direct Sale or Doctor Prescription Pharmacy bills)
    // Excludes Registration bills, Consultation bills, Lab bills, etc.
    const pharmacyBills = allBills.filter(function (bill) {
        if (!bill) return false;
        const type = String(bill.type || "").trim().toLowerCase();
        if (type === "pharmacy") return true;
        if (!bill.type && (String(bill.id || "").startsWith("PHB-") || (bill.prescriptionId && Array.isArray(bill.items)))) {
            return true;
        }
        return false;
    });

    const searchInput = document.getElementById("billHistorySearch");
    const statusSelect = document.getElementById("billHistoryStatusFilter");

    const query = (filterText !== undefined ? filterText : (searchInput ? searchInput.value : "")).trim().toLowerCase();
    const status = (statusFilter !== undefined ? statusFilter : (statusSelect ? statusSelect.value : "")).trim();

    let filtered = pharmacyBills.slice();

    if (status) {
        filtered = filtered.filter(function (bill) {
            return String(bill.status || "").toLowerCase() === status.toLowerCase();
        });
    }

    if (query) {
        filtered = filtered.filter(function (bill) {
            const billId = String(bill.id || "").toLowerCase();
            const patient = String(bill.patientName || bill.patient || "").toLowerCase();
            const patientId = String(bill.patientId || "").toLowerCase();
            const rxId = String(bill.prescriptionId || "").toLowerCase();
            return billId.includes(query) || patient.includes(query) || patientId.includes(query) || rxId.includes(query);
        });
    }

    // Sort newest first
    filtered.sort(function (a, b) {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA && timeB && timeA !== timeB) {
            return timeB - timeA;
        }
        return String(b.id || "").localeCompare(String(a.id || ""));
    });

    if (countBadge) {
        countBadge.innerText = filtered.length + " bill" + (filtered.length === 1 ? "" : "s");
    }

    historyBody.innerHTML = "";

    if (filtered.length === 0) {
        historyBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center;padding:32px 16px;">
                    <div style="font-size:28px;margin-bottom:8px;">🧾</div>
                    <div style="font-weight:600;color:var(--text-primary,#0f172a);margin-bottom:4px;">No Pharmacy Bills Found</div>
                    <div style="font-size:13px;color:var(--text-muted,#718096);">
                        ${pharmacyBills.length === 0 ? "No pharmacy bills have been generated yet." : "No bills match the selected search or filter criteria."}
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(function (bill) {
        const isPaid = String(bill.status || "").toLowerCase() === "paid";
        const isDispensed = !!bill.dispensed;
        const isRx = !!bill.prescriptionId;
        const patientDisplayName = escapeHtml(bill.patientName || bill.patient || "Walk-in Patient");
        const patientDisplayId = bill.patientId ? `<div style="font-size:11px;color:var(--text-muted,#718096);margin-top:2px;">ID: ${escapeHtml(bill.patientId)}</div>` : "";
        const rxBadge = isRx ? `<div style="font-size:11px;color:var(--primary,#0070f3);margin-top:2px;">Rx: ${escapeHtml(bill.prescriptionId)}</div>` : "";
        const billAmount = Number(bill.amount || 0).toFixed(2);
        const billDate = escapeHtml(bill.date || (bill.createdAt ? bill.createdAt.split("T")[0] : getToday()));

        historyBody.innerHTML += `
            <tr>
                <td style="font-weight:600;font-family:monospace;font-size:13px;">
                    ${escapeHtml(bill.id)}
                </td>
                <td>
                    <span class="badge ${isRx ? "badge-info" : "badge-secondary"}" style="font-size:11px;">
                        ${isRx ? "Prescription" : "Direct Sale"}
                    </span>
                    ${rxBadge}
                </td>
                <td>
                    <div style="font-weight:600;color:var(--text-primary,#0f172a);">${patientDisplayName}</div>
                    ${patientDisplayId}
                </td>
                <td style="font-weight:600;">
                    ₹${billAmount}
                </td>
                <td>
                    <span class="badge ${isPaid ? "badge-success" : "badge-warning"}">
                        ${escapeHtml(bill.status || "Unpaid")}
                    </span>
                </td>
                <td>
                    <span class="badge ${isDispensed ? "badge-success" : "badge-warning"}">
                        ${isDispensed ? "Dispensed" : "Pending"}
                    </span>
                </td>
                <td style="font-size:13px;color:var(--text-muted,#718096);">
                    ${billDate}
                </td>
                <td>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <button
                            type="button"
                            class="btn btn-outline btn-sm"
                            onclick="viewHistoricalBill('${escapeHtml(bill.id)}')"
                            title="View bill details (Read-only)">
                            👁️ View
                        </button>
                        <button
                            type="button"
                            class="btn btn-outline btn-sm"
                            onclick="printPharmacyBill('${escapeHtml(bill.id)}')"
                            title="Print bill or receipt">
                            🖨️ Print
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}

function filterPharmacyBillHistory() {
    const searchVal = document.getElementById("billHistorySearch") ? document.getElementById("billHistorySearch").value : "";
    const statusVal = document.getElementById("billHistoryStatusFilter") ? document.getElementById("billHistoryStatusFilter").value : "";
    loadPharmacyBillHistory(searchVal, statusVal);
}

function viewHistoricalBill(billId) {
    const bills = getStoredBills();
    const bill = bills.find(function (b) {
        return String(b.id).trim().toLowerCase() === String(billId).trim().toLowerCase();
    });

    if (!bill) {
        alert("Bill " + billId + " not found.");
        return;
    }

    // Set active bill in session for printing
    sessionStorage.setItem("cms_last_pharmacy_bill", bill.id);

    // Render read-only bill details
    displayPharmacyBill(bill);

    // Scroll to the bill receipt view
    const receipt = document.getElementById("pharmacyBillReceipt");
    if (receipt) {
        receipt.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Update URL query string without reloading page
    if (window.history && window.history.replaceState) {
        const newUrl = window.location.pathname + "?billId=" + encodeURIComponent(bill.id);
        window.history.replaceState({ billId: bill.id }, document.title, newUrl);
    }
}


// ============================================================
// 19. DISPLAY BILL & RECEIPT
// ============================================================

function displayPharmacyBill(bill) {
    const receipt = document.getElementById("pharmacyBillReceipt");
    if (!receipt || !bill) {
        return;
    }

    const itemRows = (bill.items || []).map(function (item) {
        const medName = item.medicine || item.name || "—";
        const unitPrice = Number(item.price !== undefined ? item.price : item.unitPrice || 0);
        const total = Number(item.total !== undefined ? item.total : item.lineTotal || (unitPrice * Number(item.quantity || 0)));

        return `
            <tr>
                <td>${escapeHtml(medName)}</td>
                <td style="text-align:center;">${item.quantity || 0}</td>
                <td style="text-align:right;">₹${unitPrice.toFixed(2)}</td>
                <td style="text-align:right;">₹${total.toFixed(2)}</td>
            </tr>
        `;
    }).join("");

    receipt.style.display = "block";

    receipt.innerHTML = `
        <div id="printablePharmacyBill" style="padding:20px;max-width:800px;margin:20px auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;">
            <div style="text-align:center;margin-bottom:16px;">
                <h2 style="margin:0;">Clinic Management</h2>
                <h3 style="margin:4px 0 0 0;color:var(--primary,#0070f3);">Pharmacy ${bill.status === "Paid" ? "Receipt & Bill" : "Bill"}</h3>
            </div>

            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px;font-size:14px;">
                <div>
                    <p style="margin:4px 0;"><strong>Bill ID:</strong> ${escapeHtml(bill.id)}</p>
                    <p style="margin:4px 0;"><strong>Date:</strong> ${escapeHtml(bill.date || getToday())}</p>
                    ${bill.prescriptionId ? `<p style="margin:4px 0;"><strong>Prescription ID:</strong> ${escapeHtml(bill.prescriptionId)}</p>` : ""}
                </div>
                <div>
                    <p style="margin:4px 0;"><strong>Patient:</strong> ${escapeHtml(bill.patientName || bill.patient || "—")}</p>
                    ${bill.patientId ? `<p style="margin:4px 0;"><strong>Patient ID:</strong> ${escapeHtml(bill.patientId)}</p>` : ""}
                    ${bill.doctor ? `<p style="margin:4px 0;"><strong>Doctor:</strong> ${escapeHtml(bill.doctor)}</p>` : ""}
                </div>
            </div>

            <hr style="border:0;border-top:1px solid #e2e8f0;margin:12px 0;">

            <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;">
                <thead>
                    <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                        <th style="text-align:left;padding:8px;">Medicine</th>
                        <th style="text-align:center;padding:8px;">Quantity</th>
                        <th style="text-align:right;padding:8px;">Unit Price</th>
                        <th style="text-align:right;padding:8px;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemRows}
                </tbody>
            </table>

            <hr style="border:0;border-top:1px solid #e2e8f0;margin:12px 0;">

            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                <div>
                    <p style="margin:4px 0;">
                        <strong>Payment Status:</strong>
                        <span class="badge ${bill.status === "Paid" ? "badge-success" : "badge-warning"}">
                            ${escapeHtml(bill.status)}
                        </span>
                    </p>
                    <p style="margin:4px 0;">
                        <strong>Dispensing Status:</strong>
                        <span class="badge ${bill.dispensed ? "badge-success" : "badge-warning"}">
                            ${bill.dispensed ? "Dispensed" : "Pending Dispensation"}
                        </span>
                    </p>
                    ${bill.status === "Paid" ? `
                        <p style="margin:4px 0;"><strong>Payment Method:</strong> ${escapeHtml(bill.method || "—")}</p>
                        ${bill.reference ? `<p style="margin:4px 0;"><strong>Reference:</strong> ${escapeHtml(bill.reference)}</p>` : ""}
                    ` : ""}
                </div>
                <h3 style="margin:0;font-size:20px;color:var(--text-primary,#0f172a);">
                    Total: ₹${Number(bill.amount || 0).toFixed(2)}
                </h3>
            </div>

            ${
                bill.status === "Paid" && !bill.dispensed
                    ? `
                        <div style="margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;gap:12px;align-items:center;">
                            <button type="button" class="btn btn-success" onclick="dispensePaidBill('${escapeHtml(bill.id)}')">
                                💊 Dispense Medicines Now
                            </button>
                            <span style="font-size:13px;color:var(--text-muted,#718096);">
                                Payment collected. Click above to deduct stock and complete dispensing.
                            </span>
                        </div>
                    `
                    : ""
            }
        </div>
    `;
}


// ============================================================
// 20. PAYMENT PROCESSING (DOES NOT DEDUCT STOCK)
// ============================================================

function processPharmacyPayment() {
    const methodInput = document.getElementById("paymentMethod");
    const referenceInput = document.getElementById("paymentReference");

    const method = methodInput ? methodInput.value : "";
    const reference = referenceInput ? referenceInput.value.trim() : "";

    if (!method) {
        showMessage("paymentMessage", "Please select a payment method.", "error");
        return;
    }

    if ((method === "UPI" || method === "Card") && !reference) {
        showMessage("paymentMessage", "Payment reference is required for UPI/Card.", "error");
        return;
    }

    const bills = getStoredBills();
    const params = new URLSearchParams(window.location.search);
    const billIdParam = params.get("billId");
    const prescriptionIdParam = params.get("prescriptionId") || params.get("rxId");
    const lastBillId = sessionStorage.getItem("cms_last_pharmacy_bill");

    let bill = null;

    if (billIdParam) {
        bill = bills.find(function (item) {
            return String(item.id).trim().toLowerCase() === billIdParam.trim().toLowerCase();
        });
    }

    if (!bill && lastBillId) {
        bill = bills.find(function (item) {
            return String(item.id) === String(lastBillId);
        });
    }

    if (!bill && prescriptionIdParam) {
        bill = bills.find(function (item) {
            return String(item.prescriptionId || "").trim().toLowerCase() === prescriptionIdParam.trim().toLowerCase();
        });
    }

    // Fallback: latest unpaid pharmacy bill
    if (!bill) {
        for (let index = bills.length - 1; index >= 0; index--) {
            if (bills[index].type === "Pharmacy" && bills[index].status === "Unpaid") {
                bill = bills[index];
                break;
            }
        }
    }

    if (!bill) {
        showMessage("paymentMessage", "No unpaid pharmacy bill found.", "error");
        return;
    }

    if (bill.status === "Paid") {
        showMessage("paymentMessage", "This bill is already paid.", "error");
        return;
    }

    // PAYMENT ONLY UPDATES BILL STATUS AND GENERATES RECEIPT.
    // PAYMENT NEVER DEDUCTS MEDICINE STOCK.
    bill.status = "Paid";
    bill.method = method;
    bill.reference = reference;
    bill.paidDate = getToday();
    bill.paidAt = new Date().toISOString();

    if (!saveStoredBills(bills)) {
        showMessage("paymentMessage", "Unable to save payment.", "error");
        return;
    }

    createPharmacyReceipt(bill);
    displayPharmacyBill(bill);
    loadPharmacyBillHistory();

    showMessage(
        "paymentMessage",
        "Payment of ₹" + Number(bill.amount || 0).toFixed(2) + " processed successfully! Status: Paid. Receipt generated.\n" +
        "You may now dispense the medicines."
    );
}


// ============================================================
// 21. DISPENSE PAID BILL (FOR DIRECT OR PRESCRIPTION BILLS)
// ============================================================

function dispensePaidBill(billId) {
    const bills = getStoredBills();
    const bill = bills.find(function (b) {
        return String(b.id).trim().toLowerCase() === String(billId).trim().toLowerCase();
    });

    if (!bill) {
        alert("Bill not found.");
        return;
    }

    if (bill.status !== "Paid") {
        alert("Payment is required before dispensing the medicine.");
        return;
    }

    if (bill.dispensed) {
        alert("This bill/prescription has already been dispensed.");
        return;
    }

    // If linked to a prescription, use atomic prescription dispensing logic
    if (bill.prescriptionId) {
        dispenseCurrentPrescription(bill.prescriptionId);
        displayPharmacyBill(bill);
        return;
    }

    // Direct sale dispensing
    const currentMedicines = getStoredMedicines();
    const items = bill.items || [];

    if (items.length === 0) {
        alert("Bill has no items.");
        return;
    }

    const requiredMap = new Map();

    // FIRST PASS: Validate all items atomically
    for (const item of items) {
        const masterMedicine = findMedicineById(item.medicineId, currentMedicines);
        if (!masterMedicine) {
            alert("Medicine no longer exists in master list: " + (item.medicine || item.name));
            return;
        }

        if (!isMedicineActive(masterMedicine)) {
            alert(masterMedicine.name + " is not Active.");
            return;
        }

        if (isMedicineExpired(masterMedicine)) {
            alert(masterMedicine.name + " is expired.");
            return;
        }

        const qty = Number(item.quantity);
        const medKey = String(masterMedicine.id).trim().toLowerCase();
        const existing = requiredMap.get(medKey);

        if (existing) {
            existing.quantity += qty;
        } else {
            requiredMap.set(medKey, {
                medicine: masterMedicine,
                quantity: qty
            });
        }
    }

    // SECOND PASS: Validate stock for ALL items before deducting anything
    for (const item of requiredMap.values()) {
        const medicine = findMedicineById(item.medicine.id, currentMedicines);
        const stock = Number(medicine.stock);
        if (!Number.isInteger(stock) || stock < item.quantity) {
            alert("Insufficient stock for " + medicine.name + ". Available: " + stock + ", Required: " + item.quantity + ". Dispensing aborted.");
            return;
        }
    }

    // THIRD PASS: Deduct stock ONCE
    const deductedDetails = [];
    for (const item of requiredMap.values()) {
        const medicine = findMedicineById(item.medicine.id, currentMedicines);
        medicine.stock = Number(medicine.stock) - item.quantity;
        deductedDetails.push(medicine.name + " (-" + item.quantity + ", stock left: " + medicine.stock + ")");
    }

    if (!saveStoredMedicines(currentMedicines)) {
        alert("Unable to save stock changes.");
        return;
    }

    bill.dispensed = true;
    bill.dispensedDate = getToday();
    saveStoredBills(bills);

    createPharmacyReceipt(bill);
    displayPharmacyBill(bill);
    loadPharmacyBillHistory();

    alert("Medicines dispensed successfully!\n\nStock updated:\n• " + deductedDetails.join("\n• "));

    loadInventory();
    loadStock();
    updateDashboard();
    populateMedicineDropdowns();
}


// ============================================================
// 22. RECEIPTS
// ============================================================

function getStoredReceipts() {
    try {
        const raw = localStorage.getItem("cms_receipts");
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("Error reading cms_receipts:", error);
        return [];
    }
}

function saveStoredReceipts(receipts) {
    try {
        localStorage.setItem("cms_receipts", JSON.stringify(receipts));
        return true;
    } catch (error) {
        console.error("Error saving receipts:", error);
        return false;
    }
}

function createPharmacyReceipt(bill) {
    const receipts = getStoredReceipts();
    const existing = receipts.find(function (receipt) {
        return String(receipt.billId) === String(bill.id);
    });

    if (existing) {
        existing.status = bill.status;
        existing.method = bill.method;
        existing.reference = bill.reference;
        existing.dispensed = bill.dispensed;
    } else {
        receipts.push({
            id: "RCT-" + Date.now(),
            billId: bill.id,
            type: "Pharmacy",
            patientId: bill.patientId || "",
            patientName: bill.patientName || bill.patient || "",
            amount: bill.amount,
            method: bill.method,
            reference: bill.reference,
            date: getToday(),
            dispensed: bill.dispensed || false,
            items: bill.items || []
        });
    }

    saveStoredReceipts(receipts);
}


// ============================================================
// 23. PRINT PHARMACY BILL / RECEIPT
// ============================================================

function printPharmacyBill(targetBillId) {
    const params = new URLSearchParams(window.location.search);
    const billIdParam = targetBillId || params.get("billId");
    const lastBillId = sessionStorage.getItem("cms_last_pharmacy_bill");
    const prescriptionIdParam = params.get("prescriptionId") || params.get("rxId");

    const bills = getStoredBills();
    let bill = null;

    if (billIdParam) {
        bill = bills.find(function (item) {
            return String(item.id).trim().toLowerCase() === billIdParam.trim().toLowerCase();
        });
    }

    if (!bill && lastBillId) {
        bill = bills.find(function (item) {
            return String(item.id) === String(lastBillId);
        });
    }

    if (!bill && prescriptionIdParam) {
        bill = bills.find(function (item) {
            return String(item.prescriptionId || "").trim().toLowerCase() === prescriptionIdParam.trim().toLowerCase();
        });
    }

    if (!bill) {
        for (let index = bills.length - 1; index >= 0; index--) {
            if (bills[index].type === "Pharmacy") {
                bill = bills[index];
                break;
            }
        }
    }

    if (!bill) {
        alert("No pharmacy bill available to print.");
        return;
    }

    const itemRows = (bill.items || []).map(function (item) {
        const medName = item.medicine || item.name || "—";
        const unitPrice = Number(item.price !== undefined ? item.price : item.unitPrice || 0);
        const total = Number(item.total !== undefined ? item.total : item.lineTotal || (unitPrice * Number(item.quantity || 0)));

        return `
            <tr>
                <td>${escapeHtml(medName)}</td>
                <td style="text-align:center;">${item.quantity || 0}</td>
                <td style="text-align:right;">₹${unitPrice.toFixed(2)}</td>
                <td style="text-align:right;">₹${total.toFixed(2)}</td>
            </tr>
        `;
    }).join("");

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
        alert("Please allow pop-ups to print the bill.");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pharmacy Bill - ${escapeHtml(bill.id)}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 30px; color: #222; }
                .receipt { max-width: 800px; margin: auto; }
                h1, h2, h3 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
                th { background: #f3f3f3; }
                .total { text-align: right; font-size: 20px; font-weight: bold; margin-top: 20px; }
                .status { margin-top: 15px; font-weight: bold; }
                @media print { body { padding: 10px; } }
            </style>
        </head>
        <body>
            <div class="receipt">
                <h1>Clinic Management</h1>
                <h2>Pharmacy ${bill.status === "Paid" ? "Receipt" : "Bill"}</h2>
                <p><strong>Bill ID:</strong> ${escapeHtml(bill.id)}</p>
                <p><strong>Date:</strong> ${escapeHtml(bill.date || getToday())}</p>
                <p><strong>Patient:</strong> ${escapeHtml(bill.patientName || bill.patient || "—")}</p>
                ${bill.patientId ? `<p><strong>Patient ID:</strong> ${escapeHtml(bill.patientId)}</p>` : ""}
                ${bill.prescriptionId ? `<p><strong>Prescription ID:</strong> ${escapeHtml(bill.prescriptionId)}</p>` : ""}

                <table>
                    <thead>
                        <tr>
                            <th>Medicine</th>
                            <th style="text-align:center;">Quantity</th>
                            <th style="text-align:right;">Unit Price</th>
                            <th style="text-align:right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemRows}
                    </tbody>
                </table>

                <div class="total">
                    Total: ₹${Number(bill.amount || 0).toFixed(2)}
                </div>

                <div class="status">
                    Payment Status: ${escapeHtml(bill.status)}
                </div>
                <div class="status">
                    Dispensing Status: ${bill.dispensed ? "Dispensed" : "Pending Dispensation"}
                </div>

                ${bill.status === "Paid" ? `
                    <p><strong>Payment Method:</strong> ${escapeHtml(bill.method || "—")}</p>
                    ${bill.reference ? `<p><strong>Reference:</strong> ${escapeHtml(bill.reference)}</p>` : ""}
                ` : ""}
            </div>
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(function () {
        printWindow.print();
        printWindow.close();
    }, 300);
}


// ============================================================
// 24. DASHBOARD
// ============================================================

function updateDashboard() {
    const currentMedicines = getStoredMedicines();
    medicines = currentMedicines;

    const pendingElement = document.getElementById("pendingPrescriptions");
    const bannerPendingElement = document.getElementById("bannerPrescriptions");
    const medicineCountElement = document.getElementById("medicineCount");
    const bannerMedicinesElement = document.getElementById("bannerMedicines");
    const lowStockElement = document.getElementById("lowStock");
    const bannerLowStockElement = document.getElementById("bannerLowStock");

    const totalMedicines = currentMedicines.length;
    if (medicineCountElement) {
        medicineCountElement.innerText = totalMedicines;
    }
    if (bannerMedicinesElement) {
        bannerMedicinesElement.innerText = totalMedicines;
    }

    const lowStockCount = currentMedicines.filter(function (medicine) {
        return Number(medicine.stock || 0) <= Number(medicine.reorderLevel || 0);
    }).length;
    if (lowStockElement) {
        lowStockElement.innerText = lowStockCount;
    }
    if (bannerLowStockElement) {
        bannerLowStockElement.innerText = lowStockCount;
    }

    if (pendingElement || bannerPendingElement) {
        const prescriptions = getStoredPrescriptions();
        const pendingCount = prescriptions.filter(function (rx) {
            return rx.status === "Pending" || rx.status === "Pending Dispensation";
        }).length;

        if (pendingElement) {
            pendingElement.innerText = pendingCount;
        }
        if (bannerPendingElement) {
            bannerPendingElement.innerText = pendingCount;
        }
    }

    initPharmacyUI();
}


// ============================================================
// 25. INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
    initPharmacyUI();

    medicines = getStoredMedicines();

    loadInventory();
    loadStock();
    loadPrescriptionQueue();
    loadPrescriptionDetails();
    populateMedicineDropdowns();
    updateDashboard();
    renderPharmacyCart();
    loadPharmacyBillHistory();

    const params = new URLSearchParams(window.location.search);
    const billIdParam = params.get("billId");
    const rxParam = params.get("prescriptionId") || params.get("rxId");

    const bills = getStoredBills();
    let billToDisplay = null;

    if (billIdParam) {
        billToDisplay = bills.find(function (b) {
            return String(b.id).trim().toLowerCase() === billIdParam.trim().toLowerCase();
        });
    } else if (rxParam) {
        billToDisplay = bills.find(function (b) {
            return String(b.prescriptionId || "").trim().toLowerCase() === rxParam.trim().toLowerCase();
        });
    }

    if (billToDisplay) {
        displayPharmacyBill(billToDisplay);
    } else {
        // Direct arrival on billing page without a specific billId parameter -> clean form
        if (document.getElementById("billingCart")) {
            resetNewBillForm(false);
        }
    }

    const billMedicine = document.getElementById("billMedicine");
    if (billMedicine) {
        billMedicine.addEventListener("change", updateBillingMedicineDetails);
    }

    const billQuantity = document.getElementById("billQuantity");
    if (billQuantity) {
        billQuantity.addEventListener("input", calculateBill);
    }

    const paymentMethod = document.getElementById("paymentMethod");
    if (paymentMethod) {
        paymentMethod.addEventListener("change", function () {
            const reference = document.getElementById("paymentReference");
            if (!reference) return;

            if (paymentMethod.value === "Cash") {
                reference.placeholder = "Not required for Cash";
            } else {
                reference.placeholder = "Required for UPI/Card";
            }
        });
    }
});