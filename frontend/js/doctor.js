// ============================================================
// CMS — DOCTOR MODULE JAVASCRIPT
// File: js/doctor.js
// Used by: All pages in /doctor/
// ============================================================


// ============================================================
// 1. AUTH GUARD
// ============================================================

const loggedInUser = JSON.parse(
    localStorage.getItem('loggedInUser') || 'null'
);

if (
    !loggedInUser ||
    (loggedInUser.role !== 'doctor' &&
     loggedInUser.role !== 'admin')
) {
    window.location.href = '../index.html';
}


// ============================================================
// 2. COMMON CONSTANTS & DATE HELPERS
// ============================================================

function getToday() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

const TODAY = getToday();

function isAppointmentConsulted(appt) {
    if (!appt) return false;
    var apptId = (typeof appt === 'string') ? appt : appt.id;
    var status = (typeof appt === 'object') ? appt.status : null;

    if (status === 'Completed') return true;

    try {
        var appts = JSON.parse(localStorage.getItem('cms_appointments') || '[]');
        var foundAppt = appts.find(function (a) { return a.id === apptId; });
        if (foundAppt && foundAppt.status === 'Completed') return true;

        var consults = JSON.parse(localStorage.getItem('cms_consultations') || '[]');
        var foundConsult = consults.some(function (c) {
            return c.appointmentId && c.appointmentId === apptId;
        });
        if (foundConsult) return true;
    } catch (e) {}

    return false;
}

function isPatientConsultedToday(patientId, excludeApptId) {
    if (!patientId) return false;
    var today = getToday();

    try {
        var appts = JSON.parse(localStorage.getItem('cms_appointments') || '[]');
        var completedApptToday = appts.some(function (a) {
            if (excludeApptId && a.id === excludeApptId) return false;
            return a.patientId === patientId && a.date === today && a.status === 'Completed';
        });
        if (completedApptToday) return true;

        var consults = JSON.parse(localStorage.getItem('cms_consultations') || '[]');
        var consultedToday = consults.some(function (c) {
            if (excludeApptId && c.appointmentId === excludeApptId) return false;
            return c.patientId === patientId && c.date === today;
        });
        if (consultedToday) return true;
    } catch (e) {}

    return false;
}

const AVATAR_COLOURS = [
    '#9C6B5D', '#7e5249', '#5c3a32', '#2980b9', '#27ae60',
    '#d68910', '#8e44ad', '#c0392b', '#16a085', '#2c3e50'
];


// ============================================================
// 3. COMMON HELPER FUNCTIONS
// ============================================================

function getInitials(name) {

    return (name || '?')
        .split(' ')
        .map(function (w) { return w[0]; })
        .join('')
        .toUpperCase()
        .slice(0, 2);
}


function avatarColor(id) {

    var num = (id || '').replace(/\D/g, '');

    return AVATAR_COLOURS[
        parseInt(num || '0') % AVATAR_COLOURS.length
    ];
}


function statusBadgeClass(status) {

    var map = {
        'Waiting':       'badge-warning',
        'Confirmed':     'badge-info',
        'In Progress':   'badge-primary',
        'Completed':     'badge-success',
        'Cancelled':     'badge-danger'
    };

    return map[status] || 'badge-neutral';
}


function typeIcon(type) {

    var map = {
        'General':   '🩺',
        'Follow-up': '🔄',
        'Emergency': '🚨'
    };

    return map[type] || '📋';
}


function truncateText(str, len) {

    if (!str) return '';

    return str.length > len
        ? str.slice(0, len) + '…'
        : str;
}


function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


function animateCount(id, target) {

    var el = document.getElementById(id);

    if (!el) return;

    var cur = 0;
    var step = Math.ceil(target / 20) || 1;

    var timer = setInterval(function () {

        cur = Math.min(cur + step, target);
        el.textContent = cur;

        if (cur >= target) clearInterval(timer);

    }, 40);
}


// ============================================================
// 4. COMMON UI FUNCTIONS
// ============================================================

function initDoctorUI() {

    var name = loggedInUser.name ||
               loggedInUser.username ||
               'Doctor';

    var ini = getInitials(name);

    // Sidebar
    var sidebarAvatar = document.getElementById('sidebarAvatar');
    var sidebarName   = document.getElementById('sidebarName');

    if (sidebarAvatar) sidebarAvatar.textContent = ini;
    if (sidebarName)   sidebarName.textContent   = name;

    // Topbar
    var topbarAvatar = document.getElementById('topbarAvatar');
    var topbarName   = document.getElementById('topbarName');

    if (topbarAvatar) topbarAvatar.textContent = ini;
    if (topbarName)   topbarName.textContent   = name;

    // Update sidebar appointment badge
    updateSidebarBadge();
}


function updateSidebarBadge() {

    var appts = JSON.parse(
        localStorage.getItem('cms_appointments') || '[]'
    );

    var waiting = appts.filter(function (a) {
        return a.date === TODAY && a.status === 'Waiting';
    }).length;

    var badge = document.getElementById('sidebarApptBadge') ||
                document.getElementById('sidebarWaitBadge');

    if (badge) badge.textContent = waiting;
}


function initDateLabel() {

    var now  = new Date();
    var hour = now.getHours();
    var opts = {
        weekday: 'long',
        year:    'numeric',
        month:   'long',
        day:     'numeric'
    };

    var dateStr = now.toLocaleDateString('en-IN', opts);

    // Time of day greeting
    var tod = document.getElementById('timeOfDay');
    if (tod) {
        tod.textContent = hour < 12
            ? 'morning'
            : hour < 17
                ? 'afternoon'
                : 'evening';
    }

    // Topbar date
    var topDate = document.getElementById('topbarDate');
    if (topDate) topDate.textContent = dateStr;

    // Today label (appointments page)
    var todayLabel = document.getElementById('todayLabel');
    if (todayLabel) todayLabel.textContent = dateStr;

    var dateSub = document.getElementById('dateSubtitle');
    if (dateSub) {
        dateSub.textContent = 'Showing appointments for ' + dateStr;
    }

    // Modal date (consultation page)
    var mDate = document.getElementById('mDate');
    if (mDate) {
        mDate.textContent = now.toLocaleDateString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    }
}


// ============================================================
// 5. SIDEBAR & MOBILE NAVIGATION
// ============================================================

function openSidebar() {

    var sb = document.getElementById('sidebar');
    var ov = document.getElementById('sidebarOverlay');
    if (sb) sb.classList.add('open');
    if (ov) ov.classList.add('open');
}


function closeSidebar() {

    var sb = document.getElementById('sidebar');
    var ov = document.getElementById('sidebarOverlay');
    if (sb) sb.classList.remove('open');
    if (ov) ov.classList.remove('open');
}


function toggleSidebar() {

    var sb = document.getElementById('sidebar');
    var ov = document.getElementById('sidebarOverlay');
    if (sb && sb.classList.contains('open')) {
        closeSidebar();
    } else {
        openSidebar();
    }
}


// ============================================================
// 6. LOGOUT
// ============================================================

function logout() {

    if (!confirm('Are you sure you want to logout?')) {
        return;
    }

    localStorage.removeItem('loggedInUser');
    window.location.href = '../index.html';
}


// ============================================================
// 7. TOAST NOTIFICATIONS
// ============================================================

function showToast(msg, type) {

    type = type || 'info';

    var icons = {
        success: '✅',
        danger:  '⚠️',
        warning: '⚠️',
        info:    'ℹ️'
    };

    var bgColors = {
        success: '#2e7d32',
        danger:  '#d32f2f',
        warning: '#ed6c02',
        info:    '#1976d2'
    };

    var container = document.getElementById('toastContainer');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML =
        '<span style="font-size:1rem;">' +
        (icons[type] || 'ℹ️') +
        '</span><span>' + msg + '</span>';

    container.appendChild(toast);

    setTimeout(function () {

        toast.style.opacity    = '0';
        toast.style.transform  = 'translateX(24px)';
        toast.style.transition = 'all .3s ease';

        setTimeout(function () {
            toast.remove();
        }, 300);

    }, 3200);
}


// ============================================================
// 8. SEED DATA
// ============================================================

var SEED_APPOINTMENTS = [
    { id:'APT001', token:1,  patientId:'PAT001', patientName:'Rahul Menon',     age:24, gender:'Male',   blood:'O+',  phone:'9876543210', allergies:'None',        time:'09:00 AM', type:'General',   status:'Completed',   waitMin:0,  complaint:'Persistent headache for 3 days',          bookedOn:'2026-09-26', date:TODAY },
    { id:'APT002', token:2,  patientId:'PAT002', patientName:'Anu Thomas',      age:32, gender:'Female', blood:'A+',  phone:'9812345670', allergies:'Penicillin',  time:'09:30 AM', type:'Follow-up', status:'Completed',   waitMin:0,  complaint:'Post-surgery check-up',                   bookedOn:'2026-09-25', date:TODAY },
    { id:'APT003', token:3,  patientId:'PAT003', patientName:'Arjun Kumar',     age:45, gender:'Male',   blood:'B-',  phone:'9823456701', allergies:'Sulfa drugs', time:'10:00 AM', type:'General',   status:'In Progress', waitMin:5,  complaint:'Chest tightness and mild breathlessness',  bookedOn:'2026-09-27', date:TODAY },
    { id:'APT004', token:4,  patientId:'PAT004', patientName:'Priya Nair',      age:28, gender:'Female', blood:'AB+', phone:'9834567012', allergies:'None',        time:'10:30 AM', type:'General',   status:'Waiting',     waitMin:12, complaint:'Fever and sore throat since yesterday',   bookedOn:'2026-09-28', date:TODAY },
    { id:'APT005', token:5,  patientId:'PAT005', patientName:'Suresh Babu',     age:60, gender:'Male',   blood:'O-',  phone:'9845678123', allergies:'Aspirin',     time:'11:00 AM', type:'Follow-up', status:'Waiting',     waitMin:20, complaint:'Diabetes follow-up — monthly review',     bookedOn:'2026-09-20', date:TODAY },
    { id:'APT006', token:6,  patientId:'PAT006', patientName:'Lakshmi Devi',    age:38, gender:'Female', blood:'A-',  phone:'9856789234', allergies:'None',        time:'11:30 AM', type:'General',   status:'Waiting',     waitMin:30, complaint:'Skin rash on arms for 1 week',            bookedOn:'2026-09-28', date:TODAY },
    { id:'APT007', token:7,  patientId:'PAT007', patientName:'Mohammed Rizwan', age:22, gender:'Male',   blood:'B+',  phone:'9867890345', allergies:'None',        time:'12:00 PM', type:'Emergency', status:'Waiting',     waitMin:35, complaint:'Acute abdominal pain — sudden onset',     bookedOn:'2026-09-28', date:TODAY },
    { id:'APT008', token:8,  patientId:'PAT008', patientName:'Divya Krishnan',  age:35, gender:'Female', blood:'O+',  phone:'9878901456', allergies:'Latex',       time:'12:30 PM', type:'Follow-up', status:'Waiting',     waitMin:42, complaint:'Thyroid follow-up',                       bookedOn:'2026-09-22', date:TODAY },
    { id:'APT009', token:9,  patientId:'PAT009', patientName:'Ravi Shankar',    age:50, gender:'Male',   blood:'A+',  phone:'9889012567', allergies:'None',        time:'01:00 PM', type:'General',   status:'Confirmed',   waitMin:50, complaint:'Back pain — lower lumbar region',         bookedOn:'2026-09-28', date:TODAY },
    { id:'APT010', token:10, patientId:'PAT010', patientName:'Meera Pillai',    age:29, gender:'Female', blood:'B+',  phone:'9890123678', allergies:'Codeine',     time:'01:30 PM', type:'General',   status:'Confirmed',   waitMin:58, complaint:'Migraine with visual aura',               bookedOn:'2026-09-27', date:TODAY },
    { id:'APT011', token:11, patientId:'PAT011', patientName:'Anand Mohan',     age:41, gender:'Male',   blood:'AB-', phone:'9801234789', allergies:'None',        time:'02:00 PM', type:'General',   status:'Confirmed',   waitMin:66, complaint:'Weakness and fatigue for 2 weeks',        bookedOn:'2026-09-28', date:TODAY },
    { id:'APT012', token:12, patientId:'PAT012', patientName:'Kavitha Ramesh',  age:55, gender:'Female', blood:'O+',  phone:'9812340890', allergies:'Iodine',      time:'02:30 PM', type:'Follow-up', status:'Confirmed',   waitMin:75, complaint:'Blood pressure monitoring visit',         bookedOn:'2026-09-18', date:TODAY }
];

var DEFAULT_PATIENTS = [
    { id:'PAT001', name:'Rahul Menon',     age:24, gender:'Male',   blood:'O+',  phone:'9876543210', allergies:'None',        chronic:'None',               status:'Active' },
    { id:'PAT002', name:'Anu Thomas',      age:32, gender:'Female', blood:'A+',  phone:'9812345670', allergies:'Penicillin',  chronic:'Post-Surgery Check', status:'Active' },
    { id:'PAT003', name:'Arjun Kumar',     age:45, gender:'Male',   blood:'B-',  phone:'9823456701', allergies:'Sulfa drugs', chronic:'Hypertension',       status:'Active' },
    { id:'PAT004', name:'Priya Nair',      age:28, gender:'Female', blood:'AB+', phone:'9834567012', allergies:'None',        chronic:'None',               status:'Active' },
    { id:'PAT005', name:'Suresh Babu',     age:60, gender:'Male',   blood:'O-',  phone:'9845678123', allergies:'Aspirin',     chronic:'Type 2 Diabetes',   status:'Active' },
    { id:'PAT006', name:'Lakshmi Devi',    age:38, gender:'Female', blood:'A-',  phone:'9856789234', allergies:'None',        chronic:'None',               status:'Active' },
    { id:'PAT007', name:'Mohammed Rizwan', age:22, gender:'Male',   blood:'B+',  phone:'9867890345', allergies:'None',        chronic:'Gastritis',          status:'Active' },
    { id:'PAT008', name:'Divya Krishnan',  age:35, gender:'Female', blood:'O+',  phone:'9878901456', allergies:'Latex',       chronic:'Hypothyroidism',    status:'Active' },
    { id:'PAT009', name:'Ravi Shankar',    age:50, gender:'Male',   blood:'A+',  phone:'9889012567', allergies:'None',        chronic:'Lumbar Spondylosis', status:'Active' },
    { id:'PAT010', name:'Meera Pillai',    age:29, gender:'Female', blood:'B+',  phone:'9890123678', allergies:'Codeine',     chronic:'Migraine',           status:'Active' },
    { id:'PAT011', name:'Anand Mohan',     age:41, gender:'Male',   blood:'AB-', phone:'9801234789', allergies:'None',        chronic:'Asthma',             status:'Active' },
    { id:'PAT012', name:'Kavitha Ramesh',  age:55, gender:'Female', blood:'O+',  phone:'9812340890', allergies:'Iodine',      chronic:'Hypertension',       status:'Active' }
];

// Master Data Helpers
function getMasterMedicines() {
    var raw = JSON.parse(localStorage.getItem('cms_medicines') || '[]');
    if (!raw || raw.length === 0) {
        raw = [
            { id: 'MED001', name: 'Paracetamol 500mg', category: 'Tablet', unit: 'Strip', price: 25, stock: 100, reorderLevel: 20, batchNo: 'PCM2026A', expiryDate: '2027-08-31', status: 'Active' },
            { id: 'MED002', name: 'Amoxicillin 500mg', category: 'Capsule', unit: 'Strip', price: 80, stock: 50, reorderLevel: 10, batchNo: 'AMX2026A', expiryDate: '2027-06-30', status: 'Active' },
            { id: 'MED003', name: 'Cetirizine 10mg', category: 'Tablet', unit: 'Strip', price: 30, stock: 40, reorderLevel: 10, batchNo: 'CET2026A', expiryDate: '2027-10-31', status: 'Active' },
            { id: 'MED004', name: 'Azithromycin 250mg', category: 'Tablet', unit: 'Strip', price: 60, stock: 30, reorderLevel: 8, batchNo: 'AZI2026A', expiryDate: '2027-02-28', status: 'Active' },
            { id: 'MED005', name: 'Omeprazole 20mg', category: 'Capsule', unit: 'Strip', price: 45, stock: 60, reorderLevel: 15, batchNo: 'OME2026A', expiryDate: '2027-07-31', status: 'Active' },
            { id: 'MED006', name: 'Cough Syrup 100ml', category: 'Syrup', unit: 'Bottle', price: 90, stock: 25, reorderLevel: 5, batchNo: 'COU2026A', expiryDate: '2027-04-30', status: 'Active' },
            { id: 'MED007', name: 'Vitamin C 500mg', category: 'Tablet', unit: 'Box', price: 120, stock: 80, reorderLevel: 20, batchNo: 'VTC2026A', expiryDate: '2027-12-31', status: 'Active' },
            { id: 'MED008', name: 'Clotrimazole 1% Cream', category: 'Cream', unit: 'Tube', price: 55, stock: 12, reorderLevel: 5, batchNo: 'CLO2026A', expiryDate: '2027-03-31', status: 'Active' }
        ];
        localStorage.setItem('cms_medicines', JSON.stringify(raw));
        if (!localStorage.getItem('cms_medicine_id_sequence')) {
            localStorage.setItem('cms_medicine_id_sequence', '9');
        }
    }
    return raw;
}

