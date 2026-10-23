(function () {
    'use strict';

    const loggedInUser = readLoggedInUser();
    if (!loggedInUser || loggedInUser.role !== 'admin') {
        window.location.replace('../index.html');
        return;
    }

    function readLoggedInUser() {
        try {
            return JSON.parse(localStorage.getItem('loggedInUser') || 'null');
        } catch (error) {
            localStorage.removeItem('loggedInUser');
            return null;
        }
    }

    function getNextId(records, prefix, counterKey) {
        const highestExisting = records.reduce((highest, record) => {
            const match = new RegExp('^' + prefix + '(\\d+)$').exec(record.id || '');
            return match ? Math.max(highest, Number(match[1])) : highest;
        }, 0);
        const storedNext = Number(localStorage.getItem(counterKey)) || 1;
        let sequence = Math.max(storedNext, highestExisting + 1);
        let id;

        do {
            id = prefix + String(sequence).padStart(3, '0');
            sequence += 1;
        } while (records.some(record => record.id === id));

        localStorage.setItem(counterKey, String(sequence));
        return id;
    }

    function normalizeName(value) {
        return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    }

    function formatPrice(value) {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
    }

    function getToday() {
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return today.getFullYear() + '-' + month + '-' + day;
    }

    function setMessage(element, text, type) {
        element.textContent = text;
        element.className = 'master-message' + (type ? ' is-' + type : '');
    }

    function addCell(row, value) {
        const cell = document.createElement('td');
        cell.textContent = value == null ? '' : String(value);
        row.appendChild(cell);
        return cell;
    }

    function addStatus(cell, status) {
        const badge = document.createElement('span');
        badge.className = 'master-status ' + (status === 'Active' ? 'is-active' : 'is-inactive');
        badge.textContent = status;
        cell.appendChild(badge);
    }

    function addAction(cell, label, handler) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.addEventListener('click', handler);
        cell.appendChild(button);
    }

    const CANONICAL_LAB_TESTS = [
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

    function findCanonicalMatch(testName) {
        if (!testName) return null;
        const clean = String(testName).trim().toLowerCase();
        const stripped = clean.replace(/\(.*?\)/g, '').trim();

        for (let i = 0; i < CANONICAL_LAB_TESTS.length; i++) {
            const canonical = CANONICAL_LAB_TESTS[i];
            if (canonical.aliases.some(alias => alias === clean || alias === stripped)) {
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
        const processedTests = masterTests.map(t => Object.assign({}, t));

        // Group tests by canonical match or core normalized name
        const groups = new Map();

        processedTests.forEach(test => {
            const canonical = findCanonicalMatch(test.name || test.testName);
            let groupKey;
            if (canonical) {
                groupKey = 'canonical:' + canonical.name;
            } else {
                const cleanName = String(test.name || test.testName || '').trim().replace(/\s+/g, ' ').toLowerCase();
                const coreName = cleanName.replace(/\(.*?\)/g, '').trim();
                groupKey = 'custom:' + (coreName || cleanName || test.id);
            }

            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }
            groups.get(groupKey).push(test);
        });

        groups.forEach((groupTests, groupKey) => {
            const canonical = groupKey.startsWith('canonical:')
                ? CANONICAL_LAB_TESTS.find(c => 'canonical:' + c.name === groupKey)
                : null;

            // Sort so the lowest numeric ID (e.g. LAB001 < LAB009) is the primary record
            groupTests.sort((a, b) => {
                const numA = parseInt((String(a.id || '').match(/\d+/) || [999999])[0], 10);
                const numB = parseInt((String(b.id || '').match(/\d+/) || [999999])[0], 10);
                if (numA !== numB) return numA - numB;
                return String(a.id).localeCompare(String(b.id));
            });

            const primary = groupTests[0];

            let bestNormalRange = String(primary.normalRange || '').trim();
            let bestUnit = String(primary.unit || '').trim();
            let bestDescription = String(primary.description || '').trim();

            for (let i = 1; i < groupTests.length; i++) {
                const dup = groupTests[i];
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

            // Populate missing data on Primary record
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
            for (let i = 1; i < groupTests.length; i++) {
                const duplicate = groupTests[i];
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
        const tests = getLabTests();
        const master = tests.filter(test => {
            if (test.recordType === 'master') return true;
            if (test.patientId || test.patientName || test.consultationId || test.requestedAt || test.orderDate) return false;
            return test.id && (test.name || test.testName);
        });

        const cleaned = cleanupMasterLabTests(master);
        if (cleaned.modified) {
            saveMasterLabTests(cleaned.tests);
        }
        return cleaned.tests;
    }

    function saveMasterLabTests(masterTests) {
        const allTests = getLabTests();
        const existingWorkflows = allTests.filter(test => {
            return test.recordType !== 'master' && (test.patientId || test.patientName || test.consultationId || test.requestedAt || test.orderDate);
        });
        const catalogRecords = masterTests.map(test => Object.assign({}, test, { recordType: 'master' }));
        return saveLabTests(existingWorkflows.concat(catalogRecords));
    }

    function seedMedicinesIfMissing() {
        const medicines = getMedicines();
        const samples = [
            {
                name: 'Paracetamol 500mg',
                category: 'Tablet',
                unit: 'Strip',
                price: 25,
                stock: 100,
                reorderLevel: 20,
                batchNo: 'PCM2026A',
                expiryDate: '2027-08-31',
                status: 'Active'
            },
            {
                name: 'Amoxicillin 500mg',
                category: 'Capsule',
                unit: 'Strip',
                price: 80,
                stock: 50,
                reorderLevel: 10,
                batchNo: 'AMX2026A',
                expiryDate: '2027-06-30',
                status: 'Active'
            },
            {
                name: 'Cetirizine 10mg',
                category: 'Tablet',
                unit: 'Strip',
                price: 30,
                stock: 40,
                reorderLevel: 10,
                batchNo: 'CET2026A',
                expiryDate: '2027-10-31',
                status: 'Active'
            },
            {
                name: 'Azithromycin 250mg',
                category: 'Tablet',
                unit: 'Strip',
                price: 60,
                stock: 30,
                reorderLevel: 8,
                batchNo: 'AZI2026A',
                expiryDate: '2027-02-28',
                status: 'Active'
            },
            {
                name: 'Omeprazole 20mg',
                category: 'Capsule',
                unit: 'Strip',
                price: 45,
                stock: 60,
                reorderLevel: 15,
                batchNo: 'OME2026A',
                expiryDate: '2027-07-31',
                status: 'Active'
            },
            {
                name: 'Cough Syrup 100ml',
                category: 'Syrup',
                unit: 'Bottle',
                price: 90,
                stock: 25,
                reorderLevel: 5,
                batchNo: 'COU2026A',
                expiryDate: '2027-04-30',
                status: 'Active'
            },
            {
                name: 'Vitamin C 500mg',
                category: 'Tablet',
                unit: 'Box',
                price: 120,
                stock: 80,
                reorderLevel: 20,
                batchNo: 'VTC2026A',
                expiryDate: '2027-12-31',
                status: 'Active'
            },
            {
                name: 'Clotrimazole 1% Cream',
                category: 'Cream',
                unit: 'Tube',
                price: 55,
                stock: 12,
                reorderLevel: 5,
                batchNo: 'CLO2026A',
                expiryDate: '2027-03-31',
                status: 'Active'
            }
        ];

        const existingNames = new Set(medicines.map(item => normalizeName(item.name || '')));
        const additions = [];
        samples.forEach(sample => {
            const normalizedName = normalizeName(sample.name);
            if (existingNames.has(normalizedName)) return;
            additions.push(Object.assign({}, sample, {
                id: getNextId(medicines.concat(additions), 'MED', 'cms_medicine_id_sequence')
            }));
            existingNames.add(normalizedName);
        });

        if (additions.length) saveMedicines(medicines.concat(additions));
    }

    function seedLabTestsIfMissing() {
        const tests = getLabTests();
        const masterTests = tests.filter(test => test.recordType === 'master');

        const additions = [];
        CANONICAL_LAB_TESTS.forEach(sample => {
            const canonicalSample = findCanonicalMatch(sample.name);
            const exists = masterTests.some(item => {
                const c = findCanonicalMatch(item.name || item.testName);
                if (c && canonicalSample && c.name === canonicalSample.name) return true;
                return normalizeName(item.name || item.testName || '') === normalizeName(sample.name);
            });
            if (exists) return;
            additions.push(Object.assign({}, sample, {
                id: getNextId(tests.concat(additions), 'LAB', 'cms_lab_test_id_sequence'),
                recordType: 'master'
            }));
        });

        if (additions.length) saveLabTests(tests.concat(additions));
    }

    function initMedicines() {
        const form = document.getElementById('medicineForm');
        if (!form) return;
        seedMedicinesIfMissing();

        const nameInput = document.getElementById('medicineName');
        const categoryInput = document.getElementById('medicineCategory');
        const unitInput = document.getElementById('medicineUnit');
        const priceInput = document.getElementById('medicinePrice');
        const stockInput = document.getElementById('medicineStock');
        const reorderInput = document.getElementById('medicineReorderLevel');
        const batchInput = document.getElementById('medicineBatchNo');
        const expiryInput = document.getElementById('medicineExpiryDate');
        const statusInput = document.getElementById('medicineStatus');
        const searchInput = document.getElementById('medicineSearch');
        const tableBody = document.getElementById('medicineTableBody');
        const formTitle = document.getElementById('medicine-form-title');
        const submitButton = document.getElementById('medicineSubmit');
        const cancelButton = document.getElementById('medicineCancelEdit');
        const message = document.getElementById('medicineMessage');

        function resetForm() {
            form.reset();
            form.dataset.editId = '';
            formTitle.textContent = 'Add medicine';
            submitButton.textContent = 'Add medicine';
            cancelButton.hidden = true;
            setMessage(message, '', '');
        }

        function render() {
            const medicines = getMedicines();
            const query = searchInput.value.trim().toLocaleLowerCase();
            const filtered = medicines.filter(medicine => [medicine.id, medicine.name, medicine.category, medicine.batchNo]
                .some(value => String(value || '').toLocaleLowerCase().includes(query)));

            tableBody.textContent = '';
            if (filtered.length === 0) {
                const row = document.createElement('tr');
                const cell = addCell(row, medicines.length ? 'No medicines match your search.' : 'No medicines have been added.');
                cell.colSpan = 11;
                tableBody.appendChild(row);
                return;
            }

            filtered.forEach(medicine => {
                const row = document.createElement('tr');
                addCell(row, medicine.id);
                addCell(row, medicine.name);
                addCell(row, medicine.category);
                addCell(row, medicine.unit);
                addCell(row, formatPrice(Number(medicine.price)));

                const stockCell = addCell(row, Number(medicine.stock));
                if (Number(medicine.stock) <= Number(medicine.reorderLevel)) {
                    const flag = document.createElement('div');
                    flag.className = 'master-status is-warning';
                    flag.textContent = 'Low stock';
                    stockCell.appendChild(flag);
                }

                addCell(row, medicine.reorderLevel);
                addCell(row, medicine.batchNo || '-');
                const expiryCell = addCell(row, medicine.expiryDate || '-');
                if (medicine.expiryDate && medicine.expiryDate < getToday()) {
                    const flag = document.createElement('div');
                    flag.className = 'master-status is-danger';
                    flag.textContent = 'Expired';
                    expiryCell.appendChild(flag);
                }
                const statusCell = document.createElement('td');
                addStatus(statusCell, medicine.status || 'Active');
                row.appendChild(statusCell);

                const actions = document.createElement('td');
                actions.className = 'master-actions';
                addAction(actions, 'Edit', () => edit(medicine));
                addAction(actions, medicine.status === 'Active' ? 'Deactivate' : 'Activate', () => toggle(medicine.id));
                row.appendChild(actions);
                tableBody.appendChild(row);
            });
        }

        function edit(medicine) {
            form.dataset.editId = medicine.id;
            nameInput.value = medicine.name || '';
            categoryInput.value = medicine.category || '';
            unitInput.value = medicine.unit || '';
            priceInput.value = medicine.price ?? '';
            stockInput.value = medicine.stock ?? '';
            reorderInput.value = medicine.reorderLevel ?? '';
            batchInput.value = medicine.batchNo || '';
            expiryInput.value = medicine.expiryDate || '';
            statusInput.value = medicine.status || 'Active';
            formTitle.textContent = 'Edit medicine ' + medicine.id;
            submitButton.textContent = 'Save changes';
            cancelButton.hidden = false;
            setMessage(message, '', '');
            nameInput.focus();
        }

        function toggle(id) {
            const medicines = getMedicines();
            const medicine = medicines.find(item => item.id === id);
            if (!medicine) return;
            medicine.status = medicine.status === 'Active' ? 'Inactive' : 'Active';
            if (!saveMedicines(medicines)) return;
            setMessage(message, medicine.name + ' is now ' + medicine.status.toLowerCase() + '.', 'success');
            render();
        }

        form.addEventListener('submit', event => {
            event.preventDefault();
            if (!CMSValidation.validateForm(form)) return;

            const medicines = getMedicines();
            const editId = form.dataset.editId;
            const name = nameInput.value.trim().replace(/\s+/g, ' ');
            const duplicate = medicines.some(item => item.id !== editId && normalizeName(item.name || '') === normalizeName(name));
            if (duplicate) {
                setMessage(message, 'A medicine with this name already exists.', 'error');
                nameInput.focus();
                return;
            }

            const existing = editId ? medicines.find(item => item.id === editId) : null;
            const medicine = {
                id: existing ? existing.id : getNextId(medicines, 'MED', 'cms_medicine_id_sequence'),
                name,
                category: categoryInput.value,
                unit: unitInput.value,
                price: Number(priceInput.value),
                stock: Number(stockInput.value),
                reorderLevel: Number(reorderInput.value),
                batchNo: batchInput.value.trim(),
                expiryDate: expiryInput.value,
                status: statusInput.value
            };

            const updated = existing
                ? medicines.map(item => item.id === editId ? medicine : item)
                : medicines.concat(medicine);
            if (!saveMedicines(updated)) return;

            render();
            resetForm();
            setMessage(message, existing ? 'Medicine updated.' : 'Medicine added.', 'success');
        });

        cancelButton.addEventListener('click', resetForm);
        searchInput.addEventListener('input', render);
        render();
    }

    function initLabTests() {
        const form = document.getElementById('labTestForm');
        if (!form) return;
        seedLabTestsIfMissing();

        const nameInput = document.getElementById('labTestName');
        const categoryInput = document.getElementById('labTestCategory');
        const priceInput = document.getElementById('labTestPrice');
        const normalRangeInput = document.getElementById('labTestNormalRange');
        const unitInput = document.getElementById('labTestUnit');
        const descriptionInput = document.getElementById('labTestDescription');
        const statusInput = document.getElementById('labTestStatus');
        const searchInput = document.getElementById('labTestSearch');
        const tableBody = document.getElementById('labTestTableBody');
        const formTitle = document.getElementById('lab-test-form-title');
        const submitButton = document.getElementById('labTestSubmit');
        const cancelButton = document.getElementById('labTestCancelEdit');
        const message = document.getElementById('labTestMessage');

        function resetForm() {
            form.reset();
            form.dataset.editId = '';
            formTitle.textContent = 'Add lab test';
            submitButton.textContent = 'Add lab test';
            cancelButton.hidden = true;
            setMessage(message, '', '');
        }

        function render() {
            const tests = getMasterLabTests();
            const query = searchInput.value.trim().toLocaleLowerCase();
            const filtered = tests.filter(test => [test.id, test.name, test.category, test.normalRange, test.unit]
                .some(value => String(value || '').toLocaleLowerCase().includes(query)));

            tableBody.textContent = '';
            if (filtered.length === 0) {
                const row = document.createElement('tr');
                const cell = addCell(row, tests.length ? 'No tests match your search.' : 'No lab tests have been added.');
                cell.colSpan = 9;
                tableBody.appendChild(row);
                return;
            }

            filtered.forEach(test => {
                const row = document.createElement('tr');
                addCell(row, test.id);
                addCell(row, test.name);
                addCell(row, test.category);
                addCell(row, formatPrice(Number(test.price)));
                addCell(row, test.normalRange || '-');
                addCell(row, test.unit || '-');
                addCell(row, test.description || '-');
                const statusCell = document.createElement('td');
                addStatus(statusCell, test.status || 'Active');
                row.appendChild(statusCell);
                const actions = document.createElement('td');
                actions.className = 'master-actions';
                addAction(actions, 'Edit', () => edit(test));
                addAction(actions, test.status === 'Active' ? 'Deactivate' : 'Activate', () => toggle(test.id));
                row.appendChild(actions);
                tableBody.appendChild(row);
            });
        }

        function edit(test) {
            form.dataset.editId = test.id;
            nameInput.value = test.name || '';
            categoryInput.value = test.category || '';
            priceInput.value = test.price ?? '';
            if (normalRangeInput) normalRangeInput.value = test.normalRange || '';
            if (unitInput) unitInput.value = test.unit || '';
            descriptionInput.value = test.description || '';
            statusInput.value = test.status || 'Active';
            formTitle.textContent = 'Edit lab test ' + test.id;
            submitButton.textContent = 'Save changes';
            cancelButton.hidden = false;
            setMessage(message, '', '');
            nameInput.focus();
        }

        function toggle(id) {
            const tests = getMasterLabTests();
            const test = tests.find(item => item.id === id);
            if (!test) return;
            test.status = test.status === 'Active' ? 'Inactive' : 'Active';
            if (!saveMasterLabTests(tests)) return;
            setMessage(message, test.name + ' is now ' + test.status.toLowerCase() + '.', 'success');
            render();
        }

        form.addEventListener('submit', event => {
            event.preventDefault();
            if (!CMSValidation.validateForm(form)) return;

            const allTests = getLabTests();
            const tests = allTests.filter(test => test.recordType === 'master');
            const editId = form.dataset.editId;
            const name = nameInput.value.trim().replace(/\s+/g, ' ');
            const canonicalNew = findCanonicalMatch(name);
            const duplicate = tests.some(item => {
                if (item.id === editId) return false;
                if (normalizeName(item.name || '') === normalizeName(name)) return true;
                const c = findCanonicalMatch(item.name || '');
                return c && canonicalNew && c.name === canonicalNew.name;
            });
            if (duplicate) {
                setMessage(message, 'A lab test with this name already exists in the master catalog.', 'error');
                nameInput.focus();
                return;
            }

            const existing = editId ? tests.find(item => item.id === editId) : null;
            const test = {
                id: existing ? existing.id : getNextId(allTests, 'LAB', 'cms_lab_test_id_sequence'),
                name,
                category: categoryInput.value,
                price: Number(priceInput.value),
                normalRange: normalRangeInput ? normalRangeInput.value.trim() : (existing ? existing.normalRange : ''),
                unit: unitInput ? unitInput.value.trim() : (existing ? existing.unit : ''),
                description: descriptionInput.value.trim(),
                status: statusInput.value
            };

            const updated = existing
                ? tests.map(item => item.id === editId ? test : item)
                : tests.concat(test);
            if (!saveMasterLabTests(updated)) return;

            render();
            resetForm();
            setMessage(message, existing ? 'Lab test updated.' : 'Lab test added.', 'success');
        });

        cancelButton.addEventListener('click', resetForm);
        searchInput.addEventListener('input', render);
        render();
    }

    document.addEventListener('DOMContentLoaded', () => {
        initMedicines();
        initLabTests();
    });
})();
