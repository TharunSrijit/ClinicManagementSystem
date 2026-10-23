/* =========================================================
   CLINIC MANAGEMENT SYSTEM
   LABORATORY MODULE (js/lab.js)
   =========================================================
   Single Sources of Truth:
   - cms_lab_tests   -> Admin Laboratory Test Master
   - cms_lab_orders  -> Doctor-requested Laboratory Orders & Results
   - cms_billing     -> Central Billing Records (type: "Lab")

   Lifecycle:
   ORDERED / Pending
      ↓
   SAMPLE_COLLECTED / Sample Collected
      ↓
   PROCESSING / In Progress
      ↓
   COMPLETED / Completed
   ========================================================= */

/* =========================================================
   STORAGE KEYS & AUTH GUARD
   ========================================================= */
var loggedInUser = (function () {
  try {
    return JSON.parse(localStorage.getItem("loggedInUser") || "null");
  } catch (e) {
    return null;
  }
})();

function isAuthorizedLabRole(user) {
  if (!user) return false;
  const role = String(user.role || "").trim().toLowerCase();
  const userRole = String(user.userRole || "").trim().toLowerCase();
  const validRoles = ["lab", "lab_technician", "lab technician", "admin"];
  return validRoles.includes(role) || validRoles.includes(userRole);
}

if (typeof window !== "undefined" && window.location && window.location.pathname) {
  if (!isAuthorizedLabRole(loggedInUser)) {
    window.location.href = "../index.html";
  }
}

function logout() {
  if (typeof confirm === "function" && !confirm("Are you sure you want to logout?")) {
    return;
  }
  localStorage.removeItem("loggedInUser");
  localStorage.removeItem("fd_access");
  localStorage.removeItem("fd_refresh");
  localStorage.removeItem("fd_name");
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem("loggedInUser");
  }
  localStorage.removeItem("currentUser");
  window.location.href = "../index.html";
}

const LAB_TEST_MASTER_KEY = "cms_lab_tests";
const LAB_ORDERS_KEY = "cms_lab_orders";
const BILLING_KEY = "cms_billing";

let labOrders = [];

/* =========================================================
   GENERIC STORAGE HELPERS
   ========================================================= */
function readJSON(key, fallback = []) {
  try {
    const data = localStorage.getItem(key);
    if (!data) return fallback;
    const parsed = JSON.parse(data);
    return parsed ?? fallback;
  } catch (error) {
    console.error("Error reading localStorage:", key, error);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("Error writing localStorage:", key, error);
    return false;
  }
}

/* =========================================================
   BASIC UI HELPERS
   ========================================================= */
function setElementValue(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  if ("value" in element) {
    element.value = value ?? "";
  } else {
    element.textContent = value ?? "";
  }
}

function getElementValue(id) {
  const element = document.getElementById(id);
  if (!element) return "";
  if ("value" in element) {
    return String(element.value || "").trim();
  }
  return String(element.textContent || "").trim();
}

function setElementText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value ?? "";
  }
}

function showMessage(id, message, type = "success") {
  const element = document.getElementById(id);
  if (!element) return;

  element.textContent = message;
  element.classList.remove(
    "success",
    "error",
    "warning",
    "message-success",
    "message-error",
    "message-warning"
  );

  if (type === "error") {
    element.classList.add("error", "message-error");
  } else if (type === "warning") {
    element.classList.add("warning", "message-warning");
  } else {
    element.classList.add("success", "message-success");
  }
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCurrency(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return "₹0.00";
  }
  return "₹" + value.toFixed(2);
}

function formatDate(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }
  return date.toLocaleDateString();
}

function formatDateTime(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }
  return date.toLocaleString();
}