function getActiveMedicines() {
    return getMasterMedicines().filter(function (m) {
        return (m.status || 'Active').toLowerCase() === 'active';
    });
}

function findMedicineById(id) {
    if (id === undefined || id === null) return null;
    var targetId = String(id).trim();
    if (!targetId) return null;
    return getMasterMedicines().find(function (m) {
        return m && m.id !== undefined && m.id !== null && String(m.id).trim() === targetId;
    }) || null;
}

var CANONICAL_LAB_TESTS = [
    {
        name: 'Complete Blood Count (CBC)',
        aliases: ['complete blood count', 'cbc', 'complete blood count (cbc)', 'hemogram', 'full blood count'],
        category: 'Hematology',
        price: 350,
        normalRange: '4,000–11,000',
        unit: '/µL',
        description: 'Complete blood count analysis',
        status: 'Active'
    },
    {
        name: 'Fasting Blood Sugar (FBS)',
        aliases: ['fasting blood sugar', 'fbs', 'fasting blood sugar (fbs)', 'blood glucose', 'blood glucose fasting', 'blood sugar', 'fasting glucose', 'glucose fasting'],
        category: 'Biochemistry',
        price: 150,
        normalRange: '70–100',
        unit: 'mg/dL',
        description: 'Blood glucose level test',
        status: 'Active'
    },
    {
        name: 'HbA1c Glycated Hemoglobin',
        aliases: ['hba1c', 'hba1c glycated hemoglobin', 'glycated hemoglobin', 'hemoglobin a1c', 'hba1c test'],
        category: 'Biochemistry',
        price: 450,
        normalRange: '< 5.7',
        unit: '%',
        description: '3-month average blood glucose',
        status: 'Active'
    },
    {
        name: 'Lipid Profile',
        aliases: ['lipid profile', 'lipid panel', 'cholesterol profile', 'lipid profile test'],
        category: 'Biochemistry',
        price: 500,
        normalRange: '< 200',
        unit: 'mg/dL',
        description: 'Cholesterol & triglyceride panel',
        status: 'Active'
    },
    {
        name: 'Liver Function Test (LFT)',
        aliases: ['liver function test', 'lft', 'liver function test (lft)', 'liver panel', 'hepatic function test', 'hepatic enzyme assessment'],
        category: 'Biochemistry',
        price: 650,
        normalRange: '0.2–1.2',
        unit: 'mg/dL',
        description: 'Hepatic enzyme assessment',
        status: 'Active'
    },
    {
        name: 'Renal Function Test (RFT)',
        aliases: ['renal function test', 'rft', 'renal function test (rft)', 'kidney function test', 'kidney function test (rft)', 'kft', 'kidney function panel'],
        category: 'Biochemistry',
        price: 550,
        normalRange: '0.6–1.2',
        unit: 'mg/dL',
        description: 'Kidney function panel',
        status: 'Active'
    },
    {
        name: 'Thyroid Profile (T3, T4, TSH)',
        aliases: ['thyroid profile', 'thyroid profile (t3, t4, tsh)', 'thyroid function test', 'tft', 't3 t4 tsh', 'thyroid hormone assessment'],
        category: 'Endocrinology',
        price: 600,
        normalRange: '0.4–4.0',
        unit: 'µIU/mL',
        description: 'Thyroid hormone assessment',
        status: 'Active'
    },
    {
        name: 'Urine Routine Examination',
        aliases: ['urine routine examination', 'urine routine', 'urinalysis', 'urine routine & microscopy', 'urine routine and microscopy'],
        category: 'Pathology',
        price: 180,
        normalRange: 'Normal / Pale Yellow',
        unit: '',
        description: 'Urine routine and microscopy',
        status: 'Active'
    },
    {
        name: '12-Lead ECG',
        aliases: ['12-lead ecg', '12 lead ecg', 'ecg', 'electrocardiogram', 'electrocardiogram recording'],
        category: 'Cardiology',
        price: 300,
        normalRange: 'Normal Sinus Rhythm',
        unit: 'ECG',
        description: 'Electrocardiogram recording',
        status: 'Active'
    },
    {
        name: 'Chest X-Ray PA View',
        aliases: ['chest x-ray pa view', 'chest x-ray', 'chest x ray', 'chest radiography', 'chest radiography pa view', 'chest x-ray pa'],
        category: 'Radiology',
        price: 400,
        normalRange: 'Normal Lung Fields & Cardiac Shadow',
        unit: 'Film',
        description: 'Chest radiography PA view',
        status: 'Active'
    }
];

function findCanonicalLabMatch(testName) {
    if (!testName) return null;
    var clean = String(testName).trim().toLowerCase();
    var stripped = clean.replace(/\(.*?\)/g, '').trim();

    for (var i = 0; i < CANONICAL_LAB_TESTS.length; i++) {
        var canonical = CANONICAL_LAB_TESTS[i];
        if (canonical.aliases.some(function (alias) { return alias === clean || alias === stripped; })) {
            return canonical;
        }
    }
    return null;
}

