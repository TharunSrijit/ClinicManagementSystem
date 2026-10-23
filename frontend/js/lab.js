// ============================================================
// CMS - LABORATORY MODULE
// File: js/lab.js
// ============================================================

(function () {
    'use strict';

    let allOrders = [];
    let allTests = [];
    let allInvoices = [];

    document.addEventListener('DOMContentLoaded', async () => {
        const user = CMS.requireRole(['lab_technician', 'lab', 'admin']);
        if (!user) return;

        initCommonLabUI(user);

        if (document.getElementById('pendingCount') || document.getElementById('completedCount') || document.getElementById('totalTestCount')) {
            await loadDashboard();
        }

        if (document.getElementById('pendingTestsBody') || document.getElementById('pendingTestsTable')) {
            await loadPendingLabOrders();
        }

        if (document.getElementById('testResult') || document.getElementById('orderId')) {
            if (document.getElementById('testResult') && !document.getElementById('testStatus')) {
                await loadEnterResults();
            } else if (document.getElementById('testStatus') || window.location.pathname.includes('test-details')) {
                await loadTestDetails();
            }
        }

        if (document.getElementById('completedTestsBody') || document.getElementById('completedTestsTable')) {
            await loadCompletedTests();
        }

        if (document.getElementById('labBillingForm') || document.getElementById('labBillingTable') || document.getElementById('labOrderSelect')) {
            await loadLabBilling();
        }
    });

    function initCommonLabUI(user) {
        const topbarName = document.getElementById('topbarName');
        const welcomeName = document.getElementById('welcomeName');
        const topbarDate = document.getElementById('topbarDate');
        const timeOfDay = document.getElementById('timeOfDay');

        const displayName = user.full_name || user.username || 'Lab Technician';
        if (topbarName) topbarName.textContent = displayName;
        if (welcomeName) welcomeName.textContent = `Welcome back, ${displayName}!`;

        if (topbarDate) {
            topbarDate.textContent = new Date().toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
            });
        }

        if (timeOfDay) {
            const hr = new Date().getHours();
            timeOfDay.textContent = hr < 12 ? 'morning' : (hr < 17 ? 'afternoon' : 'evening');
        }
    }

    // ============================================================
    // DASHBOARD
    // ============================================================
    async function loadDashboard() {
        try {
            const [orders, tests] = await Promise.all([
                CMS.api.list('/lab/lab-orders/').catch(() => []),
                CMS.api.list('/lab/tests/').catch(() => [])
            ]);

            allOrders = orders;
            allTests = tests;

            const pending = orders.filter(o => o.status !== 'COMPLETED');
            const completed = orders.filter(o => o.status === 'COMPLETED');

            const pendingEl = document.getElementById('pendingCount');
            const completedEl = document.getElementById('completedCount');
            const totalEl = document.getElementById('totalTestCount');
            const sidebarPending = document.getElementById('pendingSidebarCount');
            const bannerPending = document.getElementById('bannerPending');
            const bannerCompleted = document.getElementById('bannerCompleted');
            const bannerTotal = document.getElementById('bannerTotal');

            if (pendingEl) pendingEl.textContent = pending.length;
            if (completedEl) completedEl.textContent = completed.length;
            if (totalEl) totalEl.textContent = tests.length || orders.length;
            if (sidebarPending) sidebarPending.textContent = pending.length;
            if (bannerPending) bannerPending.textContent = pending.length;
            if (bannerCompleted) bannerCompleted.textContent = completed.length;
            if (bannerTotal) bannerTotal.textContent = orders.length;
        } catch (err) {
            console.error('Failed to load lab dashboard:', err);
        }
    }

    // ============================================================
    // PENDING LAB ORDERS
    // ============================================================
    async function loadPendingLabOrders() {
        const tbody = document.getElementById('pendingTestsBody');
        if (!tbody) return;

        try {
            const orders = await CMS.api.list('/lab/lab-orders/');
            allOrders = orders;
            const pending = orders.filter(o => o.status !== 'COMPLETED');

            const sidebarPending = document.getElementById('pendingSidebarCount');
            if (sidebarPending) sidebarPending.textContent = pending.length;

            tbody.innerHTML = '';
            if (pending.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;">No pending orders in the queue.</td></tr>';
                return;
            }

            pending.forEach(order => {
                const orderId = order.order_number || `ORD${String(order.id).padStart(5, '0')}`;
                const patientName = order.patient_name || `Patient #${order.patient}`;
                const doctorName = order.doctor ? `Doctor #${order.doctor}` : 'Attending Clinician';
                const testName = order.test_name || `Test #${order.test}`;
                const orderDate = (order.ordered_date || '').slice(0, 10) || '-';

                let statusBadge = '<span class="badge badge-warning">Ordered</span>';
                let actionBtn = `<button type="button" class="btn btn-primary btn-sm" onclick="handleCollectSample(${order.id})">Collect Sample</button>`;

                if (order.status === 'SAMPLE_COLLECTED') {
                    statusBadge = '<span class="badge badge-info">Sample Collected</span>';
                    actionBtn = `<button type="button" class="btn btn-warning btn-sm" onclick="handleStartProcessing(${order.id})">Start Processing</button>`;
                } else if (order.status === 'PROCESSING') {
                    statusBadge = '<span class="badge badge-primary">Processing</span>';
                    actionBtn = `<button type="button" class="btn btn-success btn-sm" onclick="goToResults(${order.id})">Enter Results</button>`;
                }

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${orderId}</strong></td>
                    <td>${patientName}</td>
                    <td>${doctorName}</td>
                    <td>${testName}</td>
                    <td>${orderDate}</td>
                    <td><span class="badge badge-outline">Routine</span></td>
                    <td>${statusBadge}</td>
                    <td>${actionBtn}</td>
                `;
                tbody.appendChild(row);
            });
        } catch (err) {
            console.error('Failed to load pending lab orders:', err);
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;">Failed to load pending orders.</td></tr>';
        }
    }

    window.handleCollectSample = async function (id) {
        try {
            await CMS.api.post(`/lab/lab-orders/${id}/collect_sample/`, {});
            alert('Sample collected successfully.');
            await loadPendingLabOrders();
        } catch (err) {
            console.error('Failed to collect sample:', err);
            alert('Failed to collect sample: ' + (err.message || 'Server error'));
        }
    };

    window.handleStartProcessing = async function (id) {
        try {
            await CMS.api.post(`/lab/lab-orders/${id}/start_processing/`, {});
            alert('Processing started.');
            await loadPendingLabOrders();
        } catch (err) {
            console.error('Failed to start processing:', err);
            alert('Failed to start processing: ' + (err.message || 'Server error'));
        }
    };

    window.goToResults = function (id) {
        window.location.href = `enter-results.html?orderId=${id}`;
    };

    // ============================================================
    // ENTER RESULTS
    // ============================================================
    async function loadEnterResults() {
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get('orderId') || params.get('id');
        if (!orderId) return;

        try {
            const order = await CMS.api.get(`/lab/lab-orders/${orderId}/`);
            if (!order) return;

            const orderIdEl = document.getElementById('orderId');
            const patientNameEl = document.getElementById('patientName');
            const patientIdEl = document.getElementById('patientId');
            const doctorNameEl = document.getElementById('doctorName');
            const testNameEl = document.getElementById('testName');
            const testIdEl = document.getElementById('testId');
            const normalRangeEl = document.getElementById('normalRange');
            const testUnitEl = document.getElementById('testUnit');

            if (orderIdEl) orderIdEl.value = order.order_number || `ORD${String(order.id).padStart(5, '0')}`;
            if (patientNameEl) patientNameEl.value = order.patient_name || `Patient #${order.patient}`;
            if (patientIdEl) patientIdEl.value = order.patient || '-';
            if (doctorNameEl) doctorNameEl.value = order.doctor ? `Doctor #${order.doctor}` : 'Attending Clinician';
            if (testNameEl) testNameEl.value = order.test_name || `Test #${order.test}`;
            if (testIdEl) testIdEl.value = order.test || '-';
            if (normalRangeEl) normalRangeEl.value = 'Normal';
            if (testUnitEl) testUnitEl.value = 'Units';
        } catch (err) {
            console.error('Failed to load order for result entry:', err);
            alert('Failed to load order details: ' + (err.message || 'Server error'));
        }
    }

    window.saveLabResult = async function (e) {
        if (e && e.preventDefault) e.preventDefault();

        const params = new URLSearchParams(window.location.search);
        const orderId = params.get('orderId') || params.get('id');
        if (!orderId) {
            alert('Missing order ID.');
            return;
        }

        const resultVal = document.getElementById('testResult')?.value.trim();
        const remarksVal = document.getElementById('resultRemarks')?.value?.trim() ||
                           document.getElementById('remarks')?.value?.trim() || '';

        if (!resultVal) {
            alert('Please enter a test result value.');
            return;
        }

        try {
            // First submit result record
            await CMS.api.post('/lab/lab-results/', {
                order: parseInt(orderId, 10),
                result_value: resultVal,
                result_status: 'NORMAL',
                remarks: remarksVal
            });

            // Then complete order if it is in PROCESSING state
            try {
                await CMS.api.post(`/lab/lab-orders/${orderId}/complete/`, {});
            } catch (ignore) {
                // Ignore if order already marked completed
            }

            alert('Lab result saved and order marked as completed!');
            window.location.href = 'completed-tests.html';
        } catch (err) {
            console.error('Failed to save lab result:', err);
            alert('Failed to save lab result: ' + (err.message || 'Server error'));
        }
    };

    // ============================================================
    // COMPLETED TESTS
    // ============================================================
    async function loadCompletedTests() {
        const tbody = document.getElementById('completedTestsBody');
        if (!tbody) return;

        try {
            const orders = await CMS.api.list('/lab/lab-orders/?status=COMPLETED');
            const countEl = document.getElementById('completedCount');
            if (countEl) countEl.textContent = orders.length;

            tbody.innerHTML = '';
            if (orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;">No completed tests found.</td></tr>';
                return;
            }

            orders.forEach(order => {
                const orderId = order.order_number || `ORD${String(order.id).padStart(5, '0')}`;
                const patientName = order.patient_name || `Patient #${order.patient}`;
                const testName = order.test_name || `Test #${order.test}`;
                const resultVal = order.result ? order.result.result_value : 'Completed';
                const dateVal = (order.ordered_date || '').slice(0, 10) || '-';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${orderId}</strong></td>
                    <td>${patientName}</td>
                    <td>${testName}</td>
                    <td><strong>${resultVal}</strong></td>
                    <td>Normal</td>
                    <td>Units</td>
                    <td>${dateVal}</td>
                    <td><span class="badge badge-success">Completed</span></td>
                    <td><a href="test-details.html?orderId=${order.id}" class="btn btn-outline btn-sm">View Details</a></td>
                `;
                tbody.appendChild(row);
            });
        } catch (err) {
            console.error('Failed to load completed tests:', err);
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;">Failed to load completed tests.</td></tr>';
        }
    }

    // ============================================================
    // TEST DETAILS
    // ============================================================
    async function loadTestDetails() {
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get('orderId') || params.get('id');
        if (!orderId) return;

        try {
            const order = await CMS.api.get(`/lab/lab-orders/${orderId}/`);
            if (!order) return;

            const orderIdEl = document.getElementById('orderId');
            const patientNameEl = document.getElementById('patientName');
            const patientIdEl = document.getElementById('patientId');
            const doctorNameEl = document.getElementById('doctorName');
            const testNameEl = document.getElementById('testName');
            const testCategoryEl = document.getElementById('testCategory');
            const testResultEl = document.getElementById('testResult');
            const normalRangeEl = document.getElementById('normalRange');
            const testUnitEl = document.getElementById('testUnit');
            const testStatusEl = document.getElementById('testStatus');

            if (orderIdEl) orderIdEl.value = order.order_number || `ORD${String(order.id).padStart(5, '0')}`;
            if (patientNameEl) patientNameEl.value = order.patient_name || `Patient #${order.patient}`;
            if (patientIdEl) patientIdEl.value = order.patient || '-';
            if (doctorNameEl) doctorNameEl.value = order.doctor ? `Doctor #${order.doctor}` : 'Attending Clinician';
            if (testNameEl) testNameEl.value = order.test_name || `Test #${order.test}`;
            if (testCategoryEl) testCategoryEl.value = 'Clinical Diagnostics';
            if (testResultEl) testResultEl.value = order.result ? order.result.result_value : 'Pending';
            if (normalRangeEl) normalRangeEl.value = 'Normal';
            if (testUnitEl) testUnitEl.value = 'Units';
            if (testStatusEl) testStatusEl.value = order.status;
        } catch (err) {
            console.error('Failed to load test details:', err);
        }
    }

    // ============================================================
    // LAB BILLING
    // ============================================================
    let selectedInvoiceForPayment = null;

    async function loadLabBilling() {
        const select = document.getElementById('labOrderSelect');
        const form = document.getElementById('labBillingForm');

        try {
            const [orders, invoices] = await Promise.all([
                CMS.api.list('/lab/lab-orders/?status=COMPLETED').catch(() => []),
                CMS.api.list('/lab/invoices/').catch(() => [])
            ]);

            allOrders = orders;
            allInvoices = invoices;

            if (select) {
                select.innerHTML = '<option value="">— Select Completed Lab Order —</option>';
                orders.forEach(order => {
                    const opt = document.createElement('option');
                    opt.value = order.id;
                    opt.textContent = `${order.order_number || ('ORD' + order.id)} — ${order.patient_name || ('Patient #' + order.patient)} — ${order.test_name || 'Test'}`;
                    select.appendChild(opt);
                });

                select.addEventListener('change', () => {
                    const selectedId = parseInt(select.value, 10);
                    const selectedOrder = orders.find(o => o.id === selectedId);
                    if (selectedOrder) {
                        const patEl = document.getElementById('labBillingPatientName');
                        const docEl = document.getElementById('labBillingDoctorName');
                        const testEl = document.getElementById('labBillingTestName');
                        const priceEl = document.getElementById('labBillingUnitPrice');
                        const amountEl = document.getElementById('labBillingAmount');
                        const totalEl = document.getElementById('labBillingTotal');

                        if (patEl) patEl.value = selectedOrder.patient_name || `Patient #${selectedOrder.patient}`;
                        if (docEl) docEl.value = selectedOrder.doctor ? `Doctor #${selectedOrder.doctor}` : 'Attending Clinician';
                        if (testEl) testEl.value = selectedOrder.test_name || `Test #${selectedOrder.test}`;
                        if (priceEl) priceEl.value = '350.00';
                        if (amountEl) amountEl.value = '350.00';
                        if (totalEl) totalEl.value = '350.00';
                    }
                });
            }

            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const orderId = select?.value;
                    const amount = parseFloat(document.getElementById('labBillingAmount')?.value) || 350;
                    const discount = parseFloat(document.getElementById('labBillingDiscount')?.value) || 0;

                    if (!orderId) {
                        alert('Please select a completed lab order.');
                        return;
                    }

                    try {
                        const inv = await CMS.api.post('/lab/invoices/', {
                            lab_order: parseInt(orderId, 10),
                            amount: amount,
                            discount: discount
                        });
                        alert('Lab invoice generated successfully: ' + (inv.invoice_number || inv.id));
                        form.reset();
                        await loadLabBilling();
                    } catch (err) {
                        console.error('Failed to create lab invoice:', err);
                        alert('Failed to generate invoice: ' + (err.message || 'Server error'));
                    }
                });
            }

            renderBillingHistory(invoices);
        } catch (err) {
            console.error('Failed to load lab billing:', err);
        }
    }

    function renderBillingHistory(invoices) {
        const table = document.getElementById('labBillingTable') || document.getElementById('billingTable');
        if (!table) return;
        const tbody = table.querySelector('tbody') || document.getElementById('labBillingBody');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (invoices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted);">No lab invoices generated yet.</td></tr>';
            return;
        }

        invoices.forEach(inv => {
            const isPaid = inv.status === 'PAID';
            const statusBadge = isPaid
                ? '<span class="badge badge-success">Paid</span>'
                : '<span class="badge badge-warning">Unpaid</span>';
            const dateStr = (inv.created_at || '').slice(0, 10) || '-';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${inv.invoice_number || ('LINV' + inv.id)}</strong></td>
                <td>${inv.patient_name || ('Patient #' + inv.patient)}</td>
                <td>${inv.test_name || 'Lab Investigation'}</td>
                <td>₹${parseFloat(inv.total_amount || inv.amount || 0).toFixed(2)}</td>
                <td>${statusBadge}</td>
                <td>${dateStr}</td>
                <td style="white-space:nowrap;">
                    ${!isPaid ? `<button type="button" class="btn btn-primary btn-sm pay-btn" style="margin-right:6px;">💳 Pay</button>` : ''}
                    <button type="button" class="btn btn-outline btn-sm print-btn">🖨 Print</button>
                </td>
            `;

            if (!isPaid) {
                row.querySelector('.pay-btn')?.addEventListener('click', () => {
                    showInlinePayment(inv);
                });
            }

            row.querySelector('.print-btn')?.addEventListener('click', () => {
                window.print();
            });

            tbody.appendChild(row);
        });
    }

    function showInlinePayment(inv) {
        selectedInvoiceForPayment = inv;
        const panel = document.getElementById('paymentPanel');
        const summary = document.getElementById('paymentBillSummary');
        const info = document.getElementById('paymentBillInfo');

        if (panel) panel.style.display = 'block';
        if (summary) summary.style.display = 'block';
        if (info) {
            info.textContent = `${inv.invoice_number || ('LINV' + inv.id)} — ${inv.patient_name || 'Patient'} — ₹${parseFloat(inv.total_amount || inv.amount || 0).toFixed(2)}`;
        }
        window.scrollTo({ top: panel?.offsetTop - 50, behavior: 'smooth' });
    }

    window.processLabBillPayment = async function () {
        if (!selectedInvoiceForPayment) {
            alert('Please select an invoice to pay from the list.');
            return;
        }

        const method = document.getElementById('paymentMethod')?.value;
        const ref = document.getElementById('paymentReference')?.value.trim();

        if (!method) {
            alert('Please select a payment method.');
            return;
        }

        const totalAmount = parseFloat(selectedInvoiceForPayment.total_amount || selectedInvoiceForPayment.amount || 0);

        try {
            await CMS.api.post('/lab/payments/', {
                invoice: selectedInvoiceForPayment.id,
                amount: totalAmount,
                payment_method: method.toUpperCase(),
                transaction_id: ref || undefined
            });

            alert('Payment recorded successfully! Invoice marked as Paid.');
            selectedInvoiceForPayment = null;
            const panel = document.getElementById('paymentPanel');
            if (panel) panel.style.display = 'none';
            await loadLabBilling();
        } catch (err) {
            console.error('Failed to process lab payment:', err);
            alert('Failed to process payment: ' + (err.message || 'Server error'));
        }
    };
})();