function initLabUI() {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  } catch (e) {
    user = null;
  }

  const name =
    (user && (user.fullName || user.name || user.username)) ||
    "Lab Technician";

  const welcomeName = document.getElementById("welcomeName");
  if (welcomeName) {
    welcomeName.textContent = "Welcome back, " + name + "!";
  }

  const initials = name
    .split(" ")
    .map(function (w) {
      return w[0];
    })
    .join("")
    .toUpperCase()
    .slice(0, 2) || "LT";

  const sidebarAvatar = document.getElementById("sidebarAvatar");
  const sidebarName = document.getElementById("sidebarName");
  const topbarAvatar = document.getElementById("topbarAvatar");
  const topbarName = document.getElementById("topbarName");
  const topbarDate = document.getElementById("topbarDate");
  const timeOfDay = document.getElementById("timeOfDay");

  if (sidebarAvatar) sidebarAvatar.textContent = initials;
  if (sidebarName) sidebarName.textContent = name;
  if (topbarAvatar) topbarAvatar.textContent = initials;
  if (topbarName) topbarName.textContent = name;

  const now = new Date();
  const hour = now.getHours();
  if (timeOfDay) {
    timeOfDay.textContent =
      hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
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

function getTodayString() {
  const now = new Date();
  return (
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0")
  );
}

function getStatusLabel(status) {
  if (!status) return "Pending";
  const s = String(status).trim().toUpperCase();
  if (s === "COMPLETED") return "Completed";
  if (s === "SAMPLE_COLLECTED") return "Sample Collected";
  if (s === "PROCESSING" || s === "IN PROGRESS") return "Processing";
  if (s === "ORDERED" || s === "PENDING") return "Pending";
  return status;
}

function isOrderCompleted(status) {
  const s = String(status || "").trim().toUpperCase();
  return s === "COMPLETED";
}

function isOrderPending(status) {
  const s = String(status || "").trim().toUpperCase();
  return s !== "COMPLETED" && s !== "CANCELLED";
}

/* =========================================================
   SIDEBAR
   ========================================================= */
function toggleSidebar() {
  const sidebar = document.getElementById("menu");
  if (sidebar) {
    sidebar.classList.toggle("open");
  }
}

/* =========================================================
   ADMIN LAB TEST MASTER (cms_lab_tests)
   ========================================================= */
const CANONICAL_LAB_TESTS = [
  {
    name: "Complete Blood Count (CBC)",
    aliases: ["complete blood count", "cbc", "complete blood count (cbc)", "hemogram", "full blood count"],
    category: "Hematology",
    price: 350,
    normalRange: "4,000–11,000",
    unit: "/µL",
    description: "Complete blood count analysis",
    status: "Active"
  },
  {
    name: "Fasting Blood Sugar (FBS)",
    aliases: ["fasting blood sugar", "fbs", "fasting blood sugar (fbs)", "blood glucose", "blood glucose fasting", "blood sugar", "fasting glucose", "glucose fasting"],
    category: "Biochemistry",
    price: 150,
    normalRange: "70–100",
    unit: "mg/dL",
    description: "Blood glucose level test",
    status: "Active"
  },
  {
    name: "HbA1c Glycated Hemoglobin",
    aliases: ["hba1c", "hba1c glycated hemoglobin", "glycated hemoglobin", "hemoglobin a1c", "hba1c test"],
    category: "Biochemistry",
    price: 450,
    normalRange: "< 5.7",
    unit: "%",
    description: "3-month average blood glucose",
    status: "Active"
  },
  {
    name: "Lipid Profile",
    aliases: ["lipid profile", "lipid panel", "cholesterol profile", "lipid profile test"],
    category: "Biochemistry",
    price: 500,
    normalRange: "< 200",
    unit: "mg/dL",
    description: "Cholesterol & triglyceride panel",
    status: "Active"
  },
  {
    name: "Liver Function Test (LFT)",
    aliases: ["liver function test", "lft", "liver function test (lft)", "liver panel", "hepatic function test", "hepatic enzyme assessment"],
    category: "Biochemistry",
    price: 650,
    normalRange: "0.2–1.2",
    unit: "mg/dL",
    description: "Hepatic enzyme assessment",
    status: "Active"
  },
  {
    name: "Renal Function Test (RFT)",
    aliases: ["renal function test", "rft", "renal function test (rft)", "kidney function test", "kidney function test (rft)", "kft", "kidney function panel"],
    category: "Biochemistry",
    price: 550,
    normalRange: "0.6–1.2",
    unit: "mg/dL",
    description: "Kidney function panel",
    status: "Active"
  },
  {
    name: "Thyroid Profile (T3, T4, TSH)",
    aliases: ["thyroid profile", "thyroid profile (t3, t4, tsh)", "thyroid function test", "tft", "t3 t4 tsh", "thyroid hormone assessment"],
    category: "Endocrinology",
    price: 600,
    normalRange: "0.4–4.0",
    unit: "µIU/mL",
    description: "Thyroid hormone assessment",
    status: "Active"
  },
  {
    name: "Urine Routine Examination",
    aliases: ["urine routine examination", "urine routine", "urinalysis", "urine routine & microscopy", "urine routine and microscopy"],
    category: "Pathology",
    price: 180,
    normalRange: "Normal / Pale Yellow",
    unit: "",
    description: "Urine routine and microscopy",
    status: "Active"
  },
  {
    name: "12-Lead ECG",
    aliases: ["12-lead ecg", "12 lead ecg", "ecg", "electrocardiogram", "electrocardiogram recording"],
    category: "Cardiology",
    price: 300,
    normalRange: "Normal Sinus Rhythm",
    unit: "ECG",
    description: "Electrocardiogram recording",
    status: "Active"
  },
  {
    name: "Chest X-Ray PA View",
    aliases: ["chest x-ray pa view", "chest x-ray", "chest x ray", "chest radiography", "chest radiography pa view", "chest x-ray pa"],
    category: "Radiology",
    price: 400,
    normalRange: "Normal Lung Fields & Cardiac Shadow",
    unit: "Film",
    description: "Chest radiography PA view",
    status: "Active"
  }
];

function findCanonicalLabMatch(testName) {
  if (!testName) return null;
  const clean = String(testName).trim().toLowerCase();
  const stripped = clean.replace(/\(.*?\)/g, "").trim();

  for (let i = 0; i < CANONICAL_LAB_TESTS.length; i++) {
    const canonical = CANONICAL_LAB_TESTS[i];
    if (canonical.aliases.some((alias) => alias === clean || alias === stripped)) {
      return canonical;
    }
  }
  return null;
}

function cleanupMasterLabTests(masterTests) {
  if (!Array.isArray(masterTests) || masterTests.length === 0) {
    return { tests: [], modified: false };
  }

  let modified = false;
  const processedTests = masterTests.map((t) => ({ ...t }));
  const groups = new Map();

  processedTests.forEach((test) => {
    const canonical = findCanonicalLabMatch(test.name || test.testName);
    let groupKey;
    if (canonical) {
      groupKey = "canonical:" + canonical.name;
    } else {
      const cleanName = String(test.name || test.testName || "").trim().replace(/\s+/g, " ").toLowerCase();
      const coreName = cleanName.replace(/\(.*?\)/g, "").trim();
      groupKey = "custom:" + (coreName || cleanName || test.id);
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey).push(test);
  });

  groups.forEach((groupTests, groupKey) => {
    const canonical = groupKey.startsWith("canonical:")
      ? CANONICAL_LAB_TESTS.find((c) => "canonical:" + c.name === groupKey)
      : null;

    // Sort so lowest numeric ID (e.g. LAB001 < LAB009) is the primary record
    groupTests.sort((a, b) => {
      const numA = parseInt((String(a.id || "").match(/\d+/) || [999999])[0], 10);
      const numB = parseInt((String(b.id || "").match(/\d+/) || [999999])[0], 10);
      if (numA !== numB) return numA - numB;
      return String(a.id).localeCompare(String(b.id));
    });

    const primary = groupTests[0];

    let bestNormalRange = String(primary.normalRange || "").trim();
    let bestUnit = String(primary.unit || "").trim();
    let bestDescription = String(primary.description || "").trim();

    for (let i = 1; i < groupTests.length; i++) {
      const dup = groupTests[i];
      if (!bestNormalRange && String(dup.normalRange || "").trim()) {
        bestNormalRange = String(dup.normalRange).trim();
      }
      if (!bestUnit && String(dup.unit || "").trim()) {
        bestUnit = String(dup.unit).trim();
      }
      if (!bestDescription && String(dup.description || "").trim()) {
        bestDescription = String(dup.description).trim();
      }
    }

    if (canonical) {
      if (!bestNormalRange && canonical.normalRange) bestNormalRange = canonical.normalRange;
      if (!bestUnit && canonical.unit) bestUnit = canonical.unit;
      if (!bestDescription && canonical.description) bestDescription = canonical.description;
    }

    // Backfill missing properties on Primary record
    if (bestNormalRange && String(primary.normalRange || "").trim() !== bestNormalRange) {
      primary.normalRange = bestNormalRange;
      modified = true;
    }
    if (bestUnit && String(primary.unit || "").trim() !== bestUnit) {
      primary.unit = bestUnit;
      modified = true;
    }
    if (bestDescription && String(primary.description || "").trim() !== bestDescription) {
      primary.description = bestDescription;
      modified = true;
    }
    if (canonical && (!primary.category || primary.category === "General" || primary.category === "Other")) {
      primary.category = canonical.category;
      modified = true;
    }
    if (canonical && (!primary.price || Number(primary.price) === 0)) {
      primary.price = canonical.price;
      modified = true;
    }
    if (!primary.status) {
      primary.status = "Active";
      modified = true;
    }

    // Duplicate records are retained for historical references, but deactivated
    for (let j = 1; j < groupTests.length; j++) {
      const duplicate = groupTests[j];
      if (duplicate.status !== "Inactive") {
        duplicate.status = "Inactive";
        modified = true;
      }
      if (!String(duplicate.normalRange || "").trim() && bestNormalRange) {
        duplicate.normalRange = bestNormalRange;
        modified = true;
      }
      if (!String(duplicate.unit || "").trim() && bestUnit) {
        duplicate.unit = bestUnit;
        modified = true;
      }
    }
  });

  return {
    tests: processedTests,
    modified: modified
  };
}

function getLabTestMaster() {
  const tests = readJSON(LAB_TEST_MASTER_KEY, []);
  let masterTests = [];
  if (Array.isArray(tests)) {
    masterTests = tests.filter(function (t) {
      if (t.recordType === "master") return true;
      if (t.patientId || t.patientName || t.consultationId || t.requestedAt || t.orderDate) return false;
      return t.id && (t.name || t.testName);
    });
  }

  if (masterTests.length === 0) {
    masterTests = [
      { id: "LAB001", name: "Complete Blood Count (CBC)", category: "Hematology", price: 350, description: "Complete blood count analysis", status: "Active", normalRange: "4,000–11,000", unit: "/µL", recordType: "master" },
      { id: "LAB002", name: "Fasting Blood Sugar (FBS)", category: "Biochemistry", price: 150, description: "Blood glucose level test", status: "Active", normalRange: "70–100", unit: "mg/dL", recordType: "master" },
      { id: "LAB003", name: "HbA1c Glycated Hemoglobin", category: "Biochemistry", price: 450, description: "3-month average blood glucose", status: "Active", normalRange: "< 5.7", unit: "%", recordType: "master" },
      { id: "LAB004", name: "Lipid Profile", category: "Biochemistry", price: 500, description: "Cholesterol & triglyceride panel", status: "Active", normalRange: "< 200", unit: "mg/dL", recordType: "master" },
      { id: "LAB005", name: "Liver Function Test (LFT)", category: "Biochemistry", price: 650, description: "Hepatic enzyme assessment", status: "Active", normalRange: "0.2–1.2", unit: "mg/dL", recordType: "master" },
      { id: "LAB006", name: "Renal Function Test (RFT)", category: "Biochemistry", price: 550, description: "Kidney function panel", status: "Active", normalRange: "0.6–1.2", unit: "mg/dL", recordType: "master" },
      { id: "LAB007", name: "Thyroid Profile (T3, T4, TSH)", category: "Endocrinology", price: 600, description: "Thyroid hormone assessment", status: "Active", normalRange: "0.4–4.0", unit: "µIU/mL", recordType: "master" },
      { id: "LAB008", name: "Urine Routine Examination", category: "Pathology", price: 180, description: "Urine routine and microscopy", status: "Active", normalRange: "Normal / Pale Yellow", unit: "", recordType: "master" },
      { id: "LAB009", name: "12-Lead ECG", category: "Cardiology", price: 300, description: "Electrocardiogram recording", status: "Active", normalRange: "Normal Sinus Rhythm", unit: "ECG", recordType: "master" },
      { id: "LAB010", name: "Chest X-Ray PA View", category: "Radiology", price: 400, description: "Chest radiography PA view", status: "Active", normalRange: "Normal Lung Fields & Cardiac Shadow", unit: "Film", recordType: "master" }
    ];
    if (localStorage.getItem(LAB_TEST_MASTER_KEY) === null) {
      writeJSON(LAB_TEST_MASTER_KEY, masterTests);
    }
  }

  const cleaned = cleanupMasterLabTests(masterTests);
  if (cleaned.modified) {
    const rawTests = readJSON(LAB_TEST_MASTER_KEY, []);
    const legacyOrders = rawTests.filter(function (t) {
      return t.recordType !== "master" && (t.patientId || t.patientName || t.consultationId || t.requestedAt || t.orderDate);
    });
    const catalogRecords = cleaned.tests.map(function (test) {
      return { ...test, recordType: "master" };
    });
    writeJSON(LAB_TEST_MASTER_KEY, legacyOrders.concat(catalogRecords));
  }

  return cleaned.tests.map(function (test) {
    return {
      id: String(test.id ?? test.testId ?? "").trim(),
      name: test.name ?? test.testName ?? "",
      category: test.category ?? "General",
      description: test.description ?? "",
      price: Number(test.price ?? test.amount ?? 0),
      status: test.status ?? "Active",
      normalRange: test.normalRange ?? "",
      unit: test.unit ?? ""
    };
  });
}

function getActiveLabTests() {
  return getLabTestMaster().filter(function (test) {
    return String(test.status).toLowerCase() === "active";
  });
}

function findMasterTest(testId) {
  if (!testId) return null;
  const targetId = String(testId).trim();
  const tests = getLabTestMaster();
  return (
    tests.find(function (test) {
      return String(test.id).trim() === targetId;
    }) || null
  );
}

function findMasterTestByName(testName) {
  if (!testName) return null;
  const searchName = String(testName).trim().toLowerCase();
  const tests = getLabTestMaster();
  const exact = tests.find(function (test) {
    return String(test.name).trim().toLowerCase() === searchName;
  });
  if (exact) return exact;

  const cleanSearch = searchName.replace(/\(.*?\)/g, "").trim();
  return (
    tests.find(function (test) {
      const cleanName = String(test.name).replace(/\(.*?\)/g, "").trim().toLowerCase();
      return cleanName === cleanSearch || cleanName.includes(cleanSearch) || cleanSearch.includes(cleanName);
    }) || null
  );
}

/* =========================================================
   LAB ORDER STORAGE (cms_lab_orders)
   ========================================================= */
function loadLabOrdersFromStorage() {
  let storedOrders = readJSON(LAB_ORDERS_KEY, []);

  // Safe migration fallback if cms_lab_orders is null in storage but legacy orders exist
  if ((!Array.isArray(storedOrders) || storedOrders.length === 0) && localStorage.getItem(LAB_ORDERS_KEY) === null) {
    const rawTests = readJSON(LAB_TEST_MASTER_KEY, []);
    const legacyOrders = rawTests.filter(function (t) {
      return t.recordType !== "master" && (t.patientId || t.patientName) && (t.consultationId || t.requestedAt || t.orderDate);
    });
    if (legacyOrders.length > 0) {
      writeJSON(LAB_ORDERS_KEY, legacyOrders);
      storedOrders = legacyOrders;
    }
  }

  if (!Array.isArray(storedOrders)) {
    return [];
  }

  let hasRepairs = false;

  const normalizedOrders = storedOrders.map(function (order) {
    const masterTest = findMasterTest(order.testId) || (order.testName ? findMasterTestByName(order.testName) : null);
    const orderId = order.id || order.orderNumber || "";

    const existingNormalRange = String(order.normalRange || "").trim();
    const masterNormalRange = String((masterTest && masterTest.normalRange) || "").trim();
    const resolvedNormalRange = existingNormalRange || masterNormalRange;

    const existingUnit = String(order.unit || "").trim();
    const masterUnit = String((masterTest && masterTest.unit) || "").trim();
    const resolvedUnit = existingUnit || masterUnit;

    if (
      (!existingNormalRange && masterNormalRange) ||
      (!existingUnit && masterUnit) ||
      order.normalRange !== resolvedNormalRange ||
      order.unit !== resolvedUnit ||
      (!order.testId && masterTest && masterTest.id)
    ) {
      hasRepairs = true;
    }

    return {
      ...order,
      id: orderId,
      orderNumber: order.orderNumber || orderId,
      patientId: order.patientId || "",
      patientName: order.patientName || "",
      doctorId: order.doctorId || "",
      doctorName: order.doctorName || "Dr. Arun Kumar",
      appointmentId: order.appointmentId || "",
      consultationId: order.consultationId || "",
      testId: order.testId || (masterTest ? masterTest.id : ""),
      testName: order.testName || (masterTest ? (masterTest.name || masterTest.testName) : "") || "Lab Investigation",
      category: order.category || (masterTest ? masterTest.category : "") || "General",
      description: order.description || (masterTest ? masterTest.description : "") || "",
      price: Number(order.price ?? (masterTest ? masterTest.price : 0)),
      normalRange: resolvedNormalRange,
      unit: resolvedUnit,
      status: order.status || "Pending",
      priority: order.priority || "Normal",
      orderDate: order.orderDate || (order.requestedAt ? String(order.requestedAt).substring(0, 10) : getTodayString()),
      requestedAt: order.requestedAt || order.createdAt || "",
      result: order.result || "",
      remarks: order.remarks || "",
      completedAt: order.completedAt || "",
      resultEnteredBy: order.resultEnteredBy || ""
    };
  });

  if (hasRepairs && normalizedOrders.length > 0) {
    writeJSON(LAB_ORDERS_KEY, normalizedOrders);
  }

  return normalizedOrders;
}

function saveLabOrders(orders) {
  if (Array.isArray(orders)) {
    labOrders = orders;
  }
  return writeJSON(LAB_ORDERS_KEY, labOrders);
}

function findOrder(orderNumber) {
  if (!orderNumber) return null;
  const targetId = String(orderNumber).trim();
  const orders = loadLabOrdersFromStorage();
  return (
    orders.find(function (order) {
      return (
        String(order.id).trim() === targetId ||
        String(order.orderNumber).trim() === targetId
      );
    }) || null
  );
}

function generateOrderNumber() {
  const orders = loadLabOrdersFromStorage();
  let highest = 0;
  orders.forEach(function (order) {
    const number = String(order.orderNumber || order.id || "");
    const match = number.match(/(\d+)$/);
    if (match) {
      highest = Math.max(highest, Number(match[1]));
    }
  });
  return "LABREQ-" + String(highest + 1).padStart(4, "0");
}

/* =========================================================
   DIRECT LAB TESTS DISABLED NOTICE
   ========================================================= */
function addNewLabTest(event) {
  if (event) event.preventDefault();
  showMessage(
    "message",
    "Direct lab test creation is disabled. All tests must be requested by a Doctor through consultation.",
    "warning"
  );
  alert("Direct lab test creation is disabled. The Lab Technician only processes tests requested by a Doctor.");
  window.location.href = "pending-lab-orders.html";
  return false;
}

/* =========================================================
   DASHBOARD
   ========================================================= */
function loadDashboard() {
  const orders = loadLabOrdersFromStorage();
  const pending = orders.filter(function (order) {
    return isOrderPending(order.status);
  });
  const completed = orders.filter(function (order) {
    return isOrderCompleted(order.status);
  });
  const today = getTodayString();
  const todayTests = orders.filter(function (order) {
    const date = String(order.orderDate || order.requestedAt || "").substring(0, 10);
    return date === today;
  });

  setElementText("pendingCount", pending.length);
  setElementText("completedCount", completed.length);
  setElementText("todayTestCount", todayTests.length);
  setElementText("totalTestCount", orders.length);

  setElementText("bannerPending", pending.length);
  setElementText("bannerCompleted", completed.length);
  setElementText("bannerTotal", orders.length);

  initLabUI();
}

function updateLabDashboard() {
  loadDashboard();
}

/* =========================================================
   PENDING ORDERS
   ========================================================= */
function loadPendingLabOrders() {
  const table = document.getElementById("pendingTestsTable");
  if (!table) return;

  const tbody =
    document.getElementById("pendingTestsBody") ||
    table.querySelector("tbody");

  if (!tbody) return;
  tbody.innerHTML = "";

  const orders = loadLabOrdersFromStorage().filter(function (order) {
    return isOrderPending(order.status);
  });

  if (orders.length === 0) {
    const row = tbody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 8;
    cell.style.textAlign = "center";
    cell.style.padding = "24px";
    cell.style.color = "var(--text-muted, #64748b)";
    cell.textContent = "No pending laboratory orders found.";
    return;
  }

  orders.forEach(function (order) {
    const row = tbody.insertRow();
    const orderId = order.id || order.orderNumber;

    row.insertCell().textContent = orderId;
    row.insertCell().textContent = order.patientName + (order.patientId ? " (" + order.patientId + ")" : "");
    row.insertCell().textContent = order.doctorName || "Dr. Arun Kumar";
    row.insertCell().textContent = order.testName;
    row.insertCell().textContent = formatDate(order.orderDate || order.requestedAt);
    row.insertCell().textContent = order.priority || "Normal";

    const statusCell = row.insertCell();
    const badge = document.createElement("span");
    const s = String(order.status).toUpperCase();
    badge.className = "badge " + (s === "PROCESSING" ? "badge-info" : s === "SAMPLE_COLLECTED" ? "badge-warning" : "badge-secondary");
    badge.textContent = getStatusLabel(order.status);
    statusCell.appendChild(badge);

    const actionCell = row.insertCell();
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-primary btn-sm";
    button.textContent = "View";
    button.onclick = function () {
      viewLabTest(orderId);
    };
    actionCell.appendChild(button);
  });
}

/* =========================================================
   TEST DETAILS
   ========================================================= */
function loadTestDetails() {
  const params = new URLSearchParams(window.location.search);
  const orderNumber = params.get("orderId") || params.get("id");

  if (!orderNumber) return;
  const order = findOrder(orderNumber);

  if (!order) {
    showMessage("message", "Laboratory order not found.", "error");
    return;
  }

  const masterTest = findMasterTest(order.testId) || (order.testName ? findMasterTestByName(order.testName) : null);
  const normalRange = String(order.normalRange || "").trim() || String((masterTest && masterTest.normalRange) || "").trim();
  const unit = String(order.unit || "").trim() || String((masterTest && masterTest.unit) || "").trim();

  const orderId = order.id || order.orderNumber;
  setElementValue("orderId", orderId);
  setElementValue("patientName", order.patientName);
  setElementValue("patientId", order.patientId);
  setElementValue("doctorName", order.doctorName || "Dr. Arun Kumar");
  setElementValue("testName", order.testName || (masterTest ? (masterTest.name || masterTest.testName) : ""));
  setElementValue("testId", order.testId || (masterTest ? masterTest.id : ""));
  setElementValue("testDate", order.orderDate || (order.requestedAt ? String(order.requestedAt).substring(0, 10) : ""));
  setElementValue("testStatus", getStatusLabel(order.status));
  setElementValue("testPriority", order.priority || "Normal");
  setElementValue("testCategory", order.category || (masterTest ? masterTest.category : "") || "General");
  setElementValue("testDescription", order.description || (masterTest ? masterTest.description : "") || "");
  setElementValue("testPrice", formatCurrency(order.price ?? (masterTest ? masterTest.price : 0)));
  setElementValue("testNotes", order.notes || order.summary || "");
  setElementValue("testResult", order.result || "");
  setElementValue("testRemarks", order.remarks || "");
  setElementValue("normalRange", normalRange);
  setElementValue("testUnit", unit);
  setElementValue("completedAt", order.completedAt ? formatDateTime(order.completedAt) : "");
  setElementText("testStatusText", getStatusLabel(order.status));

  // Render status-appropriate action buttons inside #detailsActionsContainer
  renderTestDetailsActions(order);
}

function renderTestDetailsActions(order) {
  const container = document.getElementById("detailsActionsContainer");
  if (!container) return;

  const orderId = order.id || order.orderNumber;
  const s = String(order.status || "").trim().toUpperCase();

  container.innerHTML = "";

  const backBtn = document.createElement("a");
  backBtn.href = isOrderCompleted(order.status) ? "completed-tests.html" : "pending-lab-orders.html";
  backBtn.className = "btn btn-secondary";
  backBtn.textContent = "← Back to Orders";
  container.appendChild(backBtn);

  if (s === "ORDERED" || s === "PENDING") {
    const collectBtn = document.createElement("button");
    collectBtn.type = "button";
    collectBtn.className = "btn btn-outline";
    collectBtn.textContent = "Collect Sample";
    collectBtn.onclick = function () {
      handleCollectSample();
    };
    container.appendChild(collectBtn);

    const resultBtn = document.createElement("button");
    resultBtn.type = "button";
    resultBtn.className = "btn btn-primary";
    resultBtn.textContent = "Enter Result →";
    resultBtn.onclick = function () {
      goToResults(orderId);
    };
    container.appendChild(resultBtn);
  } else if (s === "SAMPLE_COLLECTED") {
    const processBtn = document.createElement("button");
    processBtn.type = "button";
    processBtn.className = "btn btn-outline";
    processBtn.textContent = "Start Processing";
    processBtn.onclick = function () {
      handleStartProcessing();
    };
    container.appendChild(processBtn);

    const resultBtn = document.createElement("button");
    resultBtn.type = "button";
    resultBtn.className = "btn btn-primary";
    resultBtn.textContent = "Enter Result →";
    resultBtn.onclick = function () {
      goToResults(orderId);
    };
    container.appendChild(resultBtn);
  } else if (s === "PROCESSING" || s === "IN PROGRESS") {
    const resultBtn = document.createElement("button");
    resultBtn.type = "button";
    resultBtn.className = "btn btn-primary";
    resultBtn.textContent = "Enter Result →";
    resultBtn.onclick = function () {
      goToResults(orderId);
    };
    container.appendChild(resultBtn);
  } else if (s === "COMPLETED") {
    const printBtn = document.createElement("button");
    printBtn.type = "button";
    printBtn.className = "btn btn-outline";
    printBtn.textContent = "🖨 Print Result";
    printBtn.onclick = function () {
      printLabResult(orderId);
    };
    container.appendChild(printBtn);

    const bills = getBills();
    const existingBill = bills.find(function (b) {
      return (
        (b.orderId && String(b.orderId).trim().toLowerCase() === String(orderId).trim().toLowerCase()) ||
        (order.billId && String(b.billId || b.id).trim().toLowerCase() === String(order.billId).trim().toLowerCase())
      );
    });

    const billBtn = document.createElement("button");
    billBtn.type = "button";
    billBtn.className = "btn btn-primary";

    if (existingBill) {
      const isPaid = String(existingBill.paymentStatus || existingBill.status || "").toLowerCase() === "paid";
      const bId = existingBill.billId || existingBill.id;
      billBtn.textContent = isPaid ? "🧾 View Paid Bill (" + bId + ")" : "💳 Pay Lab Bill (" + bId + ") →";
      billBtn.onclick = function () {
        window.location.href = "lab-billing.html?billId=" + encodeURIComponent(bId);
      };
    } else {
      billBtn.textContent = "💰 Generate Lab Bill →";
      billBtn.onclick = function () {
        window.location.href = "lab-billing.html?orderId=" + encodeURIComponent(orderId);
      };
    }
    container.appendChild(billBtn);
  }
}

/* =========================================================
   VIEW ORDER
   ========================================================= */
function viewLabTest(orderNumber) {
  window.location.href =
    "test-details.html?orderId=" + encodeURIComponent(orderNumber);
}

/* =========================================================
   STATUS LIFECYCLE TRANSITIONS
   ========================================================= */
function collectSample(orderNumber) {
  const orders = loadLabOrdersFromStorage();
  const index = orders.findIndex(function (order) {
    return (
      String(order.orderNumber || order.id) === String(orderNumber)
    );
  });

  if (index === -1) {
    alert("Laboratory order not found.");
    return null;
  }

  const order = orders[index];
  const now = new Date().toISOString();
  order.status = "SAMPLE_COLLECTED";
  order.sampleCollectedAt = now;
  order.updatedAt = now;

  writeJSON(LAB_ORDERS_KEY, orders);
  labOrders = orders;
  return order;
}

function startLabProcessing(orderNumber) {
  const orders = loadLabOrdersFromStorage();
  const index = orders.findIndex(function (order) {
    return (
      String(order.orderNumber || order.id) === String(orderNumber)
    );
  });

  if (index === -1) {
    alert("Laboratory order not found.");
    return null;
  }

  const order = orders[index];
  const now = new Date().toISOString();
  order.status = "PROCESSING";
  order.processingStartedAt = now;
  order.updatedAt = now;

  writeJSON(LAB_ORDERS_KEY, orders);
  labOrders = orders;
  return order;
}

function handleCollectSample() {
  const orderNumber =
    getElementValue("orderId") ||
    new URLSearchParams(window.location.search).get("orderId");

  if (!orderNumber) return;
  const order = collectSample(orderNumber);
  if (!order) return;

  loadTestDetails();
  showMessage("message", "Sample collected successfully.", "success");
}

function handleStartProcessing() {
  const orderNumber =
    getElementValue("orderId") ||
    new URLSearchParams(window.location.search).get("orderId");

  if (!orderNumber) return;
  const order = startLabProcessing(orderNumber);
  if (!order) return;

  loadTestDetails();
  showMessage("message", "Laboratory processing started.", "success");
}

function cancelLabOrder(orderNumber) {
  const orders = loadLabOrdersFromStorage();
  const index = orders.findIndex(function (order) {
    return (
      String(order.orderNumber || order.id) === String(orderNumber)
    );
  });

  if (index === -1) {
    alert("Laboratory order not found.");
    return null;
  }

  const order = orders[index];
  order.status = "Cancelled";
  order.updatedAt = new Date().toISOString();

  writeJSON(LAB_ORDERS_KEY, orders);
  labOrders = orders;
  return order;
}

/* =========================================================
   RESULT PAGE & ENTRY
   ========================================================= */
function goToResults(orderNumber) {
  const id =
    orderNumber ||
    getElementValue("orderId") ||
    new URLSearchParams(window.location.search).get("orderId") ||
    new URLSearchParams(window.location.search).get("id");

  if (!id) return;
  window.location.href = "enter-results.html?orderId=" + encodeURIComponent(id);
}

function loadResultTest() {
  const params = new URLSearchParams(window.location.search);
  const orderNumber = params.get("orderId") || params.get("id");

  if (!orderNumber) return;
  const order = findOrder(orderNumber);

  if (!order) {
    showMessage("resultMessage", "Laboratory order not found.", "error");
    return;
  }

  const masterTest = findMasterTest(order.testId) || (order.testName ? findMasterTestByName(order.testName) : null);
  const normalRange = String(order.normalRange || "").trim() || String((masterTest && masterTest.normalRange) || "").trim();
  const unit = String(order.unit || "").trim() || String((masterTest && masterTest.unit) || "").trim();

  const orderId = order.id || order.orderNumber;
  setElementValue("orderId", orderId);
  setElementValue("patientName", order.patientName);
  setElementValue("patientId", order.patientId);
  setElementValue("doctorName", order.doctorName || "Dr. Arun Kumar");
  setElementValue("testName", order.testName || (masterTest ? (masterTest.name || masterTest.testName) : ""));
  setElementValue("testId", order.testId || (masterTest ? masterTest.id : ""));
  setElementValue("normalRange", normalRange);
  setElementValue("testUnit", unit);
  setElementValue("testResult", order.result);
  setElementValue("result", order.result);
  setElementValue("remarks", order.remarks);
}

function saveLabResult(event) {
  if (event) event.preventDefault();

  const orderNumber =
    getElementValue("orderId") ||
    new URLSearchParams(window.location.search).get("orderId");

  const result =
    getElementValue("testResult") ||
    getElementValue("result");

  const remarks =
    getElementValue("testRemarks") ||
    getElementValue("remarks");

  if (!orderNumber) {
    showMessage("resultMessage", "Order ID is required.", "error");
    return false;
  }

  if (!result) {
    showMessage("resultMessage", "Please enter the laboratory result.", "error");
    return false;
  }

  const orders = loadLabOrdersFromStorage();
  const index = orders.findIndex(function (order) {
    return (
      String(order.orderNumber || order.id) === String(orderNumber)
    );
  });

  if (index === -1) {
    showMessage("resultMessage", "Laboratory order not found.", "error");
    return false;
  }

  const order = orders[index];
  const now = new Date().toISOString();

  // Preserve existing normalRange and unit; if missing or empty, populate from master test
  const masterTest = findMasterTest(order.testId) || (order.testName ? findMasterTestByName(order.testName) : null);
  const existingNormalRange = String(order.normalRange || "").trim();
  const existingUnit = String(order.unit || "").trim();
  if (!existingNormalRange && masterTest && masterTest.normalRange) {
    order.normalRange = String(masterTest.normalRange).trim();
  }
  if (!existingUnit && masterTest && masterTest.unit) {
    order.unit = String(masterTest.unit).trim();
  }

  order.result = result;
  order.remarks = remarks;
  order.status = "Completed";
  order.completedAt = now;
  order.resultEnteredAt = now;
  order.resultEnteredBy = getElementValue("resultEnteredBy") || "Lab Technician";
  order.updatedAt = now;

  writeJSON(LAB_ORDERS_KEY, orders);
  labOrders = orders;

  showMessage("resultMessage", "Laboratory result saved successfully.", "success");

  setTimeout(function () {
    window.location.href = "completed-tests.html";
  }, 500);

  return true;
}

/* =========================================================
   COMPLETED TESTS
   ========================================================= */
function loadCompletedTests() {
  const table = document.getElementById("completedTestsTable");
  if (!table) return;

  const tbody =
    document.getElementById("completedTestsBody") ||
    table.querySelector("tbody");

  if (!tbody) return;
  tbody.innerHTML = "";

  const orders = loadLabOrdersFromStorage().filter(function (order) {
    return isOrderCompleted(order.status);
  });

  if (orders.length === 0) {
    const row = tbody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 9;
    cell.style.textAlign = "center";
    cell.style.padding = "24px";
    cell.style.color = "var(--text-muted, #64748b)";
    cell.textContent = "No completed laboratory tests found.";
    return;
  }

  orders.forEach(function (order) {
    const row = tbody.insertRow();
    const orderId = order.id || order.orderNumber;

    row.insertCell().textContent = orderId;
    row.insertCell().textContent = order.patientName + (order.patientId ? " (" + order.patientId + ")" : "");
    row.insertCell().textContent = order.testName;
    const resultCell = row.insertCell();
    resultCell.innerHTML = '<strong>' + escapeHTML(order.result || "—") + '</strong>';
    row.insertCell().textContent = order.normalRange || "—";
    row.insertCell().textContent = order.unit || "—";
    row.insertCell().textContent = formatDate(order.completedAt || order.orderDate || order.requestedAt);

    const statusCell = row.insertCell();
    const badge = document.createElement("span");
    badge.className = "badge badge-success";
    badge.textContent = "Completed";
    statusCell.appendChild(badge);

    const actionCell = row.insertCell();
    actionCell.style.whiteSpace = "nowrap";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-primary btn-sm";
    button.textContent = "View Report";
    button.style.marginRight = "6px";
    button.onclick = function () {
      window.location.href = "test-details.html?orderId=" + encodeURIComponent(orderId);
    };
    actionCell.appendChild(button);

    const bills = getBills();
    const existingBill = bills.find(function (b) {
      return (
        (b.orderId && String(b.orderId).trim().toLowerCase() === String(orderId).trim().toLowerCase()) ||
        (order.billId && String(b.billId || b.id).trim().toLowerCase() === String(order.billId).trim().toLowerCase())
      );
    });

    if (existingBill) {
      const isPaid = String(existingBill.paymentStatus || existingBill.status || "").toLowerCase() === "paid";
      const bId = existingBill.billId || existingBill.id;
      const billBtn = document.createElement("button");
      billBtn.type = "button";
      billBtn.className = isPaid ? "btn btn-outline btn-sm" : "btn btn-secondary btn-sm";
      billBtn.textContent = isPaid ? "🧾 Bill Paid" : "💳 Pay Bill";
      billBtn.title = isPaid ? "Bill is Paid (" + bId + ")" : "Process Payment for " + bId;
      billBtn.onclick = function () {
        window.location.href = "lab-billing.html?billId=" + encodeURIComponent(bId);
      };
      actionCell.appendChild(billBtn);
    } else {
      const billBtn = document.createElement("button");
      billBtn.type = "button";
      billBtn.className = "btn btn-outline btn-sm";
      billBtn.textContent = "💰 Bill Test";
      billBtn.title = "Generate Bill for this test";
      billBtn.onclick = function () {
        window.location.href = "lab-billing.html?orderId=" + encodeURIComponent(orderId);
      };
      actionCell.appendChild(billBtn);
    }
  });
}

function loadCompletedTestDetails() {
  const params = new URLSearchParams(window.location.search);
  const orderNumber = params.get("orderId") || params.get("id");

  if (!orderNumber) return;
  const order = findOrder(orderNumber);
  if (!order) return;

  const masterTest = findMasterTest(order.testId) || (order.testName ? findMasterTestByName(order.testName) : null);
  const normalRange = String(order.normalRange || "").trim() || String((masterTest && masterTest.normalRange) || "").trim();
  const unit = String(order.unit || "").trim() || String((masterTest && masterTest.unit) || "").trim();

  setElementValue("orderId", order.id || order.orderNumber);
  setElementValue("patientName", order.patientName);
  setElementValue("patientId", order.patientId);
  setElementValue("doctorName", order.doctorName || "Dr. Arun Kumar");
  setElementValue("testName", order.testName || (masterTest ? (masterTest.name || masterTest.testName) : ""));
  setElementValue("testCategory", order.category || (masterTest ? masterTest.category : "") || "General");
  setElementValue("testResult", order.result);
  setElementValue("completedResult", order.result);
  setElementValue("testRemarks", order.remarks);
  setElementValue("resultDetails", order.remarks);
  setElementValue("normalRange", normalRange);
  setElementValue("testUnit", unit);
  setElementValue("resultEnteredBy", order.resultEnteredBy || "Lab Technician");
  setElementText("completedAt", formatDateTime(order.completedAt));
}

/* =========================================================
   LAB BILLING (cms_billing)
   ========================================================= */
function getBills() {
  const bills = readJSON(BILLING_KEY, []);
  return Array.isArray(bills) ? bills : [];
}

function saveBills(bills) {
  return writeJSON(BILLING_KEY, bills);
}

function generateLabBillNumber() {
  const bills = getBills();
  let highest = 0;
  bills.forEach(function (bill) {
    const value = String(bill.billId || bill.id || "");
    const match = value.match(/(\d+)$/);
    if (match) {
      highest = Math.max(highest, Number(match[1]));
    }
  });
  return "LAB-BILL-" + String(highest + 1).padStart(4, "0");
}

function populateLabOrderSelect() {
  const select = document.getElementById("labOrderSelect");
  if (!select) return;

  const orders = loadLabOrdersFromStorage();
  select.innerHTML = '<option value="">-- Select Doctor Lab Order --</option>';

  if (orders.length === 0) {
    select.innerHTML = '<option value="">-- No Doctor Lab Orders Available --</option>';
    return;
  }

  orders.forEach(function (order) {
    const orderId = order.id || order.orderNumber;
    const option = document.createElement("option");
    option.value = orderId;
    option.textContent =
      orderId + " - " + order.patientName + " (" + order.testName + " - " + getStatusLabel(order.status) + ")";
    select.appendChild(option);
  });

  // Check URL param orderId
  const params = new URLSearchParams(window.location.search);
  const targetOrderId = params.get("orderId") || params.get("id");
  if (targetOrderId) {
    select.value = targetOrderId;
    onLabOrderSelectChange(targetOrderId);
  }
}

function onLabOrderSelectChange(orderId) {
  if (!orderId) {
    setElementValue("orderId", "");
    setElementValue("patientName", "");
    setElementValue("patientId", "");
    setElementValue("doctorName", "");
    setElementValue("labTest", "");
    setElementValue("testId", "");
    setElementValue("labPrice", "");
    setElementText("labTotal", "0");
    return;
  }

  const order = findOrder(orderId);
  if (!order) {
    showMessage("billMessage", "Selected laboratory order not found.", "error");
    return;
  }

  setElementValue("orderId", order.id || order.orderNumber);
  setElementValue("patientName", order.patientName);
  setElementValue("patientId", order.patientId);
  setElementValue("doctorName", order.doctorName || "Dr. Arun Kumar");
  setElementValue("labTest", order.testName);
  setElementValue("testId", order.testId);

  // Use historical order price or fallback to current master
  const price = Number(order.price ?? (findMasterTest(order.testId)?.price || 0));
  setElementValue("labPrice", price);

  calculateLabBill();
}

function getQuantity() {
  const quantity = Number(
    getElementValue("labQuantity") ||
    getElementValue("quantity") ||
    1
  );
  return quantity > 0 ? quantity : 1;
}

function calculateLabBill() {
  const price = Number(getElementValue("labPrice") || 0);
  const quantity = getQuantity();
  const total = price * quantity;

  setElementValue("labTotal", total.toFixed(2));
  setElementText("labTotal", total.toFixed(2));
  setElementValue("totalAmount", total.toFixed(2));
}

function updateLabBillingPrice() {
  calculateLabBill();
}

function updateBillingTotal() {
  calculateLabBill();
}

function generateLabBill(event) {
  if (event) event.preventDefault();

  const orderId =
    getElementValue("orderId") ||
    getElementValue("labOrderSelect");

  const patientName = getElementValue("patientName");
  const patientId = getElementValue("patientId");
  const doctorName = getElementValue("doctorName") || "Dr. Arun Kumar";
  const testName = getElementValue("labTest");
  const testId = getElementValue("testId");
  const unitPrice = Number(getElementValue("labPrice") || 0);
  const quantity = getQuantity();
  const total = Number((unitPrice * quantity).toFixed(2));

  if (!orderId) {
    showMessage("billMessage", "Please select a Doctor Lab Order to bill.", "error");
    return false;
  }

  if (!patientName) {
    showMessage("billMessage", "Patient name is missing from order.", "error");
    return false;
  }

  if (!testName) {
    showMessage("billMessage", "Test name is missing from order.", "error");
    return false;
  }

  const order = findOrder(orderId);
  const now = new Date();
  const nowIso = now.toISOString();
  const billNumber = generateLabBillNumber();

  const bill = {
    billId: billNumber,
    id: billNumber,
    type: "Lab",
    billType: "LAB",
    orderId: orderId,
    patientName: patientName,
    patientId: patientId,
    doctorName: doctorName,
    testId: testId || (order ? order.testId : ""),
    testName: testName,
    category: order ? order.category : "General",
    quantity: quantity,
    price: unitPrice,
    unitPrice: unitPrice,
    total: total,
    amount: total,
    items: [
      {
        testId: testId || (order ? order.testId : ""),
        testName: testName,
        category: order ? order.category : "General",
        quantity: quantity,
        unitPrice: unitPrice,
        total: total
      }
    ],
    status: "Unpaid",
    paymentStatus: "Unpaid",
    paymentMethod: "",
    method: "",
    paymentReference: "",
    reference: "",
    billDate: nowIso,
    createdAt: nowIso,
    paidAt: "",
    paidDate: ""
  };

  const bills = getBills();
  bills.unshift(bill);

  if (!saveBills(bills)) {
    showMessage("billMessage", "Unable to save laboratory bill.", "error");
    return false;
  }

  // Update order with bill reference if order exists
  if (order) {
    const allOrders = loadLabOrdersFromStorage();
    const idx = allOrders.findIndex(function (o) {
      return String(o.id || o.orderNumber).trim().toLowerCase() === String(orderId).trim().toLowerCase();
    });
    if (idx !== -1) {
      allOrders[idx].billId = billNumber;
      allOrders[idx].billStatus = "Unpaid";
      allOrders[idx].paymentStatus = "Unpaid";
      allOrders[idx].isPaid = false;
      writeJSON(LAB_ORDERS_KEY, allOrders);
    }
  }

  showMessage("billMessage", "✅ Lab bill generated successfully! Bill No: " + billNumber, "success");

  loadLabBillingHistory();

  // Automatically open the payment panel for this bill so technician can pay right away
  if (typeof showInlineLabPayment === "function") {
    showInlineLabPayment(
      billNumber,
      billNumber + " — " + patientName + " — ₹" + total.toFixed(2)
    );
  }

  return bill;
}

function loadLabBillingHistory() {
  const table =
    document.getElementById("labBillingTable") ||
    document.getElementById("billingTable");

  if (!table) return;
  const tbody = table.querySelector("tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const bills = getBills().filter(function (bill) {
    if (!bill) return false;
    const t = String(bill.type || bill.billType || "").toUpperCase();
    if (t === "LAB") return true;
    if (!bill.type && String(bill.billId || bill.id || "").startsWith("LAB-")) return true;
    if (bill.testId || bill.testName) return true;
    return false;
  });

  if (bills.length === 0) {
    const row = tbody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 7;
    cell.style.textAlign = "center";
    cell.style.padding = "20px";
    cell.style.color = "var(--text-muted, #64748b)";
    cell.textContent = "No lab bills generated yet.";
    return;
  }

  bills.forEach(function (bill) {
    const row = tbody.insertRow();
    const billId = bill.billId || bill.id || "";
    const isPaid = String(bill.paymentStatus || bill.status || "").toLowerCase() === "paid";
    const totalAmount = Number(bill.total !== undefined ? bill.total : (bill.amount !== undefined ? bill.amount : 0));

    row.insertCell().textContent = billId;
    row.insertCell().textContent = bill.patientName || "—";
    row.insertCell().textContent = bill.testName || (bill.items && bill.items[0] ? bill.items[0].testName : "Lab Investigation");
    row.insertCell().textContent = formatCurrency(totalAmount);

    const statusCell = row.insertCell();
    const badge = document.createElement("span");
    badge.className = "badge " + (isPaid ? "badge-success" : "badge-warning");
    badge.textContent = isPaid ? "Paid" : "Unpaid";
    statusCell.appendChild(badge);

    row.insertCell().textContent = formatDate(bill.billDate || bill.createdAt);

    const actionCell = row.insertCell();
    actionCell.style.whiteSpace = "nowrap";

    if (!isPaid) {
      const payBtn = document.createElement("button");
      payBtn.type = "button";
      payBtn.className = "btn btn-primary btn-sm";
      payBtn.textContent = "💳 Pay";
      payBtn.title = "Process payment for this bill";
      payBtn.style.marginRight = "6px";
      payBtn.onclick = function () {
        if (typeof showInlineLabPayment === "function") {
          showInlineLabPayment(
            billId,
            billId + " — " + (bill.patientName || "") + " — ₹" + totalAmount.toFixed(2)
          );
        } else {
          viewLabBill(billId);
        }
      };
      actionCell.appendChild(payBtn);
    }

    const printBtn = document.createElement("button");
    printBtn.type = "button";
    printBtn.className = "btn btn-outline btn-sm";
    printBtn.textContent = "🖨 Print";
    printBtn.title = "Print / Save as PDF";
    printBtn.onclick = function () {
      printLabBill(billId);
    };
    actionCell.appendChild(printBtn);
  });
}