function cleanupMasterLabTests(masterTests) {
    if (!Array.isArray(masterTests) || masterTests.length === 0) {
        return { tests: [], modified: false };
    }

    var modified = false;
    var processedTests = masterTests.map(function (t) { return Object.assign({}, t); });

    var groups = {};

    processedTests.forEach(function (test) {
        var canonical = findCanonicalLabMatch(test.name || test.testName);
        var groupKey;
        if (canonical) {
            groupKey = 'canonical:' + canonical.name;
        } else {
            var cleanName = String(test.name || test.testName || '').trim().replace(/\s+/g, ' ').toLowerCase();
            var coreName = cleanName.replace(/\(.*?\)/g, '').trim();
            groupKey = 'custom:' + (coreName || cleanName || test.id);
        }

        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(test);
    });

    Object.keys(groups).forEach(function (groupKey) {
        var groupTests = groups[groupKey];
        var canonical = groupKey.indexOf('canonical:') === 0
            ? CANONICAL_LAB_TESTS.find(function (c) { return 'canonical:' + c.name === groupKey; })
            : null;

        // Sort so lowest numeric ID (e.g. LAB001 < LAB009) is the primary record
        groupTests.sort(function (a, b) {
            var numA = parseInt((String(a.id || '').match(/\d+/) || [999999])[0], 10);
            var numB = parseInt((String(b.id || '').match(/\d+/) || [999999])[0], 10);
            if (numA !== numB) return numA - numB;
            return String(a.id).localeCompare(String(b.id));
        });

        var primary = groupTests[0];

        var bestNormalRange = String(primary.normalRange || '').trim();
        var bestUnit = String(primary.unit || '').trim();
        var bestDescription = String(primary.description || '').trim();

        for (var i = 1; i < groupTests.length; i++) {
            var dup = groupTests[i];
            if (!bestNormalRange && String(dup.normalRange || '').trim()) {
                bestNormalRange = String(dup.normalRange).trim();
            }
            if (!bestUnit && String(dup.unit || '').trim()) {
                bestUnit = String(dup.unit).trim();
            }
            if (!bestDescription && String(dup.description || '').trim()) {
                bestDescription = String(dup.description).trim();
            }
        }

        if (canonical) {
            if (!bestNormalRange && canonical.normalRange) bestNormalRange = canonical.normalRange;
            if (!bestUnit && canonical.unit) bestUnit = canonical.unit;
            if (!bestDescription && canonical.description) bestDescription = canonical.description;
        }

        // Backfill missing properties on Primary record
        if (bestNormalRange && String(primary.normalRange || '').trim() !== bestNormalRange) {
            primary.normalRange = bestNormalRange;
            modified = true;
        }
        if (bestUnit && String(primary.unit || '').trim() !== bestUnit) {
            primary.unit = bestUnit;
            modified = true;
        }
        if (bestDescription && String(primary.description || '').trim() !== bestDescription) {
            primary.description = bestDescription;
            modified = true;
        }
        if (canonical && (!primary.category || primary.category === 'General' || primary.category === 'Other')) {
            primary.category = canonical.category;
            modified = true;
        }
        if (canonical && (!primary.price || Number(primary.price) === 0)) {
            primary.price = canonical.price;
            modified = true;
        }
        if (!primary.status) {
            primary.status = 'Active';
            modified = true;
        }

        // Duplicate records are retained for historical references, but deactivated
        for (var j = 1; j < groupTests.length; j++) {
            var duplicate = groupTests[j];
            if (duplicate.status !== 'Inactive') {
                duplicate.status = 'Inactive';
                modified = true;
            }
            if (!String(duplicate.normalRange || '').trim() && bestNormalRange) {
                duplicate.normalRange = bestNormalRange;
                modified = true;
            }
            if (!String(duplicate.unit || '').trim() && bestUnit) {
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

function getMasterLabTests() {
    var raw = JSON.parse(localStorage.getItem('cms_lab_tests') || '[]');
    var master = raw.filter(function (t) {
        if (t.recordType === 'master') return true;
        if (t.patientId || t.patientName || t.consultationId || t.requestedAt || t.orderDate) return false;
        return t.id && (t.name || t.testName);
    });

    if (master.length === 0) {
        master = [
            { id: 'LAB001', name: 'Complete Blood Count (CBC)', category: 'Hematology', price: 350, normalRange: '4,000–11,000', unit: '/µL', description: 'Complete blood count analysis', status: 'Active', recordType: 'master' },
            { id: 'LAB002', name: 'Fasting Blood Sugar (FBS)', category: 'Biochemistry', price: 150, normalRange: '70–100', unit: 'mg/dL', description: 'Blood glucose level test', status: 'Active', recordType: 'master' },
            { id: 'LAB003', name: 'HbA1c Glycated Hemoglobin', category: 'Biochemistry', price: 450, normalRange: '< 5.7', unit: '%', description: '3-month average blood glucose', status: 'Active', recordType: 'master' },
            { id: 'LAB004', name: 'Lipid Profile', category: 'Biochemistry', price: 500, normalRange: '< 200', unit: 'mg/dL', description: 'Cholesterol & triglyceride panel', status: 'Active', recordType: 'master' },
            { id: 'LAB005', name: 'Liver Function Test (LFT)', category: 'Biochemistry', price: 650, normalRange: '0.2–1.2', unit: 'mg/dL', description: 'Hepatic enzyme assessment', status: 'Active', recordType: 'master' },
            { id: 'LAB006', name: 'Renal Function Test (RFT)', category: 'Biochemistry', price: 550, normalRange: '0.6–1.2', unit: 'mg/dL', description: 'Kidney function panel', status: 'Active', recordType: 'master' },
            { id: 'LAB007', name: 'Thyroid Profile (T3, T4, TSH)', category: 'Endocrinology', price: 600, normalRange: '0.4–4.0', unit: 'µIU/mL', description: 'Thyroid hormone assessment', status: 'Active', recordType: 'master' },
            { id: 'LAB008', name: 'Urine Routine Examination', category: 'Pathology', price: 180, normalRange: 'Normal / Pale Yellow', unit: '', description: 'Urine routine and microscopy', status: 'Active', recordType: 'master' },
            { id: 'LAB009', name: '12-Lead ECG', category: 'Cardiology', price: 300, normalRange: 'Normal Sinus Rhythm', unit: 'ECG', description: 'Electrocardiogram recording', status: 'Active', recordType: 'master' },
            { id: 'LAB010', name: 'Chest X-Ray PA View', category: 'Radiology', price: 400, normalRange: 'Normal Lung Fields & Cardiac Shadow', unit: 'Film', description: 'Chest radiography PA view', status: 'Active', recordType: 'master' }
        ];

        localStorage.setItem('cms_lab_tests', JSON.stringify(master));
    }

    var cleaned = cleanupMasterLabTests(master);
    if (cleaned.modified) {
        var legacyOrders = raw.filter(function (t) {
            return t.recordType !== 'master' && (t.patientId || t.patientName || t.consultationId || t.requestedAt || t.orderDate);
        });
        var catalogRecords = cleaned.tests.map(function (test) {
            return Object.assign({}, test, { recordType: 'master' });
        });
        localStorage.setItem('cms_lab_tests', JSON.stringify(legacyOrders.concat(catalogRecords)));
    }

    return cleaned.tests;
}

function getActiveMasterLabTests() {
    return getMasterLabTests().filter(function (t) {
        return (t.status || 'Active').toLowerCase() === 'active';
    });
}

function findLabTestById(id) {
    if (!id) return null;
    var targetId = String(id).trim();
    return getMasterLabTests().find(function (t) {
        return t && t.id !== undefined && t.id !== null && String(t.id).trim() === targetId;
    }) || null;
}

function getLabOrders() {
    var rawOrders = JSON.parse(localStorage.getItem('cms_lab_orders') || '[]');
    // Safe migration fallback if cms_lab_orders is null/not yet initialized
    if ((!rawOrders || rawOrders.length === 0) && localStorage.getItem('cms_lab_orders') === null) {
        var rawTests = JSON.parse(localStorage.getItem('cms_lab_tests') || '[]');
        var legacyOrders = rawTests.filter(function (t) {
            return t.recordType !== 'master' && (t.patientId || t.patientName) && (t.consultationId || t.requestedAt || t.orderDate);
        });
        if (legacyOrders.length > 0) {
            rawOrders = legacyOrders;
            localStorage.setItem('cms_lab_orders', JSON.stringify(legacyOrders));
        }
    }

    if (!Array.isArray(rawOrders)) {
        return [];
    }

    var hasRepairs = false;
    var normalizedOrders = rawOrders.map(function (order) {
        var masterTest = findLabTestById(order.testId);
        if (!masterTest && order.testName) {
            var searchName = String(order.testName).trim().toLowerCase();
            masterTest = getMasterLabTests().find(function (t) {
                return t && String(t.name || t.testName || '').trim().toLowerCase() === searchName;
            }) || null;
            if (!masterTest) {
                var cleanSearch = searchName.replace(/\(.*?\)/g, '').trim();
                masterTest = getMasterLabTests().find(function (t) {
                    var cleanName = String(t.name || t.testName || '').replace(/\(.*?\)/g, '').trim().toLowerCase();
                    return cleanName === cleanSearch || cleanName.indexOf(cleanSearch) !== -1 || cleanSearch.indexOf(cleanName) !== -1;
                }) || null;
            }
        }

        var existingNormalRange = String(order.normalRange || '').trim();
        var masterNormalRange = String((masterTest && masterTest.normalRange) || '').trim();
        var resolvedNormalRange = existingNormalRange || masterNormalRange;

        var existingUnit = String(order.unit || '').trim();
        var masterUnit = String((masterTest && masterTest.unit) || '').trim();
        var resolvedUnit = existingUnit || masterUnit;

        if (
            (!existingNormalRange && masterNormalRange) ||
            (!existingUnit && masterUnit) ||
            order.normalRange !== resolvedNormalRange ||
            order.unit !== resolvedUnit ||
            (!order.testId && masterTest && masterTest.id)
        ) {
            hasRepairs = true;
        }

        var updated = Object.assign({}, order);
        updated.normalRange = resolvedNormalRange;
        updated.unit = resolvedUnit;
        if (masterTest) {
            if (!updated.testId) updated.testId = masterTest.id;
            if (!updated.testName) updated.testName = masterTest.name;
            if (!updated.category) updated.category = masterTest.category;
            if (updated.price === undefined || updated.price === null || updated.price === '') {
                updated.price = Number(masterTest.price || 0);
            }
        }
        return updated;
    });

    if (hasRepairs && normalizedOrders.length > 0) {
        localStorage.setItem('cms_lab_orders', JSON.stringify(normalizedOrders));
    }

    return normalizedOrders;
}

var DEFAULT_RX = [
    {
        id: 'RX-98201', date: TODAY,
        patientId: 'PAT001', patientName: 'Rahul Menon',
        doctorName: 'Dr. Arun Kumar', status: 'Pending Dispensation',
        medicines: [
            { medicineId: 'MED001', medicine:'Paracetamol 500mg', dosage:'1 Tab', frequency:'1-0-1', duration:'3 Days', quantity: 6, instructions:'After food' },
            { medicineId: 'MED005', medicine:'Omeprazole 20mg', dosage:'1 Cap', frequency:'1-0-0', duration:'5 Days', quantity: 5, instructions:'Before food' }
        ]
    },
    {
        id: 'RX-98202', date: TODAY,
        patientId: 'PAT002', patientName: 'Anu Thomas',
        doctorName: 'Dr. Arun Kumar', status: 'Dispensed',
        medicines: [
            { medicineId: 'MED002', medicine:'Amoxicillin 500mg', dosage:'1 Cap', frequency:'1-0-1', duration:'5 Days', quantity: 10, instructions:'After food' },
            { medicineId: 'MED003', medicine:'Cetirizine 10mg',   dosage:'1 Tab', frequency:'0-0-1', duration:'5 Days', quantity: 5, instructions:'Bedtime' }
        ]
    },
    {
        id: 'RX-98203', date: TODAY,
        patientId: 'PAT003', patientName: 'Arjun Kumar',
        doctorName: 'Dr. Arun Kumar', status: 'Pending Dispensation',
        medicines: [
            { medicineId: 'MED004', medicine:'Azithromycin 250mg', dosage:'1 Tab', frequency:'1-0-0', duration:'5 Days', quantity: 5, instructions:'Morning after food' },
            { medicineId: 'MED007', medicine:'Vitamin C 500mg',   dosage:'1 Tab', frequency:'0-1-0', duration:'30 Days', quantity: 30, instructions:'Lunch' }
        ]
    },
    {
        id: 'RX-98190', date: '2026-02-14',
        patientId: 'PAT005', patientName: 'Suresh Babu',
        doctorName: 'Dr. Arun Kumar', status: 'Dispensed',
        medicines: [
            { medicineId: 'MED006', medicine:'Cough Syrup 100ml',  dosage:'10ml', frequency:'1-0-1', duration:'7 Days', quantity: 1, instructions:'With warm water' },
            { medicineId: 'MED001', medicine:'Paracetamol 500mg',  dosage:'1 Tab', frequency:'1-0-0', duration:'3 Days', quantity: 3, instructions:'Before breakfast' }
        ]
    }
];

var DEFAULT_LABS = [
    { id:'LABREQ-1001', orderNumber:'LABREQ-1001', orderDate:TODAY, patientId:'PAT001', patientName:'Rahul Menon', testId:'LAB001', testName:'Complete Blood Count (CBC)', category:'Hematology', price:350, priority:'Normal', status:'Completed', doctorId:'DOC001', doctorName:'Dr. Arun Kumar', appointmentId:'APT001', consultationId:'CNS-1001', summary:'Hb: 14.1 g/dL, WBC: 8,200/mcL, Platelets: 230,000/mcL.', result:'8,200', normalRange:'4,000–11,000', unit:'/µL', requestedAt: TODAY + ' 09:15:00', completedAt: TODAY + ' 10:30:00' },
    { id:'LABREQ-1002', orderNumber:'LABREQ-1002', orderDate:TODAY, patientId:'PAT003', patientName:'Arjun Kumar', testId:'LAB004', testName:'Lipid Profile', category:'Biochemistry', price:500, priority:'Urgent', status:'Pending', doctorId:'DOC001', doctorName:'Dr. Arun Kumar', appointmentId:'APT003', consultationId:'CNS-1002', summary:'Sample received at pathology lab; awaiting biochemistry autoanalyzer processing.', normalRange:'< 200', unit:'mg/dL', requestedAt: TODAY + ' 10:10:00' },
    { id:'LABREQ-1003', orderNumber:'LABREQ-1003', orderDate:TODAY, patientId:'PAT005', patientName:'Suresh Babu', testId:'LAB003', testName:'HbA1c Glycated Hemoglobin', category:'Biochemistry', price:450, priority:'Normal', status:'Completed', doctorId:'DOC001', doctorName:'Dr. Arun Kumar', appointmentId:'APT005', consultationId:'CNS-1003', summary:'HbA1c: 7.2% (Fair glycemic control).', result:'7.2', normalRange:'< 5.7', unit:'%', requestedAt: TODAY + ' 11:20:00', completedAt: TODAY + ' 12:45:00' },
    { id:'LABREQ-1004', orderNumber:'LABREQ-1004', orderDate:TODAY, patientId:'PAT007', patientName:'Mohammed Rizwan', testId:'LAB008', testName:'Urine Routine Examination', category:'Pathology', price:180, priority:'Urgent', status:'Pending', doctorId:'DOC001', doctorName:'Dr. Arun Kumar', appointmentId:'APT007', consultationId:'CNS-1004', summary:'Sample collection underway in diagnostic wing.', normalRange:'Normal / Pale Yellow', unit:'', requestedAt: TODAY + ' 12:15:00' },
    { id:'LABREQ-1005', orderNumber:'LABREQ-1005', orderDate:'2026-02-14', patientId:'PAT008', patientName:'Divya Krishnan', testId:'LAB007', testName:'Thyroid Profile (T3, T4, TSH)', category:'Endocrinology', price:600, priority:'Normal', status:'Completed', doctorId:'DOC001', doctorName:'Dr. Arun Kumar', appointmentId:'APT008', consultationId:'CNS-1005', summary:'TSH: 3.14 mIU/L (Euthyroid state). Free T4: 1.2 ng/dL.', result:'3.14', normalRange:'0.4–4.0', unit:'µIU/mL', requestedAt: '2026-02-14 10:45:00', completedAt: '2026-02-14 14:00:00' }
];


function seedAllData() {
    getMasterMedicines();
    getMasterLabTests();

    if (!localStorage.getItem('cms_appointments')) {
        localStorage.setItem(
            'cms_appointments',
            JSON.stringify(SEED_APPOINTMENTS)
        );
    }

    var patients = JSON.parse(
        localStorage.getItem('cms_patients') || '[]'
    );
    if (!patients || patients.length === 0) {
        localStorage.setItem(
            'cms_patients',
            JSON.stringify(DEFAULT_PATIENTS)
        );
    }

    var rx = JSON.parse(
        localStorage.getItem('cms_prescriptions') || '[]'
    );
    if (!rx || rx.length === 0) {
        localStorage.setItem(
            'cms_prescriptions',
            JSON.stringify(DEFAULT_RX)
        );
    }

    if (localStorage.getItem('cms_lab_orders') === null) {
        localStorage.setItem(
            'cms_lab_orders',
            JSON.stringify(DEFAULT_LABS)
        );
    }
}


// ============================================================
// 9. PAGE DETECTION
// ============================================================

function getCurrentPage() {

    var path = window.location.pathname;
    var file = path.split('/').pop();

    return file || 'dashboard.html';
}


// ============================================================
// 10. DASHBOARD PAGE
// ============================================================

var dashAllAppts = [];

function initDashboard() {

    var welcomeName = document.getElementById('welcomeName');
    var name = loggedInUser.name ||
               loggedInUser.username ||
               'Doctor';

    if (welcomeName) {
        welcomeName.textContent = 'Welcome back, ' + name + '!';
    }

    dashLoadData();
}


function dashLoadData() {

    var raw = JSON.parse(
        localStorage.getItem('cms_appointments') || '[]'
    );

    dashAllAppts = raw.filter(function (a) {
        return a.date === TODAY;
    });

    dashUpdateStats();
    dashRenderHero();
    dashRenderUpcoming();
    dashRenderCompleted();
    dashRenderProgress();
    dashRenderTypeBreakdown();
    dashRenderStatusBreakdown();
    dashRenderActivity();
}


function dashUpdateStats() {

    var total     = dashAllAppts.length;
    var waiting   = dashAllAppts.filter(function (a) {
        return a.status === 'Waiting';
    }).length;
    var completed = dashAllAppts.filter(function (a) {
        return a.status === 'Completed';
    }).length;

    animateCount('statTotal',     total);
    animateCount('statWaiting',   waiting);
    animateCount('statCompleted', completed);
    animateCount('statRx',        completed);

    var el;

    el = document.getElementById('bannerTotal');
    if (el) el.textContent = total;

    el = document.getElementById('bannerCompleted');
    if (el) el.textContent = completed;

    el = document.getElementById('bannerWaiting');
    if (el) el.textContent = waiting;

    el = document.getElementById('bannerPending');
    if (el) el.textContent = waiting;

    el = document.getElementById('sidebarApptBadge');
    if (el) el.textContent = waiting;
}


function dashRenderHero() {

    var inProg = dashAllAppts.find(function (a) {
        return a.status === 'In Progress';
    });

    if (inProg) {

        document.getElementById('heroToken').textContent =
            String(inProg.token).padStart(2, '0');

        document.getElementById('heroName').textContent =
            inProg.patientName;

        document.getElementById('heroMeta').textContent =
            inProg.time + ' · Token #' + inProg.token +
            ' · ' + inProg.type + ' · ' + inProg.complaint;

        document.getElementById('heroConsultBtn')
            .style.display = '';

    } else {

        document.getElementById('heroToken').textContent = '—';

        document.getElementById('heroName').textContent =
            'No Active Patient';

        document.getElementById('heroMeta').textContent =
            'Go to Appointments to call the next patient.';

        document.getElementById('heroConsultBtn')
            .style.display = 'none';
    }
}


function goConsult() {

    var inProg = dashAllAppts.find(function (a) {
        return a.status === 'In Progress';
    });

    if (inProg) {
        localStorage.setItem('cms_active_appointment', inProg.id);
        window.location.href = 'consultation.html?id=' + inProg.id;
    }
}


function dashRenderUpcoming() {

    var upcoming = dashAllAppts
        .filter(function (a) {
            return a.status === 'Waiting' ||
                   a.status === 'Confirmed';
        })
        .sort(function (a, b) {
            return a.token - b.token;
        })
        .slice(0, 6);

    var el = document.getElementById('upcomingList');
    var sub = document.getElementById('upcomingSubtitle');

    if (sub) {
        sub.textContent = upcoming.length + ' patient' +
            (upcoming.length !== 1 ? 's' : '') +
            ' still to see';
    }

    if (upcoming.length === 0) {
        el.innerHTML =
            '<div style="padding:24px;text-align:center;' +
            'color:var(--text-muted);font-size:var(--text-sm);">' +
            'All patients seen for today! 🎉</div>';
        return;
    }

    el.innerHTML = upcoming.map(function (a, i) {
        return '<div class="upcoming-row" ' +
            'onclick="location.href=\'appointments.html\'">' +
            '<div class="upcoming-token ' +
            (i === 0 ? 'active' : '') + '">' +
            String(a.token).padStart(2, '0') +
            '</div>' +
            '<div class="avatar avatar-sm" style="background:' +
            avatarColor(a.patientId) + ';flex-shrink:0;">' +
            getInitials(a.patientName) +
            '</div>' +
            '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:var(--text-sm);font-weight:600;' +
            'color:var(--text-primary);white-space:nowrap;' +
            'overflow:hidden;text-overflow:ellipsis;">' +
            a.patientName + '</div>' +
            '<div style="font-size:var(--text-xs);' +
            'color:var(--text-muted);">' +
            a.time + ' · ' + typeIcon(a.type) + ' ' + a.type +
            (a.complaint ? ' · ' + truncateText(a.complaint, 30) : '') +
            '</div></div>' +
            '<span class="badge ' + statusBadgeClass(a.status) +
            '" style="font-size:10px;">' + a.status +
            '</span></div>';
    }).join('');
}


function dashRenderCompleted() {

    var done = dashAllAppts
        .filter(function (a) {
            return a.status === 'Completed';
        })
        .sort(function (a, b) {
            return b.token - a.token;
        });

    var countEl = document.getElementById('completedCount');
    if (countEl) countEl.textContent = done.length + ' done';

    var tbody = document.getElementById('completedBody');

    if (done.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="5">' +
            '<div class="table-empty">' +
            '<div class="table-empty-icon">🩺</div>' +
            '<div class="table-empty-title">No consultations completed yet</div>' +
            '<div class="table-empty-desc">Completed patients will appear here.</div>' +
            '</div></td></tr>';
        return;
    }

    tbody.innerHTML = done.map(function (a) {
        return '<tr>' +
            '<td><span style="display:inline-flex;align-items:center;' +
            'justify-content:center;width:28px;height:28px;' +
            'border-radius:var(--radius-xs);background:var(--success-light);' +
            'color:var(--success);font-weight:700;font-size:var(--text-xs);">' +
            String(a.token).padStart(2, '0') +
            '</span></td>' +
            '<td><div style="display:flex;align-items:center;gap:8px;">' +
            '<div class="avatar avatar-sm" style="background:' +
            avatarColor(a.patientId) + ';">' +
            getInitials(a.patientName) + '</div><div>' +
            '<div class="td-primary" style="font-size:var(--text-sm);">' +
            a.patientName + '</div>' +
            '<div style="font-size:var(--text-xs);color:var(--text-muted);">' +
            a.patientId + '</div></div></div></td>' +
            '<td style="font-weight:600;font-size:var(--text-sm);">' +
            a.time + '</td>' +
            '<td style="font-size:var(--text-xs);">' +
            typeIcon(a.type) + ' ' + a.type + '</td>' +
            '<td style="font-size:var(--text-xs);color:var(--text-secondary);' +
            'max-width:160px;white-space:nowrap;overflow:hidden;' +
            'text-overflow:ellipsis;">' +
            (a.complaint || '—') + '</td></tr>';
    }).join('');
}


function dashRenderProgress() {

    var total     = dashAllAppts.length || 1;
    var completed = dashAllAppts.filter(function (a) {
        return a.status === 'Completed';
    }).length;

    var pct       = Math.round((completed / total) * 100);

    var remaining = dashAllAppts.filter(function (a) {
        return a.status !== 'Completed' &&
               a.status !== 'Cancelled';
    }).length;

    var circumference = 213.63;
    var offset = circumference - (circumference * pct / 100);

    var ring = document.getElementById('progressRing');
    if (ring) {
        setTimeout(function () {
            ring.style.strokeDashoffset = offset;
        }, 200);
    }

    var el;

    el = document.getElementById('progressPct');
    if (el) el.textContent = pct + '%';

    el = document.getElementById('ringDone');
    if (el) el.textContent = completed;

    el = document.getElementById('ringTotal');
    if (el) el.textContent = dashAllAppts.length;

    el = document.getElementById('ringRemaining');
    if (el) el.textContent = remaining + ' remaining today';
}


function dashRenderTypeBreakdown() {

    var types   = ['General', 'Follow-up', 'Emergency'];
    var total   = dashAllAppts.length || 1;
    var colours = {
        'General':   'var(--accent)',
        'Follow-up': 'var(--info)',
        'Emergency': 'var(--danger)'
    };

    var el = document.getElementById('typeBreakdown');
    if (!el) return;

    el.innerHTML = types.map(function (t) {

        var cnt = dashAllAppts.filter(function (a) {
            return a.type === t;
        }).length;

        var pct = Math.round((cnt / total) * 100);

        return '<div class="progress-bar-item">' +
            '<div class="progress-bar-label">' +
            '<span class="progress-bar-name">' +
            typeIcon(t) + ' ' + t + '</span>' +
            '<span class="progress-bar-value">' + cnt +
            '</span></div>' +
            '<div class="progress-track">' +
            '<div class="progress-fill" style="width:' +
            pct + '%;background:' + colours[t] + ';"></div>' +
            '</div></div>';

    }).join('');
}


function dashRenderStatusBreakdown() {

    var statuses = [
        'Waiting', 'In Progress', 'Confirmed',
        'Completed', 'Cancelled'
    ];

    var total   = dashAllAppts.length || 1;
    var colours = {
        'Waiting':     'var(--warning)',
        'In Progress': '#8e44ad',
        'Confirmed':   'var(--info)',
        'Completed':   'var(--success)',
        'Cancelled':   'var(--danger)'
    };

    var el = document.getElementById('statusBreakdown');
    if (!el) return;

    el.innerHTML = statuses.map(function (s) {

        var cnt = dashAllAppts.filter(function (a) {
            return a.status === s;
        }).length;

        if (cnt === 0) return '';

        var pct = Math.round((cnt / total) * 100);

        return '<div class="progress-bar-item">' +
            '<div class="progress-bar-label">' +
            '<span class="progress-bar-name">' + s + '</span>' +
            '<span class="progress-bar-value">' + cnt +
            '</span></div>' +
            '<div class="progress-track">' +
            '<div class="progress-fill" style="width:' +
            pct + '%;background:' + colours[s] + ';"></div>' +
            '</div></div>';

    }).join('');
}


function dashRenderActivity() {

    var activities = [
        { icon: '✅', text: '<strong>Anu Thomas</strong> consultation completed',            time: '9:58 AM',  type: 'success' },
        { icon: '✅', text: '<strong>Rahul Menon</strong> consultation completed',            time: '9:25 AM',  type: 'success' },
        { icon: '🩺', text: 'Started consulting <strong>Arjun Kumar</strong> — Token #03',   time: '10:02 AM', type: 'info' },
        { icon: '💊', text: 'Prescription written for <strong>Rahul Menon</strong>',          time: '9:22 AM',  type: 'warning' },
        { icon: '🧪', text: 'Lab test ordered for <strong>Anu Thomas</strong> — CBC',        time: '9:50 AM',  type: 'info' },
        { icon: '📋', text: '<strong>Suresh Babu</strong> added to waiting queue',            time: '10:30 AM', type: 'terra' }
    ];

    var el = document.getElementById('activityFeed');
    if (!el) return;

    el.innerHTML = activities.map(function (a, i) {
        return '<div class="activity-item">' +
            '<div class="activity-dot-col">' +
            '<div class="activity-dot ' +
            (a.type === 'success' ? 'success' : a.type === 'info' ? 'info' : '') +
            '">' + a.icon + '</div>' +
            (i < activities.length - 1 ? '<div class="activity-line"></div>' : '') +
            '</div>' +
            '<div class="activity-content">' +
            '<div class="activity-text">' + a.text + '</div>' +
            '<div class="activity-time">Today, ' + a.time + '</div>' +
            '</div></div>';
    }).join('');
}


// ============================================================
// 11. APPOINTMENTS PAGE
// ============================================================

var allAppointments = [];
var apptFiltered    = [];
var currentSort     = { key: 'token', dir: 'asc' };
var currentPage     = 1;
var perPage         = 15;
var searchQuery     = '';
var statusFilterVal = '';
var typeFilterVal   = '';
var activeDrawerId  = null;
var currentTokenId  = null;


function initAppointments() {

    loadAppointments();
    checkRedirectToast();
}


function checkRedirectToast() {

    try {
        var t = sessionStorage.getItem('cms_toast');
        if (t) {
            sessionStorage.removeItem('cms_toast');
            var parsed = JSON.parse(t);
            if (parsed && parsed.msg) {
                setTimeout(function () {
                    showToast(parsed.msg, parsed.type || 'info');
                }, 200);
            }
        }
    } catch (e) {}
}


function loadAppointments() {

    var all = JSON.parse(
        localStorage.getItem('cms_appointments') || '[]'
    );

    allAppointments = all.filter(function (a) {
        return a.date === TODAY;
    });

    apptApplyFilters();
    apptUpdateStats();
    apptRenderTokenQueue();
    apptRenderTypeBreakdown();
}


function apptApplyFilters() {

    var data = allAppointments.slice();

    // Search
    if (searchQuery) {
        var q = searchQuery.toLowerCase();
        data = data.filter(function (a) {
            return a.patientName.toLowerCase().indexOf(q) !== -1 ||
                   String(a.token).indexOf(q) !== -1 ||
                   a.time.toLowerCase().indexOf(q) !== -1 ||
                   a.patientId.toLowerCase().indexOf(q) !== -1;
        });
    }

    // Status filter
    if (statusFilterVal) {
        data = data.filter(function (a) {
            return a.status === statusFilterVal;
        });
    }

    // Type filter
    if (typeFilterVal) {
        data = data.filter(function (a) {
            return a.type === typeFilterVal;
        });
    }

    // Sort
    data.sort(function (a, b) {
        var aVal = a[currentSort.key];
        var bVal = b[currentSort.key];
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        if (aVal < bVal) return currentSort.dir === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSort.dir === 'asc' ?  1 : -1;
        return 0;
    });

    apptFiltered = data;
    currentPage  = 1;

    apptRenderTable();
    apptRenderPagination();
    apptUpdateTableCount();
}


function handleSearch(val) {
    if (document.getElementById('patientSearchInput')) {
        patientsApplyFilters();
        return;
    }

    searchQuery = (val || '').trim();

    var tableSearch = document.getElementById('tableSearchInput');
    var topSearch   = document.getElementById('topbarSearch');

    if (tableSearch) tableSearch.value = val;
    if (topSearch)   topSearch.value   = val;

    apptApplyFilters();
}

function applyFilters() {
    if (document.getElementById('patientSearchInput')) {
        patientsApplyFilters();
    } else if (typeof filterLabTests === 'function' && document.getElementById('mFilterStatus')) {
        filterLabTests();
    }
}

function handleTopbarSearch(val) {
    handleSearch(val);
}


function handleStatusFilter(val) {
    statusFilterVal = val;
    apptApplyFilters();
}


function handleTypeFilter(val) {
    typeFilterVal = val;
    apptApplyFilters();
}


function filterAll() {

    statusFilterVal = '';

    var sf = document.getElementById('statusFilter');
    if (sf) sf.value = '';

    var btnAll = document.getElementById('btnAll');
    if (btnAll) btnAll.classList.add('btn-secondary');

    ['btnWaiting', 'btnInProgress', 'btnCompleted'].forEach(
        function (id) {
            var el = document.getElementById(id);
            if (el) el.classList.remove('btn-secondary');
        }
    );

    apptApplyFilters();
}


function filterByStatus(status) {

    statusFilterVal = status;

    var sf = document.getElementById('statusFilter');
    if (sf) sf.value = status;

    apptApplyFilters();
}


function sortTable(key) {

    if (currentSort.key === key) {
        currentSort.dir =
            currentSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort = { key: key, dir: 'asc' };
    }

    ['th-token', 'th-time'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
            el.classList.remove('sorted', 'sort-asc', 'sort-desc');
            if (id === 'th-' + key) {
                el.classList.add('sorted', 'sort-' + currentSort.dir);
            }
        }
    });

    apptApplyFilters();
}


function apptRenderTable() {

    var tbody = document.getElementById('appointmentsTbody');
    if (!tbody) return;

    var start = (currentPage - 1) * perPage;
    var slice = apptFiltered.slice(start, start + perPage);

    if (slice.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="7">' +
            '<div class="table-empty">' +
            '<div class="table-empty-icon">📭</div>' +
            '<div class="table-empty-title">No appointments found</div>' +
            '<div class="table-empty-desc">Try adjusting your search or filter criteria.</div>' +
            '</div></td></tr>';
        return;
    }

    tbody.innerHTML = slice.map(function (a) {

        var sClass      = statusBadgeClass(a.status);
        var isInProgress = a.status === 'In Progress';
        var rowClass    = isInProgress ? 'class="current-patient"' : '';
        var tIcon       = typeIcon(a.type);

        return '<tr ' + rowClass + ' data-id="' + a.id + '">' +
            '<td><span style="display:inline-flex;align-items:center;' +
            'justify-content:center;width:30px;height:30px;' +
            'border-radius:var(--radius-xs);background:' +
            (isInProgress ? 'var(--accent)' : 'var(--clr-blush)') +
            ';color:' + (isInProgress ? '#fff' : 'var(--accent)') +
            ';font-weight:700;font-size:var(--text-xs);">' +
            (a.token < 10 ? '0' + a.token : a.token) +
            '</span></td>' +

            '<td><div style="display:flex;align-items:center;gap:10px;">' +
            '<div class="avatar avatar-sm" style="background:' +
            avatarColor(a.patientId) + ';">' +
            getInitials(a.patientName) + '</div><div>' +
            '<div class="td-primary" style="font-size:var(--text-sm);">' +
            a.patientName + '</div>' +
            '<div style="font-size:var(--text-xs);color:var(--text-muted);">' +
            a.patientId + '</div></div></div></td>' +

            '<td style="font-weight:600;font-size:var(--text-sm);' +
            'white-space:nowrap;">' + a.time + '</td>' +

            '<td><span style="font-size:var(--text-xs);">' +
            tIcon + ' ' + a.type + '</span></td>' +

            '<td><span class="badge ' + sClass + '">' +
            a.status + '</span></td>' +

            '<td><span style="font-size:var(--text-sm);color:' +
            (a.waitMin > 30 ? 'var(--danger)' : 'var(--text-secondary)') +
            ';">' + (a.status === 'Completed' ? '—' : a.waitMin + ' min') +
            '</span></td>' +

            '<td class="td-actions"><div class="td-actions-group">' +
            '<button class="action-btn view" title="Quick View" ' +
            'onclick="openDrawer(\'' + a.id + '\')">👁</button>' +

            (isAppointmentConsulted(a) || a.status === 'Completed'
                ? '<button class="action-btn" title="✓ Consulted Today" disabled style="opacity:0.55;cursor:not-allowed;pointer-events:none;">✓</button>'
                : (a.status !== 'Cancelled'
                    ? '<button class="action-btn approve" title="Start Consultation" ' +
                      'onclick="openConsultation(\'' + a.id + '\')">🩺</button>'
                    : '')) +

            (a.status === 'Waiting' || a.status === 'Confirmed'
                ? '<button class="action-btn edit" title="Mark In Progress" ' +
                  'onclick="setStatus(\'' + a.id + '\', \'In Progress\')">▶</button>'
                : '') +

            (a.status === 'In Progress'
                ? '<button class="action-btn approve" title="Mark Completed" ' +
                  'onclick="setStatus(\'' + a.id + '\', \'Completed\')">✓</button>'
                : '') +

            '<button class="action-btn delete" title="Cancel" ' +
            'onclick="cancelAppointment(\'' + a.id + '\')" ' +
            (a.status === 'Completed' ? 'style="display:none"' : '') +
            '>✕</button>' +
            '</div></td></tr>';

    }).join('');
}


function apptRenderPagination() {

    var totalPages = Math.ceil(apptFiltered.length / perPage);
    var paginationEl = document.getElementById('pagination');
    if (!paginationEl) return;

    if (totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }

    var html = '<button class="page-btn ' +
        (currentPage === 1 ? 'disabled' : '') +
        '" onclick="goToPage(' + (currentPage - 1) + ')">‹</button>';

    for (var i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages ||
            Math.abs(i - currentPage) <= 1) {
            html += '<button class="page-btn ' +
                (i === currentPage ? 'active' : '') +
                '" onclick="goToPage(' + i + ')">' + i + '</button>';
        } else if (Math.abs(i - currentPage) === 2) {
            html += '<span class="pagination-ellipsis">…</span>';
        }
    }

    html += '<button class="page-btn ' +
        (currentPage === totalPages ? 'disabled' : '') +
        '" onclick="goToPage(' + (currentPage + 1) + ')">›</button>';

    paginationEl.innerHTML = html;
}


function goToPage(page) {

    var totalPages = Math.ceil(apptFiltered.length / perPage);

    if (page < 1 || page > totalPages) return;

    currentPage = page;
    apptRenderTable();
    apptRenderPagination();
    apptUpdateTableCount();
}


function changePerPage(val) {

    perPage     = parseInt(val);
    currentPage = 1;

    apptRenderTable();
    apptRenderPagination();
    apptUpdateTableCount();
}


function apptUpdateTableCount() {

    var start = (currentPage - 1) * perPage;
    var end   = Math.min(start + perPage, apptFiltered.length);

    var info = document.getElementById('paginationInfo');
    if (info) {
        info.innerHTML = 'Showing <strong>' +
            (apptFiltered.length > 0 ? start + 1 : 0) + '–' +
            end + '</strong> of <strong>' +
            apptFiltered.length + '</strong>';
    }

    var cnt = document.getElementById('tableCount');
    if (cnt) {
        cnt.textContent = apptFiltered.length + ' record' +
            (apptFiltered.length !== 1 ? 's' : '');
    }
}


function apptUpdateStats() {

    var total      = allAppointments.length;
    var waiting    = allAppointments.filter(function (a) {
        return a.status === 'Waiting';
    }).length;
    var inProgress = allAppointments.filter(function (a) {
        return a.status === 'In Progress';
    }).length;
    var completed  = allAppointments.filter(function (a) {
        return a.status === 'Completed';
    }).length;

    animateCount('statTotal',      total);
    animateCount('statWaiting',    waiting);
    animateCount('statInProgress', inProgress);
    animateCount('statCompleted',  completed);

    var badge = document.getElementById('sidebarWaitBadge');
    if (badge) badge.textContent = waiting + inProgress;
}


function apptRenderTokenQueue() {

    var inProgress = allAppointments.find(function (a) {
        return a.status === 'In Progress';
    });

    var waiting = allAppointments
        .filter(function (a) {
            return a.status === 'Waiting' ||
                   a.status === 'Confirmed';
        })
        .sort(function (a, b) {
            return a.token - b.token;
        });

    // Current token
    if (inProgress) {
        currentTokenId = inProgress.id;

        var numEl = document.getElementById('currentTokenNum');
        if (numEl) numEl.textContent = String(inProgress.token).padStart(2, '0');

        var nameEl = document.getElementById('currentTokenName');
        if (nameEl) nameEl.textContent = inProgress.patientName;

        var infoEl = document.getElementById('currentTokenInfo');
        if (infoEl) {
            infoEl.textContent =
                inProgress.time + ' · ' + inProgress.type;
        }
    } else {
        currentTokenId = null;

        var numEl2 = document.getElementById('currentTokenNum');
        if (numEl2) numEl2.textContent = '—';

        var nameEl2 = document.getElementById('currentTokenName');
        if (nameEl2) nameEl2.textContent = 'No Active Patient';

        var infoEl2 = document.getElementById('currentTokenInfo');
        if (infoEl2) infoEl2.textContent = 'Click "Call Next" to begin';
    }

    // Queue list
    var queueEl  = document.getElementById('queueList');
    var queueSub = document.getElementById('queueSubtitle');

    if (queueSub) {
        queueSub.textContent = waiting.length + ' patient' +
            (waiting.length !== 1 ? 's' : '') + ' waiting';
    }

    if (!queueEl) return;

    if (waiting.length === 0) {
        queueEl.innerHTML =
            '<div style="padding:24px;text-align:center;' +
            'color:var(--text-muted);font-size:var(--text-sm);">' +
            'No patients waiting 🎉</div>';
        return;
    }

    queueEl.innerHTML = waiting.slice(0, 6).map(function (a, idx) {
        return '<div class="token-queue-item" style="' +
            (idx === 0 ? 'background:var(--accent-light);' : '') + '">' +
            '<div class="token-num-badge" style="' +
            (idx === 0 ? 'background:var(--accent);color:#fff;' : '') + '">' +
            String(a.token).padStart(2, '0') + '</div>' +
            '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:var(--text-sm);font-weight:600;' +
            'color:var(--text-primary);white-space:nowrap;overflow:hidden;' +
            'text-overflow:ellipsis;">' + a.patientName + '</div>' +
            '<div style="font-size:var(--text-xs);color:var(--text-muted);">' +
            a.time + ' · ' + a.type + '</div></div>' +
            '<span class="badge ' + statusBadgeClass(a.status) +
            '" style="font-size:10px;">' + a.status + '</span></div>';
    }).join('');

    if (waiting.length > 6) {
        var footer = document.getElementById('queueFooterNote');
        if (footer) {
            footer.textContent = '+' + (waiting.length - 6) + ' more in queue';
        }
    }
}


function callNextToken() {

    if (currentTokenId) {
        setStatus(currentTokenId, 'Completed', false);
    }

    var next = allAppointments
        .filter(function (a) {
            return a.status === 'Waiting' ||
                   a.status === 'Confirmed';
        })
        .sort(function (a, b) {
            return a.token - b.token;
        })[0];

    if (!next) {
        showToast('No more patients in queue 🎉', 'success');
        return;
    }

    setStatus(next.id, 'In Progress', false);
    showToast(
        'Token ' + String(next.token).padStart(2, '0') +
        ' — ' + next.patientName + ' called',
        'info'
    );
}


function apptRenderTypeBreakdown() {

    var types   = ['General', 'Follow-up', 'Emergency'];
    var total   = allAppointments.length || 1;
    var colours = {
        'General':   'var(--accent)',
        'Follow-up': 'var(--info)',
        'Emergency': 'var(--danger)'
    };

    var el = document.getElementById('typeBreakdown');
    if (!el) return;

    el.innerHTML = types.map(function (t) {

        var cnt = allAppointments.filter(function (a) {
            return a.type === t;
        }).length;

        var pct = Math.round((cnt / total) * 100);

        return '<div class="progress-bar-item">' +
            '<div class="progress-bar-label">' +
            '<span class="progress-bar-name">' + t + '</span>' +
            '<span class="progress-bar-value">' + cnt + '</span>' +
            '</div><div class="progress-track">' +
            '<div class="progress-fill" style="width:' + pct +
            '%;background:' + colours[t] + ';"></div>' +
            '</div></div>';
    }).join('');
}


// Drawer (Quick View)

function openDrawer(id) {

    var a = allAppointments.find(function (ap) {
        return ap.id === id;
    });
    if (!a) return;

    activeDrawerId = id;

    var setEl = function (elId, val) {
        var el = document.getElementById(elId);
        if (el) el.textContent = val;
    };

    setEl('drawerApptId',    a.id);
    setEl('drawerName',      a.patientName);
    setEl('drawerPatientId', a.patientId);
    setEl('drawerToken',     '#' + String(a.token).padStart(2, '0'));
    setEl('drawerTime',      a.time);
    setEl('drawerType',      typeIcon(a.type) + ' ' + a.type);
    setEl('drawerBooked',    a.bookedOn);
    setEl('drawerAgeGender', a.age + ' yrs · ' + a.gender);
    setEl('drawerBlood',     a.blood);
    setEl('drawerPhone',     a.phone);
    setEl('drawerAllergies', a.allergies || 'None known');
    setEl('drawerComplaint', a.complaint);

    var drawerAvatar = document.getElementById('drawerAvatar');
    if (drawerAvatar) {
        drawerAvatar.textContent       = getInitials(a.patientName);
        drawerAvatar.style.background  = avatarColor(a.patientId);
    }

    var drawerStatus = document.getElementById('drawerStatus');
    if (drawerStatus) {
        drawerStatus.innerHTML = '<span class="badge ' +
            statusBadgeClass(a.status) + '">' + a.status + '</span>';
    }

    var drawerStatusBadge = document.getElementById('drawerStatusBadge');
    if (drawerStatusBadge) {
        drawerStatusBadge.innerHTML = '<span class="badge ' +
            statusBadgeClass(a.status) + '">' + a.status + '</span>';
    }

    var completeBtn = document.getElementById('drawerCompleteBtn');
    if (completeBtn) {
        completeBtn.style.display =
            (a.status === 'Completed' || a.status === 'Cancelled')
                ? 'none' : '';
    }

    var consultBtn = document.getElementById('drawerConsultBtn');
    if (consultBtn) {
        if (isAppointmentConsulted(a) || a.status === 'Completed' || isPatientConsultedToday(a.patientId, a.id)) {
            consultBtn.textContent = '✓ Consulted Today';
            consultBtn.className = 'btn btn-secondary btn-sm';
            consultBtn.disabled = true;
            consultBtn.style.opacity = '0.65';
            consultBtn.style.cursor = 'not-allowed';
            consultBtn.style.pointerEvents = 'none';
            consultBtn.onclick = null;
        } else {
            consultBtn.textContent = '🩺 Start Consultation';
            consultBtn.className = 'btn btn-primary btn-sm';
            consultBtn.disabled = false;
            consultBtn.style.opacity = '1';
            consultBtn.style.cursor = 'pointer';
            consultBtn.style.pointerEvents = 'auto';
            consultBtn.onclick = startConsultation;
        }
    }

    document.getElementById('patientDrawer').classList.add('open');
    document.getElementById('drawerOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}


function closeDrawer() {

    var drawer  = document.getElementById('patientDrawer');
    var overlay = document.getElementById('drawerOverlay');

    if (drawer)  drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');

    document.body.style.overflow = '';
    activeDrawerId = null;
}


function markCompleted() {

    if (!activeDrawerId) return;
    setStatus(activeDrawerId, 'Completed');
    closeDrawer();
}


function startConsultation() {

    if (!activeDrawerId) return;
    var a = allAppointments.find(function (ap) {
        return ap.id === activeDrawerId;
    });
    if (a && (isAppointmentConsulted(a) || a.status === 'Completed' || isPatientConsultedToday(a.patientId, a.id))) {
        showToast('This appointment has already been completed today.', 'warning');
        return;
    }
    openConsultation(activeDrawerId);
}


// Status changes

function setStatus(id, newStatus, notify) {

    if (notify === undefined) notify = true;

    var stored = JSON.parse(
        localStorage.getItem('cms_appointments') || '[]'
    );

    var idx = stored.findIndex(function (a) {
        return a.id === id;
    });

    if (idx === -1) return;

    stored[idx].status = newStatus;
    localStorage.setItem(
        'cms_appointments',
        JSON.stringify(stored)
    );

    loadAppointments();

    if (notify) {
        showToast(
            'Appointment marked as "' + newStatus + '"',
            newStatus === 'Completed' ? 'success' : 'info'
        );
    }
}


function cancelAppointment(id) {

    var a = allAppointments.find(function (ap) {
        return ap.id === id;
    });
    if (!a) return;

    if (!confirm('Cancel appointment for ' + a.patientName + '?')) {
        return;
    }

    setStatus(id, 'Cancelled');
    showToast(
        'Appointment for ' + a.patientName + ' cancelled',
        'danger'
    );
}


function openConsultation(id) {

    var a = allAppointments.find(function (ap) {
        return ap.id === id;
    });
    if (!a) return;

    if (isAppointmentConsulted(a) || a.status === 'Completed' || isPatientConsultedToday(a.patientId, a.id)) {
        showToast('This patient has already completed today\'s consultation.', 'warning');
        return;
    }

    if (a.status !== 'In Progress' &&
        a.status !== 'Completed') {
        setStatus(id, 'In Progress', false);
    }

    localStorage.setItem('cms_active_appointment', id);
    window.location.href = 'consultation.html?id=' + id;
}


function exportAppointments() {

    var rows = [
        ['Token', 'Patient', 'Patient ID', 'Time',
         'Type', 'Status', 'Wait (min)', 'Complaint']
    ];

    allAppointments.forEach(function (a) {
        rows.push([
            a.token, a.patientName, a.patientId,
            a.time, a.type, a.status, a.waitMin,
            '"' + a.complaint + '"'
        ]);
    });

    var csv  = rows.map(function (r) {
        return r.join(',');
    }).join('\n');

    var blob = new Blob([csv], { type: 'text/csv' });
    var url  = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href     = url;
    link.download = 'appointments_' + TODAY + '.csv';
    link.click();
    URL.revokeObjectURL(url);
    showToast('Appointments exported as CSV', 'success');
}


function refreshAppointments() {

    loadAppointments();
    showToast('Appointments refreshed', 'info');
}


function toggleUserMenu() {
    // Placeholder for user dropdown menu
}


// ============================================================
// 12. CONSULTATION PAGE
// ============================================================

var activeAppt = null;

function initConsultation() {

    var modalDocName = document.getElementById('modalDocName');
    if (modalDocName) {
        modalDocName.textContent =
            loggedInUser.name || loggedInUser.username || 'Doctor';
    }

    consultLoadData();
    renderConsultationLabTests();
    renderQuickAddButtons();
    setupInitialMedications();
}


function consultLoadData() {

    allAppointments = JSON.parse(
        localStorage.getItem('cms_appointments') || '[]'
    );

    updateSidebarBadge();

    var urlParams = new URLSearchParams(window.location.search);
    var requestedApptId = urlParams.get('appointmentId') || urlParams.get('id');
    var requestedPatientId = urlParams.get('patientId');
    var targetId = requestedApptId || localStorage.getItem('cms_active_appointment');

    // 1. Direct URL check for specified appointment
    if (requestedApptId) {
        var requestedAppt = allAppointments.find(function (a) {
            return a.id === requestedApptId;
        });

        if (requestedAppt && (isAppointmentConsulted(requestedAppt) || isPatientConsultedToday(requestedAppt.patientId, requestedAppt.id))) {
            localStorage.removeItem('cms_active_appointment');
            sessionStorage.setItem('cms_toast', JSON.stringify({
                msg: 'This appointment has already been completed today.',
                type: 'warning'
            }));
            window.location.replace('appointments.html');
            return;
        }
    }

    // 2. Direct URL check for specified patient ID
    if (requestedPatientId || (requestedApptId && requestedApptId.startsWith('PAT'))) {
        var checkPatId = requestedPatientId || requestedApptId;
        if (isPatientConsultedToday(checkPatId)) {
            localStorage.removeItem('cms_active_appointment');
            sessionStorage.setItem('cms_toast', JSON.stringify({
                msg: 'This patient has already completed today\'s consultation.',
                type: 'warning'
            }));
            window.location.replace('appointments.html');
            return;
        }
    }

    var todayAppts = allAppointments.filter(function (a) {
        return a.date === TODAY;
    });

    if (targetId) {
        var cand = todayAppts.find(function (a) {
            return a.id === targetId;
        });
        if (cand && !isAppointmentConsulted(cand)) {
            activeAppt = cand;
        }
    }

    if (!activeAppt) {
        activeAppt = todayAppts.find(function (a) {
            return a.status === 'In Progress' && !isAppointmentConsulted(a);
        }) || todayAppts.find(function (a) {
            return (a.status === 'Waiting' || a.status === 'Confirmed') && !isAppointmentConsulted(a);
        });
    }

    if (!activeAppt) {
        if (todayAppts.length > 0) {
            localStorage.removeItem('cms_active_appointment');
            sessionStorage.setItem('cms_toast', JSON.stringify({
                msg: 'All scheduled patients for today have already been consulted.',
                type: 'info'
            }));
            window.location.replace('appointments.html');
            return;
        }
    }

    // Populate dropdown
    var sel = document.getElementById('patientQueueSelect');
    if (sel) {
        sel.innerHTML = todayAppts.length === 0
            ? '<option value="">No patients scheduled today</option>'
            : todayAppts.map(function (a) {
                var consulted = isAppointmentConsulted(a);
                return '<option value="' + a.id + '" ' +
                    (activeAppt && activeAppt.id === a.id ? 'selected' : '') +
                    (consulted ? ' disabled style="color:#999;"' : '') + '>' +
                    'Token #' + a.token + ' — ' +
                    a.patientName + (consulted ? ' (✓ Consulted)' : ' (' + a.status + ')') +
                    '</option>';
              }).join('');
    }

    if (activeAppt) {
        localStorage.setItem('cms_active_appointment', activeAppt.id);
        renderPatientHero(activeAppt);
    }
}


function onSelectPatientChange(id) {

    if (!id) return;
    var target = allAppointments.find(function (a) { return a.id === id; });
    if (target && isAppointmentConsulted(target)) {
        showToast('This appointment is already completed.', 'warning');
        return;
    }
    localStorage.setItem('cms_active_appointment', id);
    window.location.href = 'consultation.html?id=' + id;
}


function callNextPatient() {

    var next = allAppointments.find(function (a) {
        return a.date === TODAY && a.status === 'Waiting' && !isAppointmentConsulted(a);
    });

    if (!next) {
        showToast(
            'No more waiting patients for today! 🎉',
            'info'
        );
        return;
    }

    next.status = 'In Progress';
    localStorage.setItem(
        'cms_appointments',
        JSON.stringify(allAppointments)
    );
    localStorage.setItem('cms_active_appointment', next.id);
    window.location.href = 'consultation.html?id=' + next.id;
}


function renderPatientHero(appt) {

    var setEl = function (id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setEl('pToken',     String(appt.token).padStart(2, '0'));
    setEl('pName',      appt.patientName);
    setEl('pId',        appt.patientId || 'PAT-00' + appt.token);
    setEl('pAgeGender', (appt.age || 30) + ' yrs, ' + (appt.gender || 'Unknown'));
    setEl('pBlood',     appt.blood || 'B+');
    setEl('pPhone',     appt.phone || '9876543210');
    setEl('pAllergies', appt.allergies || 'None');
    setEl('pComplaint', appt.complaint || 'General medical consultation');

    var statusEl = document.getElementById('pStatusBadge');
    if (statusEl) {
        statusEl.textContent = appt.status;
        statusEl.className   = 'badge ' +
            (appt.status === 'In Progress' ? 'badge-info' :
             appt.status === 'Completed'   ? 'badge-success' :
             'badge-warning');
    }

    var profileLink = document.getElementById('btnFullProfile');
    if (profileLink) {
        profileLink.href = 'patient-details.html?id=' +
            (appt.patientId || appt.id);
    }

    var diagInput = document.getElementById('diagPrimary');
    if (diagInput && appt.complaint) {
        diagInput.value = 'Clinical evaluation for ' + appt.complaint;
    }
}


// Medication Builder & Master Integration

function renderQuickAddButtons() {
    var container = document.getElementById('quickAddContainer');
    if (!container) return;

    var activeMeds = getActiveMedicines();
    if (activeMeds.length === 0) {
        container.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">No active medicines in master catalog.</span>';
        return;
    }

    container.innerHTML = '<span style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-right:4px;display:inline-flex;align-items:center;">Quick Add:</span>' +
        activeMeds.slice(0, 6).map(function (m) {
            return '<button type="button" class="btn btn-outline btn-sm" style="font-size:11px;padding:3px 8px;border-radius:12px;" onclick="quickAddRx(\'' +
                m.id + '\', \'1 ' + (m.category || 'Tablet') + '\', \'1-0-1\', \'5 Days\', 10, \'After food\')">+ ' +
                m.name + '</button>';
        }).join('');
}


function renderConsultationLabTests() {
    var container = document.getElementById('consultLabTestsGrid');
    if (!container) return;

    var activeTests = getActiveMasterLabTests();
    if (activeTests.length === 0) {
        container.innerHTML = '<div style="font-size:12px;color:var(--text-muted);grid-column:1/-1;">No active laboratory tests are available. Please contact Admin.</div>';
        return;
    }

    container.innerHTML = activeTests.map(function (t) {
        var testName = t.name || t.testName;
        var cat = t.category || 'General';
        var price = Number(t.price || 0);
        var normalRange = t.normalRange || '';
        var unit = t.unit || '';
        var metaDetails = [cat];
        if (price > 0) metaDetails.push('₹' + price);
        if (normalRange) metaDetails.push('Ref: ' + normalRange + (unit ? ' ' + unit : ''));

        return '<label class="lab-check-label">' +
            '<input type="checkbox" name="labTest" value="' + t.id + '" data-name="' + testName + '" data-category="' + cat + '" data-price="' + price + '" data-normalrange="' + normalRange + '" data-unit="' + unit + '" />' +
            '<span>' + testName +
            ' <small style="color:var(--text-muted);font-weight:400;display:block;font-size:11px;">' + metaDetails.join(' · ') + '</small></span>' +
            '</label>';
    }).join('');
}


function setupInitialMedications() {

    var tbody = document.getElementById('rxTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    var activeMeds = getActiveMedicines();
    if (activeMeds.length > 0) {
        var first = activeMeds[0];
        addMedicationRow(first.id, '1 ' + (first.category || 'Tablet'), '1-0-1', '3 Days', 6, 'After food');
        if (activeMeds.length > 1) {
            var second = activeMeds[1];
            addMedicationRow(second.id, '1 ' + (second.category || 'Tablet'), '1-0-0', '5 Days', 5, 'Before food');
        }
    } else {
        addMedicationRow('', '1 Tablet', '1-0-1', '3 Days', 6, 'After food');
    }
}


function addMedicationRow(medicineId, dosage, freq, dur, qty, inst) {

    medicineId = medicineId || '';
    dosage     = dosage     || '';
    freq       = freq       || '1-0-1';
    dur        = dur        || '5 Days';
    qty        = (qty !== undefined && qty !== null && qty !== '') ? qty : 10;
    inst       = inst       || 'After food';

    var tbody = document.getElementById('rxTableBody');
    if (!tbody) return;

    var activeMeds = getActiveMedicines();
    var optionsHtml = '<option value="">-- Select Medicine --</option>';

    var foundSelected = false;
    var targetMedId = medicineId ? String(medicineId).trim() : '';
    activeMeds.forEach(function (m) {
        var isSel = (targetMedId && m.id && String(m.id).trim() === targetMedId);
        if (isSel) foundSelected = true;
        optionsHtml += '<option value="' + m.id + '"' + (isSel ? ' selected' : '') + '>' +
            m.name + ' (' + (m.category || 'Tab') + ')' +
            '</option>';
    });

    if (medicineId && !foundSelected) {
        var existingMed = findMedicineById(medicineId);
        var label = existingMed ? (existingMed.name + ' [Inactive]') : (medicineId + ' [Legacy/Inactive]');
        optionsHtml += '<option value="' + medicineId + '" selected disabled>' + label + '</option>';
    }

    var tr = document.createElement('tr');

    tr.innerHTML =
        '<td><select class="rx-input rx-med-select" onchange="onRxMedSelectChange(this)">' +
        optionsHtml +
        '</select></td>' +
        '<td><input type="text" class="rx-input rx-dose" value="' + dosage + '" placeholder="e.g. 1 Tab / 5ml" /></td>' +
        '<td><select class="rx-input rx-freq">' +
        '<option value="1-0-1"' + (freq === '1-0-1' ? ' selected' : '') + '>1-0-1 (Twice daily)</option>' +
        '<option value="1-0-0"' + (freq === '1-0-0' ? ' selected' : '') + '>1-0-0 (Morning)</option>' +
        '<option value="0-0-1"' + (freq === '0-0-1' ? ' selected' : '') + '>0-0-1 (Night)</option>' +
        '<option value="1-1-1"' + (freq === '1-1-1' ? ' selected' : '') + '>1-1-1 (Thrice daily)</option>' +
        '<option value="SOS / As needed"' + (freq.indexOf('SOS') !== -1 ? ' selected' : '') + '>SOS (As needed)</option>' +
        '</select></td>' +
        '<td><input type="text" class="rx-input rx-dur" value="' + dur + '" placeholder="e.g. 5 Days" /></td>' +
        '<td><input type="number" min="1" step="1" class="rx-input rx-qty" value="' + qty + '" placeholder="Qty" style="min-width:60px;" /></td>' +
        '<td><input type="text" class="rx-input rx-inst" value="' + inst + '" placeholder="e.g. After food" /></td>' +
        '<td><button type="button" class="rx-delete-btn" onclick="this.closest(\'tr\').remove()" title="Remove">✕</button></td>';

    tbody.appendChild(tr);
}


function onRxMedSelectChange(selEl) {

    if (!selEl || !selEl.value) return;
    var med = findMedicineById(selEl.value);
    if (!med) return;

    var tr = selEl.closest('tr');
    if (!tr) return;

    var doseInput = tr.querySelector('.rx-dose');
    if (doseInput && !doseInput.value.trim()) {
        doseInput.value = '1 ' + (med.category || 'Tablet');
    }
}


function quickAddRx(medicineId, dosage, freq, dur, qty, inst) {

    var med = findMedicineById(medicineId);
    if (!med) {
        showToast('Selected medicine is not available.', 'warning');
        return;
    }
    if ((med.status || 'Active').toLowerCase() !== 'active') {
        showToast('Medicine "' + med.name + '" is inactive.', 'warning');
        return;
    }

    addMedicationRow(medicineId, dosage, freq, dur, qty, inst);
    showToast('Added ' + med.name + ' to prescription', 'info');
}


function validateAndGetPrescriptionData() {

    var rows = document.querySelectorAll('#rxTableBody tr');
    var medicines = [];
    var seenMedIds = {};

    for (var i = 0; i < rows.length; i++) {
        var tr = rows[i];
        var selectEl = tr.querySelector('.rx-med-select');
        var doseEl   = tr.querySelector('.rx-dose');
        var freqEl   = tr.querySelector('.rx-freq');
        var durEl    = tr.querySelector('.rx-dur');
        var qtyEl    = tr.querySelector('.rx-qty');
        var instEl   = tr.querySelector('.rx-inst');

        var medId  = selectEl ? selectEl.value.trim() : '';
        var dose   = doseEl ? doseEl.value.trim() : '';
        var freq   = freqEl ? freqEl.value.trim() : '';
        var dur    = durEl ? durEl.value.trim() : '';
        var qtyRaw = qtyEl ? qtyEl.value.trim() : '';
        var inst   = instEl ? instEl.value.trim() : '';

        // If completely empty row and not the only row, skip
        if (!medId && !dose && !dur && !qtyRaw) {
            continue;
        }

        if (!medId) {
            if (selectEl) selectEl.focus();
            return { valid: false, message: 'Row #' + (i + 1) + ': Please select a medicine from Medicine Master.' };
        }

        var medMaster = findMedicineById(medId);
        if (!medMaster) {
            if (selectEl) selectEl.focus();
            return { valid: false, message: 'Row #' + (i + 1) + ': Selected medicine does not exist in master list.' };
        }

        if ((medMaster.status || 'Active').toLowerCase() !== 'active') {
            if (selectEl) selectEl.focus();
            return { valid: false, message: 'Row #' + (i + 1) + ': Medicine "' + medMaster.name + '" is Inactive and cannot be prescribed.' };
        }

        if (!dose) {
            if (doseEl) doseEl.focus();
            return { valid: false, message: 'Row #' + (i + 1) + ' (' + medMaster.name + '): Dosage cannot be empty.' };
        }

        if (!freq) {
            if (freqEl) freqEl.focus();
            return { valid: false, message: 'Row #' + (i + 1) + ' (' + medMaster.name + '): Frequency cannot be empty.' };
        }

        if (!dur) {
            if (durEl) durEl.focus();
            return { valid: false, message: 'Row #' + (i + 1) + ' (' + medMaster.name + '): Duration cannot be empty.' };
        }

        var qtyNum = parseInt(qtyRaw, 10);
        if (isNaN(qtyNum) || qtyNum <= 0) {
            if (qtyEl) qtyEl.focus();
            return { valid: false, message: 'Row #' + (i + 1) + ' (' + medMaster.name + '): Quantity must be a positive number.' };
        }

        var normalizedMedId = String(medMaster.id || medId).trim();
        if (seenMedIds[normalizedMedId]) {
            if (selectEl) selectEl.focus();
            return { valid: false, message: 'Duplicate medicine: "' + medMaster.name + '" is added multiple times. Please adjust quantity instead of adding duplicate rows.' };
        }
        seenMedIds[normalizedMedId] = true;

        medicines.push({
            medicineId:   normalizedMedId,
            medicine:     medMaster.name,
            dosage:       dose,
            frequency:    freq,
            duration:     dur,
            quantity:     qtyNum,
            instructions: inst || 'After food'
        });
    }

    return { valid: true, medicines: medicines };
}


function getPrescriptionData() {

    var res = validateAndGetPrescriptionData();
    return res.valid ? res.medicines : [];
}


// Complete Consultation

function completeConsultation() {

    if (!activeAppt) {
        showToast('No active patient to complete.', 'warning');
        return;
    }

    var primaryDiag = document.getElementById('diagPrimary').value.trim();
    if (!primaryDiag) {
        showToast(
            'Please enter a Primary Diagnosis before completing.',
            'warning'
        );
        document.getElementById('diagPrimary').focus();
        return;
    }

    var rxResult = validateAndGetPrescriptionData();
    if (!rxResult.valid) {
        showToast(rxResult.message, 'warning');
        return;
    }

    var medicines = rxResult.medicines;

    // Lab Tests
    var labCheckboxes = document.querySelectorAll(
        'input[name="labTest"]:checked'
    );
    var labOrdersToSave = Array.prototype.slice.call(labCheckboxes).map(function (cb) {
        var master = findLabTestById(cb.value);
        var nr = master ? String(master.normalRange || '').trim() : String(cb.getAttribute('data-normalrange') || cb.dataset.normalrange || '').trim();
        var u = master ? String(master.unit || '').trim() : String(cb.getAttribute('data-unit') || cb.dataset.unit || '').trim();
        return {
            testId:      master ? master.id : cb.value,
            testName:    master ? (master.name || master.testName) : (cb.getAttribute('data-name') || cb.dataset.name || cb.value),
            category:    master ? (master.category || 'General') : (cb.getAttribute('data-category') || cb.dataset.category || 'General'),
            price:       master ? Number(master.price || 0) : Number(cb.getAttribute('data-price') || cb.dataset.price || 0),
            normalRange: nr,
            unit:        u
        };
    });

    // 1. Update appointment status
    var appts = JSON.parse(
        localStorage.getItem('cms_appointments') || '[]'
    );
    var idx = appts.findIndex(function (a) {
        return a.id === activeAppt.id;
    });
    if (idx !== -1) {
        appts[idx].status = 'Completed';
        localStorage.setItem(
            'cms_appointments',
            JSON.stringify(appts)
        );
    }

    // 2. Save consultation record
    var consults = JSON.parse(
        localStorage.getItem('cms_consultations') || '[]'
    );

    var consultRecord = {
        id:                  'CNS-' + Date.now(),
        appointmentId:       activeAppt.id,
        patientId:           activeAppt.patientId || 'PAT-001',
        patientName:         activeAppt.patientName,
        doctorId:            (loggedInUser && loggedInUser.id) || 'DOC001',
        doctorName:          loggedInUser.name || 'Dr. Arun Kumar',
        date:                TODAY,
        time:                new Date().toLocaleTimeString(
                                 [], { hour:'2-digit', minute:'2-digit' }
                             ),
        diagnosis:           primaryDiag,
        secondaryDiagnosis:  (document.getElementById('diagSecondary') || {}).value || '',
        notes:               (document.getElementById('diagNotes') || {}).value || '',
        vitals: {
            bp:     (document.getElementById('vitBP')     || {}).value || '',
            pulse:  (document.getElementById('vitPulse')  || {}).value || '',
            temp:   (document.getElementById('vitTemp')   || {}).value || '',
            spo2:   (document.getElementById('vitSpo2')   || {}).value || '',
            weight: (document.getElementById('vitWeight') || {}).value || ''
        },
        medicines:  medicines,
        labTests:   labOrdersToSave.map(function (l) { return l.testName; }),
        advice:     (document.getElementById('adviceNotes') || {}).value || '',
        followUp:   (document.getElementById('followUpSelect') || {}).value || ''
    };

    consults.unshift(consultRecord);
    localStorage.setItem(
        'cms_consultations',
        JSON.stringify(consults)
    );

    // 3. Save prescription
    if (medicines.length > 0) {
        var rxList = JSON.parse(
            localStorage.getItem('cms_prescriptions') || '[]'
        );
        rxList.unshift({
            id:             'RX-' + Date.now(),
            consultationId: consultRecord.id,
            patientId:      consultRecord.patientId,
            patientName:    consultRecord.patientName,
            doctorId:       consultRecord.doctorId,
            doctorName:     consultRecord.doctorName,
            date:           TODAY,
            medicines:      medicines,
            status:         'Pending Dispensation'
        });
        localStorage.setItem(
            'cms_prescriptions',
            JSON.stringify(rxList)
        );
    }

    // 4. Save lab requests (Doctor creates requests only, NOT bills or results)
    if (labOrdersToSave.length > 0) {
        var orderList = JSON.parse(
            localStorage.getItem('cms_lab_orders') || '[]'
        );
        var reqTime = getToday() + ' ' + new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });

        labOrdersToSave.forEach(function (t, i) {
            var orderId = 'LABREQ-' + (Date.now() + i);
            orderList.unshift({
                id:             orderId,
                orderNumber:    orderId,
                testId:         t.testId,
                testName:       t.testName,
                category:       t.category,
                price:          t.price,
                normalRange:    t.normalRange || '',
                unit:           t.unit || '',
                patientId:      consultRecord.patientId,
                patientName:    consultRecord.patientName,
                doctorId:       consultRecord.doctorId,
                doctorName:     consultRecord.doctorName,
                appointmentId:  activeAppt.id,
                consultationId: consultRecord.id,
                orderDate:      getToday(),
                requestedAt:    reqTime,
                status:         'Pending',
                priority:       'Normal',
                summary:        'Requested during clinical consultation'
            });
        });
        localStorage.setItem(
            'cms_lab_orders',
            JSON.stringify(orderList)
        );
    }

    localStorage.removeItem('cms_active_appointment');

    showToast(
        'Consultation for ' + activeAppt.patientName + ' saved!',
        'success'
    );

    setTimeout(function () {
        if (confirm(
            'Consultation completed for ' +
            activeAppt.patientName +
            '.\n\nWould you like to call the next patient in queue?'
        )) {
            callNextPatient();
        } else {
            window.location.href = 'appointments.html';
        }
    }, 600);
}


// Printable Rx Preview

function openPrintModal() {

    if (!activeAppt) {
        showToast('No patient selected.', 'warning');
        return;
    }

    var setEl = function (id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setEl('mPatientName', activeAppt.patientName);
    setEl('mAgeGender',   (activeAppt.age || 30) + 'Y / ' + (activeAppt.gender || 'M'));
    setEl('mPatientId',   activeAppt.patientId || 'PAT001');
    setEl('mBlood',       activeAppt.blood || 'B+');
    setEl('mDiagnosis',   (document.getElementById('diagPrimary') || {}).value || 'General Consultation');
    setEl('mAdvice',      (document.getElementById('adviceNotes') || {}).value || 'Take medications as prescribed with adequate rest.');
    setEl('mFollowUp',    (document.getElementById('followUpSelect') || {}).value || 'As needed');

    // Meds table
    var meds  = getPrescriptionData();
    var mBody = document.getElementById('mRxBody');
    if (mBody) {
        if (meds.length === 0) {
            mBody.innerHTML =
                '<tr><td colspan="7" style="padding:10px;text-align:center;color:#888;">' +
                'No medications prescribed.</td></tr>';
        } else {
            mBody.innerHTML = meds.map(function (m, i) {
                return '<tr style="border-bottom:1px solid #f0e9e4;">' +
                    '<td style="padding:6px 8px;">' + (i + 1) + '</td>' +
                    '<td style="padding:6px 8px;font-weight:600;">' + m.medicine + '</td>' +
                    '<td style="padding:6px 8px;">' + m.dosage + '</td>' +
                    '<td style="padding:6px 8px;">' + m.frequency + '</td>' +
                    '<td style="padding:6px 8px;">' + m.duration + '</td>' +
                    '<td style="padding:6px 8px;font-weight:600;">' + (m.quantity !== undefined ? m.quantity : '—') + '</td>' +
                    '<td style="padding:6px 8px;color:#555;">' + (m.instructions || '—') + '</td></tr>';
            }).join('');
        }
    }

    // Lab section
    var labChecks = document.querySelectorAll(
        'input[name="labTest"]:checked'
    );
    var labs = Array.from(labChecks).map(function (c) {
        return (c.dataset.name || c.value) + (c.dataset.category ? ' (' + c.dataset.category + ')' : '');
    });

    var labSec = document.getElementById('mLabSection');
    if (labSec) {
        if (labs.length > 0) {
            labSec.style.display = 'block';
            var labEl = document.getElementById('mLabTests');
            if (labEl) labEl.textContent = labs.join(', ');
        } else {
            labSec.style.display = 'none';
        }
    }

    var modal = document.getElementById('rxModal');
    if (modal) modal.classList.add('open');
}


function closeRxModal() {

    var modal = document.getElementById('rxModal');
    if (modal) modal.classList.remove('open');
}


// ============================================================
// 13. PATIENTS PAGE
// ============================================================

var allPatients      = [];
var filteredPatients = [];


function initPatients() {

    loadPatientsList();
}


function loadPatientsList() {

    var stored = JSON.parse(
        localStorage.getItem('cms_patients') || '[]'
    );

    if (!stored || stored.length === 0) {
        stored = DEFAULT_PATIENTS;
        localStorage.setItem(
            'cms_patients',
            JSON.stringify(stored)
        );
    }

    allPatients = stored;
    patientsApplyFilters();
    patientsUpdateStats();
    updateSidebarBadge();
}


function patientsUpdateStats() {

    var el;

    el = document.getElementById('statTotalPatients');
    if (el) el.textContent = allPatients.length;

    var chronicCount = allPatients.filter(function (p) {
        return p.chronic && p.chronic !== 'None';
    }).length;

    el = document.getElementById('statChronic');
    if (el) el.textContent = chronicCount;

    var allergyCount = allPatients.filter(function (p) {
        return p.allergies && p.allergies !== 'None';
    }).length;

    el = document.getElementById('statAllergies');
    if (el) el.textContent = allergyCount;

    var consults = JSON.parse(
        localStorage.getItem('cms_consultations') || '[]'
    );

    el = document.getElementById('statSeenByDoc');
    if (el) el.textContent = consults.length || 8;
}


function patientsApplyFilters() {

    var searchInput = document.getElementById('patientSearchInput');
    var genderInput = document.getElementById('genderFilter');
    var bloodInput  = document.getElementById('bloodFilter');

    var q      = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var gender = genderInput ? genderInput.value : '';
    var blood  = bloodInput  ? bloodInput.value  : '';

    filteredPatients = allPatients.filter(function (p) {

        var matchQ = !q ||
            p.name.toLowerCase().indexOf(q) !== -1 ||
            p.id.toLowerCase().indexOf(q) !== -1 ||
            (p.phone && p.phone.indexOf(q) !== -1);

        var matchG = !gender || p.gender === gender;
        var matchB = !blood  || p.blood  === blood;

        return matchQ && matchG && matchB;
    });

    patientsRenderTable();
}


function handleSearch_patients() {
    patientsApplyFilters();
}


function patientsRenderTable() {

    var tbody = document.getElementById('patientsTableBody');
    if (!tbody) return;

    var countLabel = document.getElementById('patientCountLabel');
    if (countLabel) {
        countLabel.textContent = 'Showing ' + filteredPatients.length +
            ' of ' + allPatients.length + ' patients';
    }

    if (filteredPatients.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="8" style="text-align:center;padding:32px;' +
            'color:var(--text-muted);">No patients found matching your search.</td></tr>';
        return;
    }

    tbody.innerHTML = filteredPatients.map(function (p) {

        var hasAllergy = p.allergies && p.allergies !== 'None';

        return '<tr>' +
            '<td style="font-weight:600;font-family:monospace;color:var(--accent);">' +
            p.id + '</td>' +
            '<td><div class="patient-avatar-cell">' +
            '<div class="avatar avatar-sm" style="background:#e8dfd8;color:#5c4033;' +
            'font-weight:700;width:32px;height:32px;border-radius:50%;display:flex;' +
            'align-items:center;justify-content:center;font-size:12px;">' +
            getInitials(p.name) + '</div><div>' +
            '<div style="font-weight:600;color:var(--text-primary);">' + p.name + '</div>' +
            '<div style="font-size:11px;color:var(--text-muted);">' +
            (p.chronic && p.chronic !== 'None' ? '🩺 ' + p.chronic : 'No chronic conditions') +
            '</div></div></div></td>' +
            '<td>' + p.age + ' yrs, ' + p.gender + '</td>' +
            '<td>' + (p.phone || '—') + '</td>' +
            '<td><span class="badge" style="background:#f0e9e4;color:#3d2a25;">' +
            (p.blood || '—') + '</span></td>' +
            '<td>' + (hasAllergy
                ? '<span class="allergy-chip">⚠️ ' + p.allergies + '</span>'
                : '<span class="safe-chip">None reported</span>') +
            '</td>' +
            '<td><span class="badge badge-success">Active</span></td>' +
            '<td style="text-align:right;">' +
            '<div style="display:inline-flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">' +
            '<a href="patient-details.html?id=' + p.id +
            '" class="btn btn-outline btn-sm" title="View Full Medical Record">Profile ↗</a>' +
            (isPatientConsultedToday(p.id)
                ? '<button class="btn btn-secondary btn-sm" disabled style="opacity:0.65;cursor:not-allowed;pointer-events:none;" title="Patient already consulted today">✓ Consulted Today</button>'
                : '<button class="btn btn-secondary btn-sm" ' +
                  'onclick="startConsultFor(\'' + p.id + '\', \'' + p.name +
                  '\')" title="Start Consultation">🩺 Consult</button>') +
            '</div></td></tr>';
    }).join('');
}


function startConsultFor(patientId, patientName) {

    if (isPatientConsultedToday(patientId)) {
        showToast('This patient has already completed today\'s consultation.', 'warning');
        return;
    }

    var appts = JSON.parse(
        localStorage.getItem('cms_appointments') || '[]'
    );
    var today = getToday();

    var appt = appts.find(function (a) {
        return a.patientId === patientId && a.date === today && a.status !== 'Completed';
    });

    if (!appt) {
        var token = appts.filter(function (a) {
            return a.date === today;
        }).length + 1;

        appt = {
            id:          'APT-' + Date.now(),
            token:       token,
            patientId:   patientId,
            patientName: patientName,
            age:         30,
            gender:      'Male',
            blood:       'O+',
            time:        new Date().toLocaleTimeString(
                             [], { hour:'2-digit', minute:'2-digit' }
                         ),
            type:        'Walk-in',
            status:      'In Progress',
            complaint:   'Routine consultation',
            date:        today
        };
        appts.push(appt);
    } else {
        appt.status = 'In Progress';
    }

    localStorage.setItem(
        'cms_appointments',
        JSON.stringify(appts)
    );
    localStorage.setItem('cms_active_appointment', appt.id);
    window.location.href = 'consultation.html?id=' + appt.id;
}


function exportPatientsCSV() {

    var rows = [[
        'Patient ID', 'Name', 'Age', 'Gender',
        'Phone', 'Blood Group', 'Allergies', 'Chronic Conditions'
    ]];

    allPatients.forEach(function (p) {
        rows.push([
            p.id, p.name, p.age, p.gender,
            p.phone, p.blood,
            '"' + p.allergies + '"',
            '"' + (p.chronic || '') + '"'
        ]);
    });

    var csv = rows.map(function (r) {
        return r.join(',');
    }).join('\n');

    var blob = new Blob([csv], { type: 'text/csv' });
    var a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'medicare_patients_' + getToday() + '.csv';
    a.click();
}


// ============================================================
// 14. PATIENT DETAILS PAGE
// ============================================================

var currentPatient         = null;
var patientConsultations   = [];
var patientPrescriptions   = [];
var patientLabs            = [];


function initPatientDetails() {

    loadPatientData();
}


function loadPatientData() {

    var patients  = JSON.parse(
        localStorage.getItem('cms_patients') || '[]'
    );
    var urlParams = new URLSearchParams(window.location.search);
    var requestedId = urlParams.get('id') || 'PAT001';

    // Patient picker
    var picker = document.getElementById('quickPatientPicker');
    if (picker) {
        picker.innerHTML = patients.map(function (p) {
            return '<option value="' + p.id + '" ' +
                (p.id === requestedId ? 'selected' : '') + '>' +
                p.name + ' (' + p.id + ')</option>';
        }).join('');
    }

    currentPatient = patients.find(function (p) {
        return p.id === requestedId;
    }) || patients[0] || {
        id: 'PAT001', name: 'Rahul Menon', age: 24,
        gender: 'Male', blood: 'O+', phone: '9876543210',
        allergies: 'None', chronic: 'None'
    };

    detailsRenderHeader(currentPatient);
    detailsLoadClinical(currentPatient);
    updateSidebarBadge();
}


function switchPatient(id) {
    window.location.href = 'patient-details.html?id=' + id;
}


function detailsRenderHeader(p) {

    var initials = getInitials(p.name);

    var setEl = function (id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setEl('pHeroAvatar', initials);
    setEl('pHeroName',   p.name);
    setEl('pHeroId',     p.id);
    setEl('pHeroSub',    (p.age || 28) + ' yrs · ' +
        (p.gender || 'Unknown') + ' · Blood: ' +
        (p.blood || '—') + ' · Phone: ' + (p.phone || '—'));

    var allergyEl = document.getElementById('pHeroAllergies');
    if (allergyEl) {
        if (p.allergies && p.allergies !== 'None') {
            allergyEl.textContent = '⚠️ Allergies: ' + p.allergies;
            allergyEl.className   = 'badge badge-danger';
        } else {
            allergyEl.textContent = '✓ No known drug allergies';
            allergyEl.className   = 'badge badge-success';
        }
    }

    setEl('pHeroChronic',
        p.chronic && p.chronic !== 'None'
            ? '🩺 Chronic: ' + p.chronic
            : '🩺 General Medicine'
    );

    var consultBtn = document.getElementById('btnLaunchConsult');
    if (consultBtn) {
        if (isPatientConsultedToday(p.id)) {
            consultBtn.textContent = '✓ Consulted Today';
            consultBtn.className = 'btn btn-secondary btn-sm';
            consultBtn.disabled = true;
            consultBtn.style.opacity = '0.65';
            consultBtn.style.cursor = 'not-allowed';
            consultBtn.style.pointerEvents = 'none';
            consultBtn.onclick = null;
        } else {
            consultBtn.textContent = '🩺 New Consultation';
            consultBtn.className = 'btn btn-primary btn-sm';
            consultBtn.disabled = false;
            consultBtn.style.opacity = '1';
            consultBtn.style.cursor = 'pointer';
            consultBtn.style.pointerEvents = 'auto';
            consultBtn.onclick = startConsultationForPatient;
        }
    }
}


function detailsLoadClinical(p) {

    // 1. Consultations
    var allConsults = JSON.parse(
        localStorage.getItem('cms_consultations') || '[]'
    );

    patientConsultations = allConsults.filter(function (c) {
        return c.patientId === p.id || c.patientName === p.name;
    });

    if (patientConsultations.length === 0) {
        patientConsultations = [{
            id: 'CNS-Sample', date: '2026-02-14', time: '10:30 AM',
            doctorName: 'Dr. Arun Kumar',
            diagnosis: 'Acute Upper Respiratory Tract Infection',
            secondaryDiagnosis: 'None',
            notes: 'Patient presented with 3-day history of dry cough and low-grade pyrexia. Throat examination revealed mild erythematous pharynx. Chest clear to auscultation.',
            vitals: { bp:'118/76', pulse:'76', temp:'99.1', spo2:'98', weight:'67' },
            medicines: [
                { medicineId: 'MED002', medicine:'Amoxicillin 500mg', dosage:'1 Cap', frequency:'1-0-1', duration:'5 Days', quantity: 10, instructions:'After food' },
                { medicineId: 'MED001', medicine:'Paracetamol 500mg', dosage:'1 Tab', frequency:'SOS / As needed', duration:'3 Days', quantity: 6, instructions:'For fever/body ache' }
            ],
            labTests: ['Complete Blood Count (CBC)'],
            advice: 'Adequate hydration, warm saline gargles twice daily. Review if fever persists over 48 hours.',
            followUp: '1 Week'
        }];
    }

    var countConsults = document.getElementById('countConsults');
    if (countConsults) countConsults.textContent = patientConsultations.length;
    detailsRenderConsultations(patientConsultations);

    // 2. Prescriptions
    var allRx = JSON.parse(
        localStorage.getItem('cms_prescriptions') || '[]'
    );

    patientPrescriptions = allRx.filter(function (r) {
        return r.patientId === p.id || r.patientName === p.name;
    });

    if (patientPrescriptions.length === 0) {
        patientPrescriptions = [{
            id: 'RX-98210', date: '2026-02-14',
            doctorName: 'Dr. Arun Kumar', status: 'Dispensed',
            medicines: [
                { medicineId: 'MED002', medicine:'Amoxicillin 500mg', dosage:'1 Cap', frequency:'1-0-1', duration:'5 Days', quantity: 10, instructions: 'After food' },
                { medicineId: 'MED001', medicine:'Paracetamol 500mg', dosage:'1 Tab', frequency:'SOS', duration:'3 Days', quantity: 6, instructions: 'As needed' }
            ]
        }];
    }

    var countRx = document.getElementById('countPrescriptions');
    if (countRx) countRx.textContent = patientPrescriptions.length;
    detailsRenderPrescriptions(patientPrescriptions);

    // 3. Lab Tests & Completed Results
    var allLabOrders = getLabOrders();

    patientLabs = allLabOrders.filter(function (l) {
        return l.patientId === p.id || l.patientName === p.name;
    });

    var countLabs = document.getElementById('countLabs');
    if (countLabs) countLabs.textContent = patientLabs.length;
    detailsRenderLabs(patientLabs);
}


function detailsRenderConsultations(consults) {

    var container = document.getElementById('consultationsContainer');
    if (!container) return;

    container.innerHTML = consults.map(function (c) {

        var vitalsHtml = '';
        if (c.vitals) {
            vitalsHtml =
                '<div style="display:flex;gap:16px;flex-wrap:wrap;' +
                'background:var(--surface-secondary);padding:8px 14px;' +
                'border-radius:6px;font-size:12px;margin-bottom:12px;">' +
                '<span><b>BP:</b> ' + (c.vitals.bp || '—') + ' mmHg</span>' +
                '<span><b>Pulse:</b> ' + (c.vitals.pulse || '—') + ' bpm</span>' +
                '<span><b>Temp:</b> ' + (c.vitals.temp || '—') + ' °F</span>' +
                '<span><b>SpO2:</b> ' + (c.vitals.spo2 || '—') + '%</span>' +
                '<span><b>Weight:</b> ' + (c.vitals.weight || '—') + ' kg</span></div>';
        }

        var medsHtml = '';
        if (c.medicines && c.medicines.length > 0) {
            medsHtml =
                '<div style="font-size:13px;margin-bottom:8px;">' +
                '<b>Prescribed Medications:</b>' +
                '<ul style="margin:4px 0 8px 18px;padding:0;color:var(--text-primary);">' +
                c.medicines.map(function (m) {
                    return '<li><b>' + (m.medicine || m.name) + '</b> — ' +
                        (m.dosage || '') + ' (' + (m.frequency || '') +
                        ') for ' + (m.duration || '') +
                        (m.quantity ? ' [Qty: ' + m.quantity + ']' : '') + '</li>';
                }).join('') + '</ul></div>';
        }

        return '<div class="timeline-card">' +
            '<div class="timeline-header"><div>' +
            '<span class="timeline-date">📅 ' + c.date +
            ' · ' + (c.time || '10:00 AM') + '</span>' +
            '<span style="margin-left:10px;font-size:12px;color:var(--text-muted);">' +
            'Consulted by <b>' + (c.doctorName || 'Dr. Arun Kumar') +
            '</b></span></div>' +
            '<span class="badge badge-success">Completed</span></div>' +
            '<div style="margin-bottom:12px;">' +
            '<div style="font-size:15px;font-weight:700;color:var(--text-primary);' +
            'margin-bottom:4px;">🩺 ' + c.diagnosis + '</div>' +
            '<p style="font-size:13px;color:var(--text-secondary);' +
            'line-height:1.5;margin:0;">' +
            (c.notes || 'Clinical consultation documented.') +
            '</p></div>' + vitalsHtml + medsHtml +
            '<div style="font-size:12px;color:var(--text-secondary);' +
            'display:flex;justify-content:space-between;flex-wrap:wrap;' +
            'border-top:1px solid var(--border-light);padding-top:8px;">' +
            '<div><b>Advice:</b> ' +
            (c.advice || 'Follow general healthcare advice.') + '</div>' +
            '<div><b>Follow-up:</b> ' +
            (c.followUp || 'As needed') + '</div></div></div>';
    }).join('');
}


function detailsRenderPrescriptions(prescriptions) {

    var tbody = document.getElementById('prescriptionsTableBody');
    if (!tbody) return;

    if (!prescriptions || prescriptions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">No prescriptions recorded.</td></tr>';
        return;
    }

    tbody.innerHTML = prescriptions.map(function (rx) {
        var meds = rx.medicines || [];
        if (meds.length === 0) {
            return '<tr>' +
                '<td style="font-family:monospace;font-weight:600;color:var(--accent);">' + rx.id + '</td>' +
                '<td>' + rx.date + '</td>' +
                '<td colspan="3" style="color:var(--text-muted);">No medicines prescribed</td>' +
                '<td>' + (rx.doctorName || 'Dr. Arun Kumar') + '</td>' +
                '<td><span class="badge badge-success">' + (rx.status || 'Active') + '</span></td>' +
                '</tr>';
        }

        return meds.map(function (m, i) {
            return '<tr>' +
                (i === 0 ? '<td rowspan="' + meds.length +
                 '" style="font-family:monospace;font-weight:600;color:var(--accent);">' +
                 rx.id + '</td>' : '') +
                (i === 0 ? '<td rowspan="' + meds.length +
                 '">' + rx.date + '</td>' : '') +
                '<td style="font-weight:600;">' + (m.medicine || m.name) +
                (m.quantity ? ' <small style="color:var(--text-muted);">(Qty: ' + m.quantity + ')</small>' : '') + '</td>' +
                '<td>' + (m.dosage || '—') + ' (' + (m.frequency || '—') + ')</td>' +
                '<td>' + (m.duration || '—') + '</td>' +
                (i === 0 ? '<td rowspan="' + meds.length +
                 '">' + (rx.doctorName || 'Dr. Arun Kumar') + '</td>' : '') +
                (i === 0 ? '<td rowspan="' + meds.length +
                 '"><span class="badge ' + (rx.status === 'Dispensed' ? 'badge-success' : 'badge-warning') + '">' +
                 (rx.status || 'Active') + '</span></td>' : '') +
                '</tr>';
        }).join('');
    }).join('');
}


function detailsRenderLabs(labs) {

    var tbody = document.getElementById('labsTableBody');
    if (!tbody) return;

    if (!labs || labs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted);">No laboratory reports found.</td></tr>';
        return;
    }

    tbody.innerHTML = labs.map(function (l) {
        var isCompleted = (String(l.status || '').toUpperCase() === 'COMPLETED');
        var normalDisplay = (l.normalRange || '—') + (l.unit && l.normalRange ? ' ' + l.unit : '');
        var resultDisplay = isCompleted
            ? (l.result ? ('<strong>' + escapeHTML(l.result) + (l.unit ? ' ' + escapeHTML(l.unit) : '') + '</strong>') : 'Report Available')
            : '<span style="color:var(--text-muted);font-style:italic;">Pending</span>';

        return '<tr>' +
            '<td style="font-family:monospace;font-weight:600;color:var(--accent);">' +
            (l.id || l.orderNumber || 'LABREQ') + '</td>' +
            '<td>' + (l.orderDate || (l.requestedAt ? String(l.requestedAt).substring(0, 10) : '') || getToday()) + '</td>' +
            '<td style="font-weight:600;">🧪 ' + (l.testName || l.name || 'Lab Test') + '</td>' +
            '<td><span class="badge" style="background:#f0e9e4;">' + (l.category || 'General') + '</span></td>' +
            '<td><span class="badge ' + (isCompleted ? 'badge-success' : 'badge-warning') + '">' + (isCompleted ? 'Completed' : (l.status || 'Pending')) + '</span></td>' +
            '<td><span class="badge ' + (String(l.priority || '').toLowerCase() === 'urgent' ? 'priority-urgent' : 'priority-normal') + '">' +
            (l.priority || 'Normal') + '</span></td>' +
            '<td>' + resultDisplay + '</td>' +
            '<td style="font-size:12px;color:var(--text-secondary);">' + escapeHTML(normalDisplay) + '</td></tr>';
    }).join('');
}


function setTab(tab, btn) {

    document.querySelectorAll('.tab-btn').forEach(function (b) {
        b.classList.remove('active');
    });

    btn.classList.add('active');

    var tabConsultations = document.getElementById('tabConsultations');
    var tabPrescriptions = document.getElementById('tabPrescriptions');
    var tabLabs          = document.getElementById('tabLabs');

    if (tabConsultations) {
        tabConsultations.style.display =
            tab === 'consultations' ? 'block' : 'none';
    }
    if (tabPrescriptions) {
        tabPrescriptions.style.display =
            tab === 'prescriptions' ? 'block' : 'none';
    }
    if (tabLabs) {
        tabLabs.style.display =
            tab === 'labs' ? 'block' : 'none';
    }
}


function startConsultationForPatient() {

    if (!currentPatient) return;

    if (isPatientConsultedToday(currentPatient.id)) {
        showToast('This patient has already completed today\'s consultation.', 'warning');
        return;
    }

    var appts = JSON.parse(
        localStorage.getItem('cms_appointments') || '[]'
    );
    var today = getToday();

    var appt = appts.find(function (a) {
        return a.patientId === currentPatient.id &&
               a.date === today && a.status !== 'Completed';
    });

    if (!appt) {
        var token = appts.filter(function (a) {
            return a.date === today;
        }).length + 1;

        appt = {
            id:          'APT-' + Date.now(),
            token:       token,
            patientId:   currentPatient.id,
            patientName: currentPatient.name,
            age:         currentPatient.age || 30,
            gender:      currentPatient.gender || 'Male',
            blood:       currentPatient.blood || 'O+',
            time:        new Date().toLocaleTimeString(
                             [], { hour:'2-digit', minute:'2-digit' }
                         ),
            type:        'Follow-up',
            status:      'In Progress',
            complaint:   'Clinical follow-up consultation',
            date:        today
        };
        appts.push(appt);
    } else {
        appt.status = 'In Progress';
    }

    localStorage.setItem(
        'cms_appointments',
        JSON.stringify(appts)
    );
    localStorage.setItem('cms_active_appointment', appt.id);
    window.location.href = 'consultation.html?id=' + appt.id;
}


// ============================================================
// 15. PRESCRIPTIONS PAGE
// ============================================================

var allRx      = [];
var filteredRx = [];


function initPrescriptions() {

    loadRxData();
}


function loadRxData() {

    var stored = JSON.parse(
        localStorage.getItem('cms_prescriptions') || '[]'
    );

    if (!stored || stored.length === 0) {
        stored = DEFAULT_RX;
        localStorage.setItem(
            'cms_prescriptions',
            JSON.stringify(stored)
        );
    }

    allRx = stored;
    filterRx();
    rxUpdateStats();
    updateSidebarBadge();
}


function rxUpdateStats() {

    var el;

    el = document.getElementById('statTotalRx');
    if (el) el.textContent = allRx.length;

    var todayCount = allRx.filter(function (r) {
        return r.date === TODAY;
    }).length;

    el = document.getElementById('statTodayRx');
    if (el) el.textContent = todayCount;

    var pendingCount = allRx.filter(function (r) {
        return r.status === 'Pending Dispensation';
    }).length;

    el = document.getElementById('statPendingRx');
    if (el) el.textContent = pendingCount;

    var dispensedCount = allRx.filter(function (r) {
        return r.status === 'Dispensed';
    }).length;

    el = document.getElementById('statDispensedRx');
    if (el) el.textContent = dispensedCount;
}


function filterRx() {

    var searchEl = document.getElementById('rxSearch');
    var statusEl = document.getElementById('statusFilter');

    var q      = searchEl ? searchEl.value.trim().toLowerCase() : '';
    var status = statusEl ? statusEl.value : '';

    filteredRx = allRx.filter(function (r) {

        var medNames = (r.medicines || []).map(function (m) {
            return (m.medicine || m.name || '').toLowerCase();
        }).join(' ');

        var matchQ = !q ||
            (r.patientName && r.patientName.toLowerCase().indexOf(q) !== -1) ||
            (r.id && r.id.toLowerCase().indexOf(q) !== -1) ||
            medNames.indexOf(q) !== -1;

        var matchS = !status || r.status === status;

        return matchQ && matchS;
    });

    rxRenderTable();
}


function rxRenderTable() {

    var tbody = document.getElementById('rxTableBody');
    if (!tbody) return;

    var countLabel = document.getElementById('rxCountLabel');
    if (countLabel) {
        countLabel.textContent = 'Showing ' + filteredRx.length +
            ' of ' + allRx.length + ' prescriptions';
    }

    if (filteredRx.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="7" style="text-align:center;padding:32px;' +
            'color:var(--text-muted);">No prescriptions found.</td></tr>';
        return;
    }

    tbody.innerHTML = filteredRx.map(function (r) {
        return '<tr>' +
            '<td style="font-family:monospace;font-weight:600;color:var(--accent);">' +
            r.id + '</td>' +
            '<td>' + r.date + '</td>' +
            '<td><div style="font-weight:600;color:var(--text-primary);">' +
            r.patientName + '</div>' +
            '<div style="font-size:11px;color:var(--text-muted);">' +
            (r.patientId || '') + '</div></td>' +
            '<td><div class="med-pill-list">' +
            (r.medicines || []).map(function (m) {
                var medName = m.medicine || m.name || 'Medicine';
                return '<div class="med-pill">' +
                    '<b>💊 ' + medName + '</b> <span>' +
                    (m.dosage || '') + ' (' + (m.frequency || '') + ') · ' +
                    (m.duration || '') +
                    (m.quantity ? ' · Qty: ' + m.quantity : '') +
                    '</span></div>';
            }).join('') + '</div></td>' +
            '<td>' + (r.doctorName || 'Dr. Arun Kumar') + '</td>' +
            '<td><span class="badge ' +
            (r.status === 'Dispensed' ? 'badge-success' : 'badge-warning') +
            '">' + r.status + '</span></td>' +
            '<td style="text-align:right;">' +
            '<button class="btn btn-outline btn-sm" ' +
            'onclick="viewRxSlip(\'' + r.id + '\')">🖨 View Slip</button>' +
            '</td></tr>';
    }).join('');
}


function viewRxSlip(id) {

    var rx = allRx.find(function (r) {
        return r.id === id;
    });
    if (!rx) return;

    var setEl = function (elId, val) {
        var el = document.getElementById(elId);
        if (el) el.textContent = val;
    };

    setEl('vRxId',    rx.id);
    setEl('vPatient', rx.patientName);
    setEl('vDate',    rx.date);
    setEl('vStatus',  rx.status);
    setEl('vDoc',     rx.doctorName || 'Dr. Arun Kumar');

    var mb = document.getElementById('vMedBody');
    if (mb) {
        var meds = rx.medicines || [];
        if (meds.length === 0) {
            mb.innerHTML = '<tr><td colspan="7" style="padding:10px;text-align:center;color:#888;">No medications listed.</td></tr>';
        } else {
            mb.innerHTML = meds.map(function (m, i) {
                return '<tr style="border-bottom:1px solid #f0e9e4;">' +
                    '<td style="padding:6px;">' + (i + 1) + '</td>' +
                    '<td style="padding:6px;font-weight:600;">' + (m.medicine || m.name) + '</td>' +
                    '<td style="padding:6px;">' + (m.dosage || '—') + '</td>' +
                    '<td style="padding:6px;">' + (m.frequency || '—') + '</td>' +
                    '<td style="padding:6px;">' + (m.duration || '—') + '</td>' +
                    '<td style="padding:6px;font-weight:600;">' + (m.quantity !== undefined ? m.quantity : '—') + '</td>' +
                    '<td style="padding:6px;color:#555;">' + (m.instructions || '—') + '</td></tr>';
            }).join('');
        }
    }

    var modal = document.getElementById('viewModal');
    if (modal) modal.classList.add('open');
}


function closeModal() {

    var modal = document.getElementById('viewModal');
    if (modal) modal.classList.remove('open');
}


// ============================================================
// 16. LAB TESTS PAGE
// ============================================================

var allLabTests      = [];
var filteredLabTests = [];


function initLabTests() {

    loadLabsData();
}


function loadLabsData() {

    allLabTests = getLabOrders();

    if (localStorage.getItem('cms_lab_orders') === null && (!allLabTests || allLabTests.length === 0)) {
        allLabTests = DEFAULT_LABS;
        localStorage.setItem(
            'cms_lab_orders',
            JSON.stringify(DEFAULT_LABS)
        );
    }

    filterLabTests();
    labUpdateStats();
    updateSidebarBadge();
}


function labUpdateStats() {

    var el;

    el = document.getElementById('statTotalTests');
    if (el) el.textContent = allLabTests.length;

    var pending = allLabTests.filter(function (l) {
        var s = String(l.status || '').toUpperCase();
        return s !== 'COMPLETED' && s !== 'CANCELLED';
    }).length;

    el = document.getElementById('statPendingTests');
    if (el) el.textContent = pending;

    var completed = allLabTests.filter(function (l) {
        var s = String(l.status || '').toUpperCase();
        return s === 'COMPLETED';
    }).length;

    el = document.getElementById('statCompletedTests');
    if (el) el.textContent = completed;

    var urgent = allLabTests.filter(function (l) {
        return (l.priority || '').toLowerCase() === 'urgent';
    }).length;

    el = document.getElementById('statUrgentTests');
    if (el) el.textContent = urgent;
}


function filterLabTests() {

    var searchEl   = document.getElementById('labSearch');
    var statusEl   = document.getElementById('labStatusFilter');
    var priorityEl = document.getElementById('labPriorityFilter');

    var q        = searchEl   ? searchEl.value.trim().toLowerCase() : '';
    var status   = statusEl   ? statusEl.value.trim().toLowerCase()   : '';
    var priority = priorityEl ? priorityEl.value.trim().toLowerCase() : '';

    filteredLabTests = allLabTests.filter(function (l) {

        var matchQ = !q ||
            (l.patientName && l.patientName.toLowerCase().indexOf(q) !== -1) ||
            (l.testName && l.testName.toLowerCase().indexOf(q) !== -1) ||
            (l.id && l.id.toLowerCase().indexOf(q) !== -1) ||
            (l.orderNumber && l.orderNumber.toLowerCase().indexOf(q) !== -1) ||
            (l.category && l.category.toLowerCase().indexOf(q) !== -1);

        var lStatus = String(l.status || '').toLowerCase();
        var matchS = !status || lStatus === status ||
            (status === 'pending' && lStatus !== 'completed' && lStatus !== 'cancelled') ||
            (status === 'completed' && lStatus === 'completed');

        var lPriority = String(l.priority || '').toLowerCase();
        var matchP = !priority || lPriority === priority;

        return matchQ && matchS && matchP;
    });

    labRenderTable();
}


function filterLabs() {
    filterLabTests();
}


function labRenderTable() {

    var tbody = document.getElementById('labTableBody');
    if (!tbody) return;

    var countLabel = document.getElementById('labCountLabel');
    if (countLabel) {
        countLabel.textContent = 'Showing ' + filteredLabTests.length +
            ' of ' + allLabTests.length + ' investigations';
    }

    if (filteredLabTests.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="9" style="text-align:center;padding:32px;' +
            'color:var(--text-muted);">No lab investigations found.</td></tr>';
        return;
    }

    tbody.innerHTML = filteredLabTests.map(function (l) {
        var s = String(l.status || '').toUpperCase();
        var isCompleted = (s === 'COMPLETED');
        var isUrgent = String(l.priority || '').toLowerCase() === 'urgent';
        var displayId = l.orderNumber || l.id || 'LABREQ';
        var statusLabel = (typeof getStatusLabel === 'function') ? getStatusLabel(l.status) : (isCompleted ? 'Completed' : (l.status || 'Pending'));

        return '<tr>' +
            '<td style="font-family:monospace;font-weight:600;color:var(--accent);">' +
            displayId + '</td>' +
            '<td>' + (l.orderDate || (l.requestedAt ? String(l.requestedAt).substring(0, 10) : '') || getToday()) + '</td>' +
            '<td><div style="font-weight:600;color:var(--text-primary);">' +
            (l.patientName || 'Unknown') + '</div>' +
            '<div style="font-size:11px;color:var(--text-muted);">' +
            (l.patientId || '') + '</div></td>' +
            '<td style="font-weight:600;">🧪 ' + (l.testName || 'Lab Test') + '</td>' +
            '<td><span class="badge" style="background:#f0e9e4;">' + (l.category || 'General') + '</span></td>' +
            '<td><span class="badge ' +
            (isUrgent ? 'priority-urgent' : 'priority-normal') +
            '">' + (l.priority || 'Normal') + '</span></td>' +
            '<td><span class="badge ' +
            (isCompleted ? 'badge-success' : 'badge-warning') +
            '">' + statusLabel + '</span></td>' +
            '<td style="font-size:12px;color:var(--text-secondary);' +
            'max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
            (isCompleted ? (l.result ? (escapeHTML(l.result) + (l.unit ? ' ' + escapeHTML(l.unit) : '') + (l.normalRange ? ' <small style="color:var(--text-muted);">(Ref: ' + escapeHTML(l.normalRange) + ')</small>' : '')) : 'Report ready') : (l.summary || 'Pending sample processing')) + '</td>' +
            '<td style="text-align:right;">' +
            '<button class="btn btn-outline btn-sm" ' +
            'onclick="viewReport(\'' + (l.id || l.orderNumber) + '\')">📋 View Report</button>' +
            '</td></tr>';
    }).join('');
}


function viewReport(id) {

    var lab = allLabTests.find(function (l) {
        return l.id === id || l.orderNumber === id;
    });
    if (!lab) return;

    var setEl = function (elId, val) {
        var el = document.getElementById(elId);
        if (el) el.textContent = val;
    };

    var isCompleted = (String(lab.status || '').toUpperCase() === 'COMPLETED');

    setEl('repTestTitle', lab.testName || 'Lab Investigation');
    setEl('repSub',       'Request ID: ' + (lab.id || lab.orderNumber) + (lab.testId ? ' · Test ID: ' + lab.testId : ''));
    setEl('repPatient',   (lab.patientName || '—') + (lab.patientId ? ' (' + lab.patientId + ')' : ''));
    setEl('repDate',      lab.orderDate || (lab.requestedAt ? String(lab.requestedAt).substring(0, 10) : '') || TODAY);
    setEl('repDoc',       lab.doctorName || 'Dr. Arun Kumar');
    setEl('repPriority',  (lab.priority || 'Normal') + (lab.category ? ' · ' + lab.category : ''));

    var badge = document.getElementById('repBadge');
    if (badge) {
        badge.textContent = isCompleted ? 'Completed' : (lab.status || 'Pending');
        badge.className   = 'badge ' +
            (isCompleted ? 'badge-success' : 'badge-warning');
    }

    var body = document.getElementById('repBody');
    if (body) {
        if (isCompleted) {
            var findings = 'Test: ' + (lab.testName || 'Lab Test') +
                '\nResult: ' + (lab.result || 'Report ready') + (lab.unit ? ' ' + lab.unit : '') +
                '\nNormal Range: ' + (lab.normalRange || '—') + (lab.unit && lab.normalRange ? ' ' + lab.unit : '') +
                '\nUnit: ' + (lab.unit || '—') +
                '\nStatus: Completed' +
                '\nCompleted Date: ' + (lab.completedAt || lab.orderDate || TODAY);
            if (lab.resultEnteredBy) {
                findings += '\nLab Technician: ' + lab.resultEnteredBy;
            }
            if (lab.remarks) {
                findings += '\nRemarks: ' + lab.remarks;
            }
            body.style.whiteSpace = 'pre-line';
            body.textContent = findings;
        } else {
            var pendingInfo = 'Status: Pending\nLab request is awaiting sample intake and processing.' +
                (lab.normalRange ? '\nReference Normal Range: ' + lab.normalRange + (lab.unit ? ' ' + lab.unit : '') : '');
            body.style.whiteSpace = 'pre-line';
            body.textContent = pendingInfo;
        }
    }

    var modal = document.getElementById('reportModal');
    if (modal) modal.classList.add('open');
}


function closeReportModal() {

    var modal = document.getElementById('reportModal');
    if (modal) modal.classList.remove('open');
}


function populateOrderModalLabTests() {

    var sel = document.getElementById('mTestSelect');
    if (!sel) return;

    var activeTests = getActiveMasterLabTests();
    if (activeTests.length === 0) {
        sel.innerHTML = '<option value="">-- No Active Lab Tests Available --</option>';
        return;
    }

    sel.innerHTML = '<option value="">-- Select Lab Test from Master --</option>' +
        activeTests.map(function (t) {
            return '<option value="' + t.id + '|' + (t.name || t.testName) + '|' + (t.category || 'General') + '">' +
                (t.name || t.testName) + ' (' + (t.category || 'General') + ')' +
                '</option>';
        }).join('');
}


function openOrderModal() {

    var patients = JSON.parse(
        localStorage.getItem('cms_patients') || '[]'
    );

    var sel = document.getElementById('mPatientSelect');
    if (sel) {
        sel.innerHTML = patients.map(function (p) {
            return '<option value="' + p.id + '|' + p.name +
                '">' + p.name + ' (' + p.id + ')</option>';
        }).join('');
    }

    populateOrderModalLabTests();

    var modal = document.getElementById('orderModal');
    if (modal) modal.classList.add('open');
}


function closeOrderModal() {

    var modal = document.getElementById('orderModal');
    if (modal) modal.classList.remove('open');
}


function submitNewLabOrder(e) {

    e.preventDefault();

    var patSelect = document.getElementById('mPatientSelect');
    var testSelect = document.getElementById('mTestSelect');
    if (!patSelect || !testSelect) return;

    var patVal = patSelect.value.split('|');
    var patId  = patVal[0];
    var patName = patVal[1] || 'Patient';

    if (!testSelect.value) {
        showToast('Please select an active lab test.', 'warning');
        return;
    }

    var testVal  = testSelect.value.split('|');
    var testId   = testVal[0];
    var testName = testVal[1] || testSelect.value;
    var category = testVal[2] || 'General';

    var priority = document.getElementById('mPriority').value;
    var notes    = (document.getElementById('mIndication') || {}).value || '';
    notes = notes.trim();

    var masterTest = findLabTestById(testId);
    if (!masterTest || (masterTest.status || 'Active').toLowerCase() !== 'active') {
        showToast('Selected lab test is inactive or invalid.', 'warning');
        return;
    }

    var orderId = 'LABREQ-' + Date.now();
    var newOrder = {
        id:          orderId,
        orderNumber: orderId,
        testId:      masterTest.id,
        testName:    masterTest.name || testName,
        category:    masterTest.category || category,
        price:       Number(masterTest.price || 0),
        normalRange: String(masterTest.normalRange || '').trim(),
        unit:        String(masterTest.unit || '').trim(),
        orderDate:   getToday(),
        requestedAt: getToday() + ' ' + new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
        patientId:   patId,
        patientName: patName,
        priority:    priority,
        status:      'Pending',
        doctorId:    (loggedInUser && loggedInUser.id) || 'DOC001',
        doctorName:  (loggedInUser && (loggedInUser.name || loggedInUser.username)) || 'Dr. Arun Kumar',
        summary:     notes
            ? 'Clinical note: ' + notes
            : 'Order requested by physician; awaiting diagnostic lab collection.'
    };

    var rawOrders = JSON.parse(localStorage.getItem('cms_lab_orders') || '[]');
    rawOrders.unshift(newOrder);
    localStorage.setItem(
        'cms_lab_orders',
        JSON.stringify(rawOrders)
    );

    allLabTests = rawOrders;

    closeOrderModal();
    filterLabTests();
    labUpdateStats();
    showToast('Lab request for ' + (masterTest.name || testName) + ' submitted!', 'success');
}


// ============================================================
// 17. AUTO-INIT ON PAGE LOAD
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    // Seed data if needed
    seedAllData();

    // Common UI
    initDoctorUI();
    initDateLabel();

    // Auto-close sidebar on mobile when a nav item is clicked
    var navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(function (item) {
        item.addEventListener('click', function () {
            if (window.innerWidth <= 992) {
                closeSidebar();
            }
        });
    });

    // Detect page and run the correct initializer
    var page = getCurrentPage();

    switch (page) {

        case 'dashboard.html':
            initDashboard();
            break;

        case 'appointments.html':
            initAppointments();
            break;

        case 'consultation.html':
            initConsultation();
            break;

        case 'patients.html':
            initPatients();
            break;

        case 'patient-details.html':
            initPatientDetails();
            break;

        case 'prescriptions.html':
            initPrescriptions();
            break;

        case 'lab-tests.html':
            initLabTests();
            break;

        default:
            break;
    }
});
