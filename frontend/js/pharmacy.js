// ============================================================
// CMS - PHARMACY MODULE
// File: js/pharmacy.js
// ============================================================

(function () {
    'use strict';

    let allPrescriptions = [];
    let allDispenses = [];
    let allStocks = [];
    let allMedicines = [];
    let allInvoices = [];
    let selectedInvoiceForPayment = null;

    document.addEventListener('DOMContentLoaded', async () => {
        const user = CMS.requireRole(['pharmacist', 'pharmacy', 'admin']);
        if (!user) return;

        initCommonPharmacyUI(user);

        if (document.getElementById('totalMedicines') || document.getElementById('pendingPrescriptions') || document.getElementById('lowStockAlerts')) {
            await updateDashboard();
        }

        if (document.getElementById('prescriptionTableBody') || document.getElementById('prescriptionQueueTable') || document.getElementById('queueTable')) {
            await loadPrescriptionQueue();
        }

        if (document.getElementById('detailRxNumber') || window.location.pathname.includes('prescription-details')) {
            await loadPrescriptionDetails();
        }

        if (document.getElementById('inventoryTableBody') || document.getElementById('inventoryTable')) {
            await loadInventory();
        }

        if (document.getElementById('stockTableBody') || document.getElementById('stockTable')) {
            await loadStock();
        }

        if (document.getElementById('billingHistoryTable') || document.getElementById('pharmacyBillingBody') || document.getElementById('billingHistoryBody') || document.getElementById('billingTable')) {
            await loadPharmacyBilling();
        }
    });

    function initCommonPharmacyUI(user) {
        const topbarName = document.getElementById('topbarName');
        const welcomeName = document.getElementById('welcomeName');
        const topbarDate = document.getElementById('topbarDate');
        const timeOfDay = document.getElementById('timeOfDay');

        const displayName = user.full_name || user.username || 'Pharmacist';
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
    async function updateDashboard() {
        try {
            const [meds, stocks, rxs, dispenses, invoices] = await Promise.all([
                CMS.api.list('/pharmacy/medicines/').catch(() => []),
                CMS.api.list('/pharmacy/stock/').catch(() => []),
                CMS.api.list('/pharmacy/prescriptions/').catch(() => []),
                CMS.api.list('/pharmacy/dispenses/').catch(() => []),
                CMS.api.list('/pharmacy/invoices/').catch(() => [])
            ]);

            allMedicines = meds;
            allStocks = stocks;
            allPrescriptions = rxs;
            allDispenses = dispenses;
            allInvoices = invoices;

            const dispensedIds = new Set(dispenses.filter(d => d.status === 'DISPENSED').map(d => d.prescription));
            const pendingRxs = rxs.filter(r => !dispensedIds.has(r.id));
            const lowStock = stocks.filter(s => s.quantity <= 10);

            const totalMedsEl = document.getElementById('totalMedicines');
            const pendingRxEl = document.getElementById('pendingPrescriptions');
            const lowStockEl = document.getElementById('lowStockAlerts');
            const todayRxEl = document.getElementById('todayPrescriptions');
            const bannerPending = document.getElementById('bannerPending');
            const bannerCompleted = document.getElementById('bannerCompleted');
            const bannerTotal = document.getElementById('bannerTotal');

            if (totalMedsEl) totalMedsEl.textContent = meds.length;
            if (pendingRxEl) pendingRxEl.textContent = pendingRxs.length;
            if (lowStockEl) lowStockEl.textContent = lowStock.length;
            if (todayRxEl) todayRxEl.textContent = rxs.length;
            if (bannerPending) bannerPending.textContent = pendingRxs.length;
            if (bannerCompleted) bannerCompleted.textContent = dispensedIds.size;
            if (bannerTotal) bannerTotal.textContent = meds.length;
        } catch (err) {
            console.error('Failed to load pharmacy dashboard:', err);
        }
    }

    // ============================================================
    // PRESCRIPTION QUEUE
    // ============================================================
    async function loadPrescriptionQueue() {
        const table = document.getElementById('prescriptionTableBody') ||
                      document.getElementById('prescriptionQueueTable')?.querySelector('tbody') ||
                      document.getElementById('queueTable')?.querySelector('tbody');
        if (!table) return;

        try {
            const [rxs, dispenses] = await Promise.all([
                CMS.api.list('/pharmacy/prescriptions/').catch(() => []),
                CMS.api.list('/pharmacy/dispenses/').catch(() => [])
            ]);

            allPrescriptions = rxs;
            allDispenses = dispenses;

            const dispensedMap = new Map();
            dispenses.forEach(d => {
                if (d.status === 'DISPENSED') dispensedMap.set(d.prescription, d);
            });

            table.innerHTML = '';
            if (rxs.length === 0) {
                table.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;">No prescriptions in the queue.</td></tr>';
                return;
            }

            rxs.forEach(rx => {
                const rxNumber = rx.prescription_number || `RX${String(rx.id).padStart(5, '0')}`;
                const patientName = rx.patient_name || `Patient #${rx.patient}`;
                const doctorName = rx.doctor_name || `Doctor #${rx.doctor}`;
                const dateStr = (rx.prescription_date || '').slice(0, 10) || '-';
                const itemsCount = (rx.items || []).length;
                const isDispensed = dispensedMap.has(rx.id);

                const statusBadge = isDispensed
                    ? '<span class="badge badge-success">Dispensed</span>'
                    : '<span class="badge badge-warning">Pending</span>';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${rxNumber}</strong></td>
                    <td>${patientName}</td>
                    <td>${doctorName}</td>
                    <td>${dateStr}</td>
                    <td>${itemsCount} item(s)</td>
                    <td>${statusBadge}</td>
                    <td>
                        <a href="prescription-details.html?rxId=${rx.id}" class="btn btn-primary btn-sm">
                            ${isDispensed ? 'View Details' : 'View & Dispense'}
                        </a>
                    </td>
                `;
                table.appendChild(row);
            });
        } catch (err) {
            console.error('Failed to load prescription queue:', err);
            table.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;">Failed to load prescriptions.</td></tr>';
        }
    }

    // ============================================================
    // PRESCRIPTION DETAILS & DISPENSING
    // ============================================================
    async function loadPrescriptionDetails() {
        const params = new URLSearchParams(window.location.search);
        const rxId = params.get('rxId') || params.get('prescriptionId') || params.get('id');
        if (!rxId) return;

        try {
            const [rx, dispenses, stocks] = await Promise.all([
                CMS.api.get(`/pharmacy/prescriptions/${rxId}/`),
                CMS.api.list(`/pharmacy/dispenses/?prescription=${rxId}`).catch(() => []),
                CMS.api.list('/pharmacy/stock/').catch(() => [])
            ]);

            allStocks = stocks;

            const rxNumEl = document.getElementById('detailRxNumber') || document.getElementById('rxNumber');
            const patientNameEl = document.getElementById('detailPatientName') || document.getElementById('patientName');
            const doctorNameEl = document.getElementById('detailDoctorName') || document.getElementById('doctorName');
            const dateEl = document.getElementById('detailDate') || document.getElementById('rxDate');
            const notesEl = document.getElementById('detailNotes') || document.getElementById('rxNotes');
            const itemsTable = document.getElementById('detailItemsBody') ||
                               document.getElementById('prescriptionItemsBody') ||
                               document.getElementById('itemsTable')?.querySelector('tbody');

            if (rxNumEl) rxNumEl.textContent = rx.prescription_number || `RX${String(rx.id).padStart(5, '0')}`;
            if (patientNameEl) patientNameEl.textContent = rx.patient_name || `Patient #${rx.patient}`;
            if (doctorNameEl) doctorNameEl.textContent = rx.doctor_name || `Doctor #${rx.doctor}`;
            if (dateEl) dateEl.textContent = (rx.prescription_date || '').slice(0, 10);
            if (notesEl) notesEl.textContent = rx.notes || 'None';

            if (itemsTable) {
                itemsTable.innerHTML = '';
                (rx.items || []).forEach(item => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><strong>${item.medicine_name || ('Medicine #' + item.medicine)}</strong></td>
                        <td>${item.dosage_name || '-'}</td>
                        <td>${item.frequency || '1-0-1'}</td>
                        <td>${item.duration || '5 days'}</td>
                        <td>${item.quantity || 10}</td>
                        <td>${item.instructions || 'After meals'}</td>
                    `;
                    itemsTable.appendChild(row);
                });
            }

            const isAlreadyDispensed = dispenses.some(d => d.status === 'DISPENSED');
            const dispenseBtn = document.getElementById('dispenseButton') || document.getElementById('btnDispense');
            if (dispenseBtn) {
                if (isAlreadyDispensed) {
                    dispenseBtn.disabled = true;
                    dispenseBtn.textContent = 'Already Dispensed';
                    dispenseBtn.className = 'btn btn-secondary';
                } else {
                    dispenseBtn.disabled = false;
                    dispenseBtn.textContent = '💊 Dispense Medicines';
                    dispenseBtn.onclick = () => dispensePrescription(rx);
                }
            }
        } catch (err) {
            console.error('Failed to load prescription details:', err);
        }
    }

    async function dispensePrescription(rx) {
        if (!confirm(`Confirm dispensing medicines for prescription ${rx.prescription_number || rx.id}? This will deduct inventory.`)) {
            return;
        }

        try {
            // 1. Create a dispense record in PENDING state
            const dispense = await CMS.api.post('/pharmacy/dispenses/', {
                prescription: rx.id
            });

            // 2. Add each item from prescription into dispense-items
            for (const item of (rx.items || [])) {
                const stockItem = allStocks.find(s => s.medicine === item.medicine);
                const unitPrice = stockItem ? parseFloat(stockItem.selling_price) : 10.0;
                await CMS.api.post('/pharmacy/dispense-items/', {
                    dispense: dispense.id,
                    medicine: item.medicine,
                    quantity: item.quantity || 10,
                    unit_price: unitPrice
                });
            }

            // 3. Complete the dispense which automatically validates and deducts stock in MySQL
            await CMS.api.post(`/pharmacy/dispenses/${dispense.id}/dispense/`, {});

            // 4. Generate invoice automatically for this dispense
            let invoice = null;
            try {
                invoice = await CMS.api.post('/pharmacy/invoices/', {
                    dispense: dispense.id,
                    discount: 0,
                    tax: 0
                });
            } catch (invErr) {
                console.warn('Invoice auto-creation note:', invErr);
            }

            alert('Prescription successfully dispensed and stock deducted!');
            if (invoice) {
                window.location.href = `pharmacy-billing.html?invoiceId=${invoice.id}`;
            } else {
                window.location.href = 'prescription-queue.html';
            }
        } catch (err) {
            console.error('Failed to dispense prescription:', err);
            alert('Failed to dispense: ' + (err.message || 'Check stock levels and try again.'));
        }
    }

    // ============================================================
    // MEDICINE INVENTORY
    // ============================================================
    async function loadInventory() {
        const table = document.getElementById('inventoryTableBody') ||
                      document.getElementById('inventoryTable')?.querySelector('tbody');
        if (!table) return;

        try {
            const [meds, stocks] = await Promise.all([
                CMS.api.list('/pharmacy/medicines/').catch(() => []),
                CMS.api.list('/pharmacy/stock/').catch(() => [])
            ]);

            allMedicines = meds;
            allStocks = stocks;

            table.innerHTML = '';
            if (meds.length === 0) {
                table.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;">No medicines in catalog.</td></tr>';
                return;
            }

            meds.forEach(med => {
                const stock = stocks.find(s => s.medicine === med.id) || {};
                const qty = stock.quantity ?? 0;
                const price = stock.selling_price ? `₹${parseFloat(stock.selling_price).toFixed(2)}` : '₹0.00';
                const statusBadge = med.is_active
                    ? '<span class="badge badge-success">Active</span>'
                    : '<span class="badge badge-warning">Inactive</span>';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>MED${String(med.id).padStart(3, '0')}</strong></td>
                    <td>${med.medicine_name}</td>
                    <td>${med.category || 'General'}</td>
                    <td>${med.unit || 'Unit'}</td>
                    <td>${qty}</td>
                    <td>${price}</td>
                    <td>${statusBadge}</td>
                `;
                table.appendChild(row);
            });
        } catch (err) {
            console.error('Failed to load inventory:', err);
            table.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;">Failed to load inventory.</td></tr>';
        }
    }

    // ============================================================
    // STOCK LEVELS
    // ============================================================
    async function loadStock() {
        const table = document.getElementById('stockTableBody') ||
                      document.getElementById('stockTable')?.querySelector('tbody');
        if (!table) return;

        try {
            const stocks = await CMS.api.list('/pharmacy/stock/');
            allStocks = stocks;

            table.innerHTML = '';
            if (stocks.length === 0) {
                table.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;">No stock records found.</td></tr>';
                return;
            }

            stocks.forEach(s => {
                const isLow = s.quantity <= 10;
                const statusBadge = isLow
                    ? '<span class="badge badge-danger">Low Stock</span>'
                    : '<span class="badge badge-success">In Stock</span>';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${s.batch_number || ('BATCH' + s.id)}</strong></td>
                    <td>${s.medicine_name || ('Medicine #' + s.medicine)}</td>
                    <td><strong>${s.quantity}</strong></td>
                    <td>₹${parseFloat(s.selling_price || 0).toFixed(2)}</td>
                    <td>${s.expiry_date || '-'}</td>
                    <td>${statusBadge}</td>
                `;
                table.appendChild(row);
            });
        } catch (err) {
            console.error('Failed to load stock:', err);
            table.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;">Failed to load stock.</td></tr>';
        }
    }

    // ============================================================
    // PHARMACY BILLING & PAYMENT
    // ============================================================
    async function loadPharmacyBilling() {
        const table = document.getElementById('billingHistoryTable') ||
                      document.getElementById('billingTable') ||
                      document.getElementById('pharmacyBillingTable');
        const tbody = document.getElementById('pharmacyBillingBody') ||
                      document.getElementById('billingHistoryBody') ||
                      table?.querySelector('tbody');

        try {
            const invoices = await CMS.api.list('/pharmacy/invoices/');
            allInvoices = invoices;

            if (!tbody) return;
            tbody.innerHTML = '';

            if (invoices.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">No pharmacy invoices generated yet.</td></tr>';
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
                    <td><strong>${inv.invoice_number || ('PINV' + inv.id)}</strong></td>
                    <td>${inv.patient_name || ('Patient #' + inv.patient)}</td>
                    <td>Dispense #${inv.dispense}</td>
                    <td>₹${parseFloat(inv.total_amount || 0).toFixed(2)}</td>
                    <td>${statusBadge}</td>
                    <td>${dateStr}</td>
                    <td style="white-space:nowrap;">
                        ${!isPaid ? `<button type="button" class="btn btn-primary btn-sm pay-btn" style="margin-right:6px;">💳 Pay</button>` : ''}
                        <button type="button" class="btn btn-outline btn-sm print-btn">🖨 Print</button>
                    </td>
                `;

                if (!isPaid) {
                    row.querySelector('.pay-btn')?.addEventListener('click', () => {
                        showInlinePharmacyPayment(inv);
                    });
                }

                row.querySelector('.print-btn')?.addEventListener('click', () => {
                    window.print();
                });

                tbody.appendChild(row);
            });
        } catch (err) {
            console.error('Failed to load pharmacy billing:', err);
        }
    }

    function showInlinePharmacyPayment(inv) {
        selectedInvoiceForPayment = inv;
        const panel = document.getElementById('paymentPanel');
        const summary = document.getElementById('paymentBillSummary');
        const info = document.getElementById('paymentBillInfo');

        if (panel) panel.style.display = 'block';
        if (summary) summary.style.display = 'block';
        if (info) {
            info.textContent = `${inv.invoice_number || ('PINV' + inv.id)} — ${inv.patient_name || 'Patient'} — ₹${parseFloat(inv.total_amount || 0).toFixed(2)}`;
        }
        window.scrollTo({ top: panel?.offsetTop - 50, behavior: 'smooth' });
    }

    window.processPharmacyBillPayment = async function () {
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

        const totalAmount = parseFloat(selectedInvoiceForPayment.total_amount || 0);

        try {
            await CMS.api.post('/pharmacy/payments/', {
                invoice: selectedInvoiceForPayment.id,
                amount: totalAmount,
                payment_method: method.toUpperCase(),
                transaction_id: ref || undefined
            });

            alert('Payment recorded successfully! Invoice marked as Paid.');
            selectedInvoiceForPayment = null;
            const panel = document.getElementById('paymentPanel');
            if (panel) panel.style.display = 'none';
            await loadPharmacyBilling();
        } catch (err) {
            console.error('Failed to process pharmacy payment:', err);
            alert('Failed to process payment: ' + (err.message || 'Server error'));
        }
    };
})();