function viewLabBill(billId) {
  window.location.href = "lab-billing.html?billId=" + encodeURIComponent(billId);
}

function loadLabBillDetails() {
  const params = new URLSearchParams(window.location.search);
  const billId = params.get("billId") || params.get("id");
  if (!billId) return;

  const bills = getBills();
  const bill = bills.find(function (item) {
    return String(item.billId || item.id).trim().toLowerCase() === String(billId).trim().toLowerCase();
  });

  if (!bill) {
    showMessage("billMessage", "Lab bill not found.", "error");
    return;
  }

  const idVal = bill.billId || bill.id || "";
  const isPaid = String(bill.paymentStatus || bill.status || "").toLowerCase() === "paid";
  const totalVal = Number(bill.total !== undefined ? bill.total : (bill.amount !== undefined ? bill.amount : 0));
  const testNameVal = bill.testName || (bill.items && bill.items[0] ? bill.items[0].testName : "Lab Investigation");
  const unitPriceVal = bill.price ?? bill.unitPrice ?? (bill.items && bill.items[0] ? bill.items[0].unitPrice : 0);
  const qtyVal = bill.quantity || (bill.items && bill.items[0] ? bill.items[0].quantity : 1);

  // Set hidden input
  setElementValue("billId", idVal);

  // Populate billDetailPanel spans
  setElementText("bd-billId", idVal);
  setElementText("bd-billDate", formatDateTime(bill.billDate || bill.createdAt));
  setElementText("bd-patientName", bill.patientName || "—");
  setElementText("bd-patientId", bill.patientId || "—");
  setElementText("bd-doctorName", bill.doctorName || "Dr. Arun Kumar");
  setElementText("bd-testName", testNameVal);
  setElementText("bd-testId", bill.testId || "—");
  setElementText("bd-quantity", String(qtyVal));
  setElementText("bd-unitPrice", formatCurrency(unitPriceVal));
  setElementText("bd-total", formatCurrency(totalVal));
  setElementText("bd-status", isPaid ? "Paid" : "Unpaid");

  const methodRow = document.getElementById("bd-methodRow");
  const refRow = document.getElementById("bd-refRow");
  if (isPaid && (bill.paymentMethod || bill.method)) {
    if (methodRow) methodRow.style.display = "";
    setElementText("bd-method", bill.paymentMethod || bill.method || "—");
  } else if (methodRow) {
    methodRow.style.display = "none";
  }

  if (isPaid && (bill.paymentReference || bill.reference)) {
    if (refRow) refRow.style.display = "";
    setElementText("bd-ref", bill.paymentReference || bill.reference || "—");
  } else if (refRow) {
    refRow.style.display = "none";
  }

  // Display the detail panel
  const detailPanel = document.getElementById("billDetailPanel");
  if (detailPanel) {
    detailPanel.style.display = "";
  }

  // If unpaid, display and pre-fill payment panel
  const paymentPanel = document.getElementById("paymentPanel");
  if (!isPaid) {
    if (typeof showInlineLabPayment === "function") {
      showInlineLabPayment(idVal, idVal + " — " + (bill.patientName || "") + " — ₹" + totalVal.toFixed(2));
    } else if (paymentPanel) {
      paymentPanel.style.display = "";
    }
  } else if (paymentPanel) {
    paymentPanel.style.display = "none";
  }
}

