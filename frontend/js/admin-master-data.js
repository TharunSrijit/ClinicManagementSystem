// ============================================================
// CMS - ADMIN MASTER DATA (MEDICINES & LAB TESTS)
// File: js/admin-master-data.js
// ============================================================

(function () {
    'use strict';

    let allMedicines = [];
    let allStocks = [];
    let allPriceLists = [];
    let allLabTests = [];

    document.addEventListener('DOMContentLoaded', async () => {
        const user = CMS.requireRole(['admin']);
        if (!user) return;

        if (document.getElementById('medicineForm')) {
            await initMedicines();
        }
        if (document.getElementById('labTestForm')) {
            await initLabTests();
        }
    });

    function setMessage(element, text, type) {
        if (!element) return;
        element.textContent = text;
        element.className = 'master-message' + (type ? ' is-' + type : '');
    }

    function formatPrice(value) {
        if (value == null || isNaN(value)) return '₹0.00';
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
    }

    // ============================================================
    // MEDICINE MASTER
    // ============================================================
    async function initMedicines() {
        const form = document.getElementById('medicineForm');
        if (!form) return;

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
            if (formTitle) formTitle.textContent = 'Add medicine';
            if (submitButton) submitButton.textContent = 'Add medicine';
            if (cancelButton) cancelButton.hidden = true;
            setMessage(message, '', '');
        }

        if (cancelButton) {
            cancelButton.addEventListener('click', resetForm);
        }

        async function loadData() {
            try {
                const [meds, stocks, prices] = await Promise.all([
                    CMS.api.list('/admin/medicines/').catch(() => []),
                    CMS.api.list('/admin/stock/').catch(() => []),
                    CMS.api.list('/admin/price-list/').catch(() => [])
                ]);
                allMedicines = meds;
                allStocks = stocks;
                allPriceLists = prices;
                render();
            } catch (err) {
                console.error('Failed to load medicines:', err);
                if (tableBody) tableBody.innerHTML = '<tr><td colspan="11">Failed to load medicines.</td></tr>';
            }
        }

        function render() {
            if (!tableBody) return;
            tableBody.innerHTML = '';

            const query = (searchInput?.value || '').trim().toLowerCase();
            const filtered = allMedicines.filter(m => {
                const name = (m.medicine_name || '').toLowerCase();
                const cat = (m.category || '').toLowerCase();
                const idStr = String(m.id);
                return name.includes(query) || cat.includes(query) || idStr.includes(query);
            });

            if (filtered.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="11">No medicines found.</td></tr>';
                return;
            }

            filtered.forEach(med => {
                const stockItem = allStocks.find(s => s.medicine === med.id) || {};
                const priceItem = allPriceLists.find(p => p.medicine === med.id) || {};
                const displayPrice = stockItem.selling_price || priceItem.selling_price || '0.00';
                const displayStock = stockItem.quantity ?? 0;
                const batch = stockItem.batch_number || '-';
                const expiry = stockItem.expiry_date || '-';
                const statusText = med.is_active ? 'Active' : 'Inactive';
                const statusBadge = `<span class="master-status ${med.is_active ? 'is-active' : 'is-inactive'}">${statusText}</span>`;

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>MED${String(med.id).padStart(3, '0')}</td>
                    <td><strong>${med.medicine_name}</strong></td>
                    <td>${med.category || '-'}</td>
                    <td>${med.unit || '-'}</td>
                    <td>${formatPrice(displayPrice)}</td>
                    <td>${displayStock}</td>
                    <td>10</td>
                    <td>${batch}</td>
                    <td>${expiry}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button type="button" class="btn-table edit-med-btn">Edit</button>
                        <button type="button" class="btn-table toggle-med-btn">${med.is_active ? 'Deactivate' : 'Activate'}</button>
                    </td>
                `;

                row.querySelector('.edit-med-btn').addEventListener('click', () => {
                    form.dataset.editId = String(med.id);
                    if (nameInput) nameInput.value = med.medicine_name || '';
                    if (categoryInput) categoryInput.value = med.category || '';
                    if (unitInput) unitInput.value = med.unit || '';
                    if (priceInput) priceInput.value = displayPrice;
                    if (stockInput) stockInput.value = displayStock;
                    if (reorderInput) reorderInput.value = 10;
                    if (batchInput) batchInput.value = batch !== '-' ? batch : '';
                    if (expiryInput) expiryInput.value = expiry !== '-' ? expiry : '';
                    if (statusInput) statusInput.value = statusText;
                    if (formTitle) formTitle.textContent = 'Edit medicine';
                    if (submitButton) submitButton.textContent = 'Update medicine';
                    if (cancelButton) cancelButton.hidden = false;
                    setMessage(message, '', '');
                    window.scrollTo({ top: form.offsetTop - 50, behavior: 'smooth' });
                });

                row.querySelector('.toggle-med-btn').addEventListener('click', async () => {
                    try {
                        await CMS.api.patch(`/admin/medicines/${med.id}/`, {
                            is_active: !med.is_active
                        });
                        await loadData();
                    } catch (err) {
                        alert('Failed to update status: ' + (err.message || 'Server error'));
                    }
                });

                tableBody.appendChild(row);
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', render);
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const editId = form.dataset.editId;
            const name = nameInput?.value.trim();
            const category = categoryInput?.value.trim();
            const unit = unitInput?.value.trim();
            const statusVal = statusInput?.value;

            if (!name) {
                setMessage(message, 'Please provide medicine name.', 'error');
                return;
            }

            try {
                if (editId) {
                    await CMS.api.patch(`/admin/medicines/${editId}/`, {
                        medicine_name: name,
                        category: category,
                        unit: unit,
                        is_active: statusVal === 'Active'
                    });
                    setMessage(message, 'Medicine updated successfully.', 'success');
                } else {
                    await CMS.api.post('/admin/medicines/', {
                        medicine_name: name,
                        category: category,
                        unit: unit,
                        is_active: statusVal === 'Active'
                    });
                    setMessage(message, 'Medicine added successfully.', 'success');
                }
                resetForm();
                await loadData();
            } catch (err) {
                console.error('Failed to save medicine:', err);
                setMessage(message, 'Failed to save medicine: ' + (err.message || 'Server error'), 'error');
            }
        });

        await loadData();
    }

    // ============================================================
    // LAB TEST MASTER
    // ============================================================
    async function initLabTests() {
        const form = document.getElementById('labTestForm');
        if (!form) return;

        const nameInput = document.getElementById('labTestName');
        const categoryInput = document.getElementById('labTestCategory');
        const priceInput = document.getElementById('labTestPrice');
        const normalRangeInput = document.getElementById('labTestNormalRange');
        const unitInput = document.getElementById('labTestUnit');
        const statusInput = document.getElementById('labTestStatus');
        const descInput = document.getElementById('labTestDescription');
        const searchInput = document.getElementById('labTestSearch');
        const tableBody = document.getElementById('labTestTableBody');
        const formTitle = document.getElementById('lab-test-form-title');
        const submitButton = document.getElementById('labTestSubmit');
        const cancelButton = document.getElementById('labTestCancelEdit');
        const message = document.getElementById('labTestMessage');

        function resetForm() {
            form.reset();
            form.dataset.editId = '';
            if (formTitle) formTitle.textContent = 'Add lab test';
            if (submitButton) submitButton.textContent = 'Add lab test';
            if (cancelButton) cancelButton.hidden = true;
            setMessage(message, '', '');
        }

        if (cancelButton) {
            cancelButton.addEventListener('click', resetForm);
        }

        async function loadData() {
            try {
                allLabTests = await CMS.api.list('/admin/lab-tests/');
                render();
            } catch (err) {
                console.error('Failed to load lab tests:', err);
                if (tableBody) tableBody.innerHTML = '<tr><td colspan="9">Failed to load lab tests.</td></tr>';
            }
        }

        function render() {
            if (!tableBody) return;
            tableBody.innerHTML = '';

            const query = (searchInput?.value || '').trim().toLowerCase();
            const filtered = allLabTests.filter(t => {
                const name = (t.test_name || '').toLowerCase();
                const code = (t.test_code || '').toLowerCase();
                return name.includes(query) || code.includes(query);
            });

            if (filtered.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="9">No lab tests found.</td></tr>';
                return;
            }

            filtered.forEach(test => {
                const statusText = test.is_active ? 'Active' : 'Inactive';
                const statusBadge = `<span class="master-status ${test.is_active ? 'is-active' : 'is-inactive'}">${statusText}</span>`;

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${test.test_code || ('LAB' + String(test.id).padStart(3, '0'))}</td>
                    <td><strong>${test.test_name}</strong></td>
                    <td>General</td>
                    <td>${formatPrice(test.price)}</td>
                    <td>${test.normal_range || '-'}</td>
                    <td>${test.unit || '-'}</td>
                    <td>${test.description || '-'}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button type="button" class="btn-table edit-test-btn">Edit</button>
                        <button type="button" class="btn-table toggle-test-btn">${test.is_active ? 'Deactivate' : 'Activate'}</button>
                    </td>
                `;

                row.querySelector('.edit-test-btn').addEventListener('click', () => {
                    form.dataset.editId = String(test.id);
                    if (nameInput) nameInput.value = test.test_name || '';
                    if (priceInput) priceInput.value = test.price || '';
                    if (normalRangeInput) normalRangeInput.value = test.normal_range || '';
                    if (unitInput) unitInput.value = test.unit || '';
                    if (descInput) descInput.value = test.description || '';
                    if (statusInput) statusInput.value = statusText;
                    if (formTitle) formTitle.textContent = 'Edit lab test';
                    if (submitButton) submitButton.textContent = 'Update lab test';
                    if (cancelButton) cancelButton.hidden = false;
                    setMessage(message, '', '');
                    window.scrollTo({ top: form.offsetTop - 50, behavior: 'smooth' });
                });

                row.querySelector('.toggle-test-btn').addEventListener('click', async () => {
                    try {
                        await CMS.api.patch(`/admin/lab-tests/${test.id}/`, {
                            is_active: !test.is_active
                        });
                        await loadData();
                    } catch (err) {
                        alert('Failed to update status: ' + (err.message || 'Server error'));
                    }
                });

                tableBody.appendChild(row);
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', render);
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const editId = form.dataset.editId;
            const name = nameInput?.value.trim();
            const price = parseFloat(priceInput?.value) || 0;
            const normalRange = normalRangeInput?.value.trim();
            const unit = unitInput?.value.trim();
            const desc = descInput?.value.trim();
            const statusVal = statusInput?.value;

            if (!name) {
                setMessage(message, 'Please provide test name.', 'error');
                return;
            }

            try {
                if (editId) {
                    await CMS.api.patch(`/admin/lab-tests/${editId}/`, {
                        test_name: name,
                        price: price,
                        normal_range: normalRange,
                        unit: unit,
                        description: desc,
                        is_active: statusVal === 'Active'
                    });
                    setMessage(message, 'Lab test updated successfully.', 'success');
                } else {
                    const testCode = 'LAB' + Math.floor(100 + Math.random() * 900);
                    await CMS.api.post('/admin/lab-tests/', {
                        test_code: testCode,
                        test_name: name,
                        price: price,
                        normal_range: normalRange,
                        unit: unit,
                        description: desc,
                        is_active: statusVal === 'Active'
                    });
                    setMessage(message, 'Lab test added successfully.', 'success');
                }
                resetForm();
                await loadData();
            } catch (err) {
                console.error('Failed to save lab test:', err);
                setMessage(message, 'Failed to save lab test: ' + (err.message || 'Server error'), 'error');
            }
        });

        await loadData();
    }
})();