function markLabBillPaid(billId, paymentMethod, paymentReference) {
  const bills = getBills();
  const index = bills.findIndex(function (bill) {
    return String(bill.billId || bill.id).trim().toLowerCase() === String(billId).trim().toLowerCase();
  });

  if (index === -1) return null;
  const bill = bills[index];

  const now = new Date();
  const nowIso = now.toISOString();
  const todayStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");

  bill.status = "Paid";
  bill.paymentStatus = "Paid";
  bill.paymentMethod = paymentMethod || "Cash";
  bill.method = paymentMethod || "Cash";
  bill.paymentReference = paymentReference || "";
  bill.reference = paymentReference || "";
  bill.paidAt = nowIso;
  bill.paidDate = todayStr;

  saveBills(bills);

  // Sync with cms_lab_orders if orderId exists
  if (bill.orderId) {
    const orders = loadLabOrdersFromStorage();
    const oIdx = orders.findIndex(function (o) {
      return String(o.id || o.orderNumber).trim().toLowerCase() === String(bill.orderId).trim().toLowerCase();
    });
    if (oIdx !== -1) {
      orders[oIdx].paymentStatus = "Paid";
      orders[oIdx].billStatus = "Paid";
      orders[oIdx].isPaid = true;
      orders[oIdx].billId = bill.billId || bill.id;
      writeJSON(LAB_ORDERS_KEY, orders);
    }
  }

  // Record in cms_receipts
  try {
    const receipts = readJSON("cms_receipts", []);
    const targetId = String(bill.billId || bill.id);
    const existingIdx = receipts.findIndex(function (r) {
      return String(r.billId) === targetId;
    });
    const receiptObj = {
      id: "RCT-" + Date.now(),
      billId: targetId,
      type: "Lab",
      patientId: bill.patientId || "",
      patientName: bill.patientName || "",
      doctorName: bill.doctorName || "Dr. Arun Kumar",
      testName: bill.testName || (bill.items && bill.items[0] ? bill.items[0].testName : "Lab Investigation"),
      amount: bill.total ?? bill.amount ?? 0,
      method: paymentMethod || "Cash",
      reference: paymentReference || "",
      date: todayStr,
      status: "Paid",
      createdAt: nowIso
    };
    if (existingIdx !== -1) {
      receipts[existingIdx] = receiptObj;
    } else {
      receipts.unshift(receiptObj);
    }
    writeJSON("cms_receipts", receipts);
  } catch (e) {
    console.error("Error writing cms_receipts:", e);
  }

  return bill;
}

function processLabBillPayment(event) {
  if (event) event.preventDefault();

  const billId =
    getElementValue("billId") ||
    new URLSearchParams(window.location.search).get("billId") ||
    new URLSearchParams(window.location.search).get("id");

  const paymentMethod = getElementValue("paymentMethod");
  const paymentReference =
    getElementValue("paymentReference") ||
    getElementValue("reference");

  if (!billId) {
    showMessage("paymentMessage", "Bill ID is required. Please select a bill to pay.", "error");
    return false;
  }

  if (!paymentMethod) {
    showMessage("paymentMessage", "Please select a payment method.", "error");
    return false;
  }

  if ((paymentMethod === "UPI" || paymentMethod === "Card") && !paymentReference) {
    showMessage("paymentMessage", "Payment reference is required for " + paymentMethod + ".", "error");
    return false;
  }

  const bill = markLabBillPaid(billId, paymentMethod, paymentReference);
  if (!bill) {
    showMessage("paymentMessage", "Bill “" + billId + "” could not be updated.", "error");
    return false;
  }

  setElementValue("paymentStatus", "Paid");
  setElementText("billStatus", "Paid");
  setElementText("bd-status", "Paid");

  const methodRow = document.getElementById("bd-methodRow");
  const refRow = document.getElementById("bd-refRow");
  if (methodRow) {
    methodRow.style.display = "";
    setElementText("bd-method", paymentMethod);
  }
  if (refRow && paymentReference) {
    refRow.style.display = "";
    setElementText("bd-ref", paymentReference);
  }

  showMessage("paymentMessage", "✅ Payment of ₹" + Number(bill.total ?? bill.amount ?? 0).toFixed(2) + " processed successfully! Bill is now Paid.", "success");

  loadLabBillingHistory();

  return true;
}

/* =========================================================
   PRINT LAB BILL & LAB RESULT
   ========================================================= */
function printLabBill(billId) {
  const id =
    billId ||
    getElementValue("billId") ||
    new URLSearchParams(window.location.search).get("billId") ||
    new URLSearchParams(window.location.search).get("id");

  if (!id) {
    alert("Bill ID not found.");
    return;
  }

  const bill = getBills().find(function (item) {
    return String(item.billId || item.id) === String(id);
  });

  if (!bill) {
    alert("Lab bill not found.");
    return;
  }

  const item = bill.items && bill.items.length ? bill.items[0] : null;
  const testName = bill.testName || (item ? item.testName : "");
  const quantity = bill.quantity || (item ? item.quantity : 1);
  const unitPrice = bill.price ?? bill.unitPrice ?? (item ? item.unitPrice : 0);
  const total = bill.total ?? bill.amount ?? Number(unitPrice) * Number(quantity);

  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    alert("Please allow pop-ups to print the bill.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Laboratory Bill</title>
      <style>
        body { font-family: sans-serif; padding: 20px; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f8fafc; }
      </style>
    </head>
    <body>
      <h2>Clinic Management System</h2>
      <h3>Laboratory Bill</h3>
      <hr>
      <p><strong>Bill No:</strong> ${escapeHTML(bill.billId || bill.id || "")}</p>
      <p><strong>Date:</strong> ${escapeHTML(formatDateTime(bill.billDate || bill.createdAt))}</p>
      <p><strong>Patient:</strong> ${escapeHTML(bill.patientName || "")} ${bill.patientId ? "(" + escapeHTML(bill.patientId) + ")" : ""}</p>
      <p><strong>Doctor:</strong> ${escapeHTML(bill.doctorName || "Dr. Arun Kumar")}</p>
      <table>
        <thead>
          <tr>
            <th>Laboratory Test</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHTML(testName)}</td>
            <td>${escapeHTML(quantity)}</td>
            <td>${escapeHTML(formatCurrency(unitPrice))}</td>
            <td>${escapeHTML(formatCurrency(total))}</td>
          </tr>
        </tbody>
      </table>
      <h3>Total Amount: ${escapeHTML(formatCurrency(total))}</h3>
      <p><strong>Payment Status:</strong> ${escapeHTML(bill.paymentStatus || bill.status || "Unpaid")}</p>
      <hr>
      <p>Laboratory Department</p>
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(function () {
    printWindow.print();
  }, 250);
}

function printLabResult(orderNumber) {
  const id =
    orderNumber ||
    getElementValue("orderId") ||
    new URLSearchParams(window.location.search).get("orderId") ||
    new URLSearchParams(window.location.search).get("id");

  if (!id) {
    alert("Order ID not found.");
    return;
  }

  const order = findOrder(id);
  if (!order) {
    alert("Laboratory order not found.");
    return;
  }

  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    alert("Please allow pop-ups to print the result.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Laboratory Result Report</title>
      <style>
        body { font-family: sans-serif; padding: 20px; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f8fafc; }
      </style>
    </head>
    <body>
      <h2>Clinic Management System</h2>
      <h3>Laboratory Test Report</h3>
      <hr>
      <p><strong>Patient Name:</strong> ${escapeHTML(order.patientName || "")}</p>
      <p><strong>Patient ID:</strong> ${escapeHTML(order.patientId || "—")}</p>
      <p><strong>Doctor:</strong> ${escapeHTML(order.doctorName || "Dr. Arun Kumar")}</p>
      <p><strong>Test Name:</strong> ${escapeHTML(order.testName || "")}</p>
      <p><strong>Test ID:</strong> ${escapeHTML(order.testId || "—")}</p>
      <p><strong>Order No:</strong> ${escapeHTML(order.id || order.orderNumber || "")}</p>
      <p><strong>Category:</strong> ${escapeHTML(order.category || "")}</p>
      <p><strong>Order Date:</strong> ${escapeHTML(formatDate(order.orderDate || order.requestedAt))}</p>
      <hr>
      <table>
        <thead>
          <tr>
            <th>Test Name</th>
            <th>Result</th>
            <th>Normal Range</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHTML(order.testName || "")}</td>
            <td><strong>${escapeHTML(order.result || "—")}</strong></td>
            <td>${escapeHTML(order.normalRange || "—")}</td>
            <td>${escapeHTML(order.unit || "—")}</td>
          </tr>
        </tbody>
      </table>
      ${order.remarks ? `<p><strong>Remarks:</strong> ${escapeHTML(order.remarks)}</p>` : ""}
      <p><strong>Result Entered By:</strong> ${escapeHTML(order.resultEnteredBy || "Lab Technician")}</p>
      <p><strong>Completed Date:</strong> ${escapeHTML(formatDateTime(order.completedAt) || formatDate(order.completedAt) || "—")}</p>
      <hr>
      <p>Laboratory Department</p>
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(function () {
    printWindow.print();
  }, 250);
}

/* =========================================================
   SEARCH & AUTO REFRESH
   ========================================================= */
function filterTable(tableId, searchValue) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const value = String(searchValue || "").trim().toLowerCase();
  const rows = table.querySelectorAll("tbody tr");

  rows.forEach(function (row) {
    const text = String(row.textContent || "").toLowerCase();
    row.style.display = !value || text.includes(value) ? "" : "none";
  });
}

function searchLabOrders(searchValue) {
  const value = String(searchValue || "").trim().toLowerCase();
  const orders = loadLabOrdersFromStorage();
  if (!value) return orders;

  return orders.filter(function (order) {
    return (
      String(order.id || "").toLowerCase().includes(value) ||
      String(order.orderNumber || "").toLowerCase().includes(value) ||
      String(order.patientName || "").toLowerCase().includes(value) ||
      String(order.patientId || "").toLowerCase().includes(value) ||
      String(order.testName || "").toLowerCase().includes(value)
    );
  });
}

function searchLabBills(searchValue) {
  const value = String(searchValue || "").trim().toLowerCase();
  const bills = getBills().filter(function (bill) {
    return String(bill.type || bill.billType || "").toUpperCase() === "LAB";
  });
  if (!value) return bills;

  return bills.filter(function (bill) {
    return (
      String(bill.billId || bill.id || "").toLowerCase().includes(value) ||
      String(bill.patientName || "").toLowerCase().includes(value) ||
      String(bill.patientId || "").toLowerCase().includes(value) ||
      String(bill.testName || "").toLowerCase().includes(value)
    );
  });
}

function initializeLabSearch() {
  const pendingSearch = document.getElementById("pendingSearch");
  if (pendingSearch) {
    pendingSearch.addEventListener("input", function () {
      filterTable("pendingTestsTable", pendingSearch.value);
    });
  }

  const completedSearch = document.getElementById("completedSearch");
  if (completedSearch) {
    completedSearch.addEventListener("input", function () {
      filterTable("completedTestsTable", completedSearch.value);
    });
  }

  const billingSearch = document.getElementById("billingSearch");
  if (billingSearch) {
    billingSearch.addEventListener("input", function () {
      filterTable("billingTable", billingSearch.value);
      filterTable("labBillingTable", billingSearch.value);
    });
  }
}

function refreshDashboardCounts() {
  if (
    document.getElementById("pendingCount") ||
    document.getElementById("completedCount") ||
    document.getElementById("bannerPending")
  ) {
    loadDashboard();
  }
}

function initializeLabAutoRefresh() {
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    labOrders = loadLabOrdersFromStorage();
    refreshDashboardCounts();
    if (document.getElementById("pendingTestsTable") || document.getElementById("pendingTestsBody")) {
      loadPendingLabOrders();
    }
    if (document.getElementById("completedTestsTable") || document.getElementById("completedTestsBody")) {
      loadCompletedTests();
    }
    if (document.getElementById("billingTable") || document.getElementById("labBillingTable")) {
      loadLabBillingHistory();
    }
  });

  window.addEventListener("storage", function (event) {
    if (
      event.key === LAB_ORDERS_KEY ||
      event.key === BILLING_KEY ||
      event.key === LAB_TEST_MASTER_KEY
    ) {
      labOrders = loadLabOrdersFromStorage();
      refreshDashboardCounts();
      if (document.getElementById("pendingTestsTable") || document.getElementById("pendingTestsBody")) {
        loadPendingLabOrders();
      }
      if (document.getElementById("completedTestsTable") || document.getElementById("completedTestsBody")) {
        loadCompletedTests();
      }
      if (document.getElementById("billingTable") || document.getElementById("labBillingTable")) {
        loadLabBillingHistory();
      }
    }
  });
}

/* =========================================================
   COMPATIBILITY ALIASES
   ========================================================= */
function getLabTests() {
  return loadLabOrdersFromStorage();
}

function saveLabTests(tests) {
  if (!Array.isArray(tests)) return false;
  labOrders = tests;
  return writeJSON(LAB_ORDERS_KEY, tests);
}

function submitNewLabTest(event) {
  return addNewLabTest(event);
}

function submitLabResult(event) {
  return saveLabResult(event);
}

function submitLabBill(event) {
  return generateLabBill(event);
}

function submitBillPayment(event) {
  return processLabBillPayment(event);
}

function openLabTest(orderNumber) {
  viewLabTest(orderNumber);
}

function openLabBill(billId) {
  viewLabBill(billId);
}

function loadLabBilling() {
  populateLabOrderSelect();
  calculateLabBill();
  loadLabBillingHistory();
}

function loadLabBillingTests() {
  populateLabOrderSelect();
}

function populateLabTestSelect() {
  populateLabOrderSelect();
}

function updateSelectedLabTestDetails() {
  // Maintained for compatibility
}

function printCurrentLabResult() {
  const orderNumber =
    getElementValue("orderId") ||
    new URLSearchParams(window.location.search).get("orderId") ||
    new URLSearchParams(window.location.search).get("id");
  printLabResult(orderNumber);
}

function printCurrentLabBill() {
  const billId =
    getElementValue("billId") ||
    new URLSearchParams(window.location.search).get("billId") ||
    new URLSearchParams(window.location.search).get("id");
  printLabBill(billId);
}

function refreshLabData() {
  labOrders = loadLabOrdersFromStorage();
  loadDashboard();
  loadPendingLabOrders();
  loadCompletedTests();
  loadLabBillingHistory();
}

function isBillPaid(bill) {
  if (!bill) return false;
  return String(bill.paymentStatus || bill.status || "").toLowerCase() === "paid";
}

function getBillStatusLabel(bill) {
  if (!bill) return "Unpaid";
  return bill.paymentStatus || bill.status || "Unpaid";
}

function goToPendingLabOrders() {
  window.location.href = "pending-lab-orders.html";
}

function goToCompletedLabTests() {
  window.location.href = "completed-tests.html";
}

function goToCompletedTests() {
  window.location.href = "completed-tests.html";
}

function goToEnterNewLabTest() {
  window.location.href = "pending-lab-orders.html";
}

function goToLabBilling() {
  window.location.href = "lab-billing.html";
}

function goToBilling() {
  window.location.href = "lab-billing.html";
}

/* =========================================================
   DOM READY INITIALIZATION
   ========================================================= */
document.addEventListener("DOMContentLoaded", function () {
  initLabUI();
  labOrders = loadLabOrdersFromStorage();

  if (
    document.getElementById("pendingCount") ||
    document.getElementById("completedCount") ||
    document.getElementById("todayTestCount") ||
    document.getElementById("totalTestCount")
  ) {
    loadDashboard();
  }

  if (
    document.getElementById("pendingTestsTable") ||
    document.getElementById("pendingTestsBody")
  ) {
    loadPendingLabOrders();
  }

  if (
    document.getElementById("testStatus") ||
    (document.getElementById("orderId") && document.getElementById("testName") && !document.getElementById("labBillingForm"))
  ) {
    loadTestDetails();
  }

  if (
    document.getElementById("testResult") ||
    document.getElementById("result")
  ) {
    loadResultTest();
  }

  if (
    document.getElementById("completedTestsTable") ||
    document.getElementById("completedTestsBody")
  ) {
    loadCompletedTests();
  }

  if (
    document.getElementById("completedResult") ||
    document.getElementById("resultDetails")
  ) {
    loadCompletedTestDetails();
  }

  if (
    document.getElementById("labOrderSelect") ||
    document.getElementById("labBillingForm") ||
    document.getElementById("labBillingTable") ||
    document.getElementById("billingTable")
  ) {
    loadLabBilling();
  }

  if (
    document.getElementById("billId") &&
    (document.getElementById("paymentStatus") || document.getElementById("paymentMethod"))
  ) {
    loadLabBillDetails();
  }

  initializeLabSearch();
  initializeLabAutoRefresh();
});

/* =========================================================
   GLOBAL FUNCTION EXPORTS
   ========================================================= */
window.toggleSidebar = toggleSidebar;
window.logout = logout;
window.initLabUI = initLabUI;
window.addNewLabTest = addNewLabTest;
window.updateLabDashboard = updateLabDashboard;
window.loadDashboard = loadDashboard;
window.loadPendingLabOrders = loadPendingLabOrders;
window.loadTestDetails = loadTestDetails;
window.loadResultTest = loadResultTest;
window.saveLabResult = saveLabResult;
window.loadCompletedTests = loadCompletedTests;
window.loadCompletedTestDetails = loadCompletedTestDetails;
window.viewLabTest = viewLabTest;
window.collectSample = collectSample;
window.startLabProcessing = startLabProcessing;
window.cancelLabOrder = cancelLabOrder;
window.handleCollectSample = handleCollectSample;
window.handleStartProcessing = handleStartProcessing;
window.goToResults = goToResults;
window.calculateLabBill = calculateLabBill;
window.generateLabBill = generateLabBill;
window.populateLabOrderSelect = populateLabOrderSelect;
window.onLabOrderSelectChange = onLabOrderSelectChange;
window.loadLabBilling = loadLabBilling;
window.loadLabBillingTests = loadLabBillingTests;
window.loadLabBillingHistory = loadLabBillingHistory;
window.viewLabBill = viewLabBill;
window.markLabBillPaid = markLabBillPaid;
window.loadLabBillDetails = loadLabBillDetails;
window.processLabBillPayment = processLabBillPayment;
window.printLabBill = printLabBill;
window.printLabResult = printLabResult;
window.printCurrentLabResult = printCurrentLabResult;
window.printCurrentLabBill = printCurrentLabBill;
window.submitNewLabTest = submitNewLabTest;
window.submitLabResult = submitLabResult;
window.submitLabBill = submitLabBill;
window.submitBillPayment = submitBillPayment;
window.goToPendingLabOrders = goToPendingLabOrders;
window.goToCompletedLabTests = goToCompletedLabTests;
window.goToCompletedTests = goToCompletedTests;
window.goToEnterNewLabTest = goToEnterNewLabTest;
window.goToLabBilling = goToLabBilling;
window.goToBilling = goToBilling;
window.openLabTest = openLabTest;
window.openLabBill = openLabBill;
window.updateBillingTotal = updateBillingTotal;
window.updateLabBillingPrice = updateLabBillingPrice;
window.updateSelectedLabTestDetails = updateSelectedLabTestDetails;
window.searchLabOrders = searchLabOrders;
window.searchLabBills = searchLabBills;
window.refreshLabData = refreshLabData;
window.getStatusLabel = getStatusLabel;