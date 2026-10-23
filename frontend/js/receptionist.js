// ============================================================
// CMS - RECEPTIONIST MODULE JAVASCRIPT
// File: js/receptionist.js
// Handles all Receptionist desk operations connected directly
// to the Django REST Framework API against local MySQL.
// Zero mock/seed data. Authoritative server state.
// ============================================================

(function () {
    // ------------------------------------------------------------
    // Shared State & Helpers
    // ------------------------------------------------------------
    const user = CMS.requireRole(['receptionist', 'admin']);
    if (!user) return;

    function getToday() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const TODAY = getToday();

    const AVATAR_COLOURS = [
        '#9C6B5D', '#7e5249', '#5c3a32', '#2980b9', '#27ae60',
        '#d68910', '#8e44ad', '#c0392b', '#16a085', '#2c3e50'
    ];

    function avatarColor(id) {
        const n = String(id || '').replace(/\D/g, '');
        return AVATAR_COLOURS[parseInt(n || '0', 10) % AVATAR_COLOURS.length];
    }

    function initials_(name) {
        return (name || '?').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
    }

    function esc(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function showToast(msg, type = 'info') {
        const icons = { success: '✅', danger: '⚠️', warning: '⚠️', info: 'ℹ️' };
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${esc(msg)}</span>`;
        container.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateX(24px)';
            el.style.transition = 'all .3s ease';
            setTimeout(() => el.remove(), 300);
        }, 3200);
    }

    function openSidebar() {
        const sb = document.getElementById('sidebar');
        const ov = document.getElementById('sidebarOverlay');
        if (sb) sb.classList.add('open');
        if (ov) ov.classList.add('open');
    }

    function closeSidebar() {
        const sb = document.getElementById('sidebar');
        const ov = document.getElementById('sidebarOverlay');
        if (sb) sb.classList.remove('open');
        if (ov) ov.classList.remove('open');
    }

    function logout() {
        if (!confirm('Are you sure you want to logout?')) return;
        CMS.session.clear();
        window.location.href = '../index.html';
    }

    function initHeaderAndSidebar() {
        const name = user.full_name || user.username || 'Receptionist';
        const inits = initials_(name);
        ['sidebarAvatar', 'topbarAvatar'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = inits;
        });
        ['sidebarName', 'topbarName'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = name;
        });
        const welcomeEl = document.getElementById('welcomeName');
        if (welcomeEl) welcomeEl.textContent = `Welcome back, ${name}!`;

        const dateEl = document.getElementById('topbarDate');
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString('en-IN', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
        }
        const timeOfDayEl = document.getElementById('timeOfDay');
        if (timeOfDayEl) {
            const hr = new Date().getHours();
            timeOfDayEl.textContent = hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening';
        }
    }

    function animateCount(id, target) {
        const el = document.getElementById(id);
        if (!el) return;
        let cur = 0;
        const step = Math.ceil(target / 20) || 1;
        const t = setInterval(() => {
            cur = Math.min(cur + step, target);
            el.textContent = cur;
            if (cur >= target) clearInterval(t);
        }, 30);
    }

    function calcAge(dob) {
        if (!dob) return '—';
        const diff = Date.now() - new Date(dob).getTime();
        if (isNaN(diff) || diff < 0) return '—';
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    }

    function apptStatusClass(status) {
        return {
            'Booked': 'badge-info',
            'Confirmed': 'badge-primary',
            'Arrived': 'badge-warning',
            'Waiting': 'badge-warning',
            'In Progress': 'badge-primary',
            'Completed': 'badge-success',
            'Cancelled': 'badge-danger',
        }[status] || 'badge-neutral';
    }

    // Expose helpers on window so inline onclick handlers continue to work smoothly
    window.openSidebar = openSidebar;
    window.closeSidebar = closeSidebar;
    window.logout = logout;
    window.showToast = showToast;
    window.avatarColor = avatarColor;
    window.initials_ = initials_;
    window.esc = esc;
    window.calcAge = calcAge;
    window.TODAY = TODAY;

    // ============================================================
    // 1. DASHBOARD PAGE
    // ============================================================
    let dashAppointments = [];
    let dashTokens = [];
    let dashPatients = [];
    let dashInvoices = [];
    let apptSearchQ = '';
    let apptStatusQ = '';

    async function initDashboard() {
        initHeaderAndSidebar();
        await dashLoadData();
    }

    async function dashLoadData() {
        try {
            const [apptsRes, tokensRes, patientsRes, invRes] = await Promise.all([
                CMS.api.list(`/receptionist/appointments/?date=${TODAY}`),
                CMS.api.list(`/receptionist/tokens/?date=${TODAY}`),
                CMS.api.list('/receptionist/patients/'),
                CMS.api.list('/receptionist/consultation-invoices/')
            ]);

            dashAppointments = (apptsRes || []).map(CMSAdapters.adaptAppointment);
            dashTokens = (tokensRes || []).map(CMSAdapters.adaptToken);
            dashPatients = (patientsRes || []).map(CMSAdapters.adaptPatient);
            dashInvoices = (invRes || []).map(CMSAdapters.adaptInvoice);

            updateDashStats();
            renderDashApptTable();
            renderDashQueuePanel();
            renderDashStatusBreakdown();
            renderDashRecentPatients();
            renderDashActivityFeed();
        } catch (err) {
            console.error('Error loading receptionist dashboard data:', err);
            showToast('Failed to load dashboard data from server', 'danger');
        }
    }

    function updateDashStats() {
        const total = dashAppointments.length;
        const waiting = dashTokens.filter(t => t.rawStatus === 'WAITING' || t.status === 'Waiting').length;
        const completed = dashAppointments.filter(a => a.status === 'Completed').length;
        const unpaid = dashInvoices.filter(i => i.status === 'Unpaid' || i.rawStatus === 'PENDING').length;
        const todayPatients = dashPatients.filter(p => p.registeredOn === TODAY).length;

        animateCount('statAppts', total);
        animateCount('statWaiting', waiting);
        animateCount('statPatients', dashPatients.length);
        animateCount('statBilling', unpaid);

        const todayRegEl = document.getElementById('statTodayRegistered');
        if (todayRegEl) todayRegEl.textContent = `${todayPatients} new today`;

        const bTot = document.getElementById('bannerTotal');
        const bWait = document.getElementById('bannerWaiting');
        const bDone = document.getElementById('bannerDone');
        if (bTot) bTot.textContent = total;
        if (bWait) bWait.textContent = waiting;
        if (bDone) bDone.textContent = completed;

        const badgeAppt = document.getElementById('sidebarApptBadge');
        const badgeQueue = document.getElementById('sidebarQueueBadge');
        if (badgeAppt) badgeAppt.textContent = total;
        if (badgeQueue) badgeQueue.textContent = waiting;
    }

    function filterApptTable(searchVal) {
        apptSearchQ = (searchVal || '').trim().toLowerCase();
        const filterSelect = document.getElementById('apptStatusFilter');
        apptStatusQ = filterSelect ? filterSelect.value : '';
        renderDashApptTable();
    }

    function renderDashApptTable() {
        let data = [...dashAppointments];
        if (apptSearchQ) {
            data = data.filter(a => a.patientName.toLowerCase().includes(apptSearchQ) || (a.patientId && a.patientId.toLowerCase().includes(apptSearchQ)));
        }
        if (apptStatusQ) {
            data = data.filter(a => a.status === apptStatusQ);
        }

        const shown = data.slice(0, 8);
        const tbody = document.getElementById('apptTableBody');
        const countEl = document.getElementById('apptTableCount');
        const infoEl = document.getElementById('apptTableInfo');

        if (countEl) countEl.textContent = `${data.length} records`;
        if (infoEl) infoEl.textContent = `Showing ${shown.length} of ${data.length} appointments today`;

        if (!tbody) return;

        if (shown.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6">
                <div class="table-empty">
                    <div class="table-empty-icon">📭</div>
                    <div class="table-empty-title">No appointments found</div>
                    <div class="table-empty-desc">No appointments scheduled for today matching your search.</div>
                </div>
            </td></tr>`;
            return;
        }

        tbody.innerHTML = shown.map(a => {
            const statusClass = apptStatusClass(a.status);
            const tokenBadge = a.token ? String(a.token).padStart(2, '0') : '—';
            let actions = '';

            if (a.status === 'Booked') {
                actions += `<button class="action-btn approve" title="Confirm Arrival & Issue Token" onclick="receptionistConfirmArrival(${a.rawId})">📍</button>`;
            } else if (a.status === 'Confirmed' || a.status === 'Waiting') {
                actions += `<span style="font-size:var(--text-xs);font-weight:600;color:var(--accent);">Token #${tokenBadge}</span>`;
            }

            if (a.status !== 'Completed' && a.status !== 'Cancelled') {
                actions += `<button class="action-btn delete" title="Cancel Appointment" onclick="receptionistCancelAppt(${a.rawId}, '${esc(a.patientName)}')">✕</button>`;
            }

            return `
            <tr>
                <td>
                    <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-xs);background:var(--clr-blush);color:var(--accent);font-weight:700;font-size:var(--text-xs);">
                        ${tokenBadge}
                    </span>
                </td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div class="avatar avatar-sm" style="background:${avatarColor(a.patientId)};flex-shrink:0;">
                            ${initials_(a.patientName)}
                        </div>
                        <div>
                            <div class="td-primary" style="font-size:var(--text-sm);">${esc(a.patientName)}</div>
                            <div style="font-size:var(--text-xs);color:var(--text-muted);">${esc(a.patientId)}</div>
                        </div>
                    </div>
                </td>
                <td style="font-weight:600;font-size:var(--text-sm);white-space:nowrap;">${esc(a.time)}</td>
                <td style="font-size:var(--text-xs);color:var(--text-secondary);">${esc(a.doctor)}</td>
                <td><span class="badge ${statusClass}">${esc(a.status)}</span></td>
                <td class="td-actions">
                    <div class="td-actions-group">
                        ${actions}
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    async function receptionistConfirmArrival(apptId) {
        try {
            const res = await CMS.api.post(`/receptionist/appointments/${apptId}/check_in/`, {});
            showToast('Patient checked in! Token issued successfully.', 'success');
            await dashLoadData();
        } catch (err) {
            console.error('Check-in error:', err);
            showToast(err.message || 'Failed to check in appointment', 'danger');
        }
    }

    async function receptionistCancelAppt(apptId, patientName) {
        if (!confirm(`Cancel appointment for ${patientName}?`)) return;
        try {
            await CMS.api.post(`/receptionist/appointments/${apptId}/cancel/`, {});
            showToast(`Appointment for ${patientName} cancelled`, 'info');
            await dashLoadData();
        } catch (err) {
            console.error('Cancel appointment error:', err);
            showToast(err.message || 'Failed to cancel appointment', 'danger');
        }
    }

    function renderDashQueuePanel() {
        const calledToken = dashTokens.find(t => t.rawStatus === 'CALLED');
        const waitingTokens = dashTokens.filter(t => t.rawStatus === 'WAITING').sort((a, b) => a.token - b.token);

        const nowServingNum = document.getElementById('nowServingNum');
        const nowServingName = document.getElementById('nowServingName');
        const nowServingInfo = document.getElementById('nowServingInfo');
        const queueFooter = document.getElementById('queueFooter');

        if (nowServingNum) nowServingNum.textContent = calledToken ? String(calledToken.token).padStart(2, '0') : '—';
        if (nowServingName) nowServingName.textContent = calledToken ? calledToken.patientName : 'No active patient';
        if (nowServingInfo) nowServingInfo.textContent = calledToken ? calledToken.doctorName : 'Click "Call Next" to begin';
        if (queueFooter) queueFooter.textContent = `${waitingTokens.length} waiting`;

        const queueEl = document.getElementById('dashQueueList');
        if (!queueEl) return;

        if (waitingTokens.length === 0) {
            queueEl.innerHTML = `<div style="padding:16px;text-align:center;font-size:var(--text-sm);color:var(--text-muted);">
                Queue is empty 🎉</div>`;
            return;
        }

        queueEl.innerHTML = waitingTokens.slice(0, 5).map((t, i) => `
            <div class="token-queue-item" style="${i === 0 ? 'background:var(--accent-light);' : ''}">
                <div class="token-num-badge" style="${i === 0 ? 'background:var(--accent);color:#fff;' : ''}">
                    ${String(t.token).padStart(2, '0')}
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:var(--text-sm);font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${esc(t.patientName)}
                    </div>
                    <div style="font-size:var(--text-xs);color:var(--text-muted);">${esc(t.doctorName)}</div>
                </div>
                <span class="badge badge-warning" style="font-size:10px;">Waiting</span>
            </div>
        `).join('');
    }

    async function callNextToken() {
        const nextWaiting = dashTokens.filter(t => t.rawStatus === 'WAITING').sort((a, b) => a.token - b.token)[0];
        if (!nextWaiting) {
            showToast('No more patients waiting in queue 🎉', 'info');
            return;
        }
        try {
            await CMS.api.post(`/receptionist/tokens/${nextWaiting.rawId}/call_next/`, {});
            showToast(`Token #${String(nextWaiting.token).padStart(2, '0')} called for ${nextWaiting.patientName}`, 'success');
            await dashLoadData();
        } catch (err) {
            console.error('Call next error:', err);
            showToast(err.message || 'Failed to call token', 'danger');
        }
    }

    function renderDashStatusBreakdown() {
        const container = document.getElementById('statusBreakdown');
        if (!container) return;

        const statuses = ['Booked', 'Confirmed', 'Completed', 'Cancelled'];
        const total = dashAppointments.length || 1;
        const colours = {
            Booked: 'var(--info)',
            Confirmed: 'var(--accent)',
            Completed: 'var(--success)',
            Cancelled: 'var(--danger)'
        };

        const html = statuses.map(s => {
            const cnt = dashAppointments.filter(a => a.status === s).length;
            if (cnt === 0) return '';
            const pct = Math.round((cnt / total) * 100);
            return `
                <div class="progress-bar-item">
                    <div class="progress-bar-label">
                        <span class="progress-bar-name">${s}</span>
                        <span class="progress-bar-value">${cnt}</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill" style="width:${pct}%;background:${colours[s]};"></div>
                    </div>
                </div>`;
        }).filter(Boolean).join('');

        container.innerHTML = html || '<div style="color:var(--text-muted);font-size:var(--text-xs);text-align:center;padding:12px;">No appointment data today</div>';
    }

    function renderDashRecentPatients() {
        const el = document.getElementById('recentPatientsList');
        if (!el) return;

        const recent = [...dashPatients].slice(0, 5);
        if (recent.length === 0) {
            el.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:var(--text-sm);">
                No patients registered yet.</div>`;
            return;
        }

        el.innerHTML = recent.map(p => `
            <div class="patient-row">
                <div class="avatar avatar-sm" style="background:${avatarColor(p.patientId)};">${initials_(p.name)}</div>
                <div class="patient-row-info">
                    <div class="patient-row-name">${esc(p.name)}</div>
                    <div class="patient-row-sub">${esc(p.patientId)} · ${p.age} yrs · ${esc(p.gender)} · ${esc(p.blood)}</div>
                </div>
                <span class="badge ${p.registeredOn === TODAY ? 'badge-success' : 'badge-neutral'}" style="font-size:10px;">
                    ${p.registeredOn === TODAY ? 'New today' : (p.registeredOn || 'Active')}
                </span>
            </div>
        `).join('');
    }

    function renderDashActivityFeed() {
        const el = document.getElementById('activityFeed');
        if (!el) return;

        const activities = [];
        dashPatients.slice(0, 3).forEach(p => {
            activities.push({
                icon: '👤',
                type: 'success',
                text: `<strong>${esc(p.name)}</strong> registered (${esc(p.patientId)})`,
                time: p.registeredOn || 'Today'
            });
        });
        dashAppointments.slice(0, 3).forEach(a => {
            activities.push({
                icon: '📅',
                type: 'info',
                text: `Appointment for <strong>${esc(a.patientName)}</strong> with ${esc(a.doctor)} (${esc(a.time)})`,
                time: a.date
            });
        });

        if (activities.length === 0) {
            el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:var(--text-sm);">No recent activity</div>';
            return;
        }

        el.innerHTML = activities.slice(0, 5).map((act, i) => `
            <div class="activity-item">
                <div class="activity-dot-col">
                    <div class="activity-dot">${act.icon}</div>
                    ${i < activities.length - 1 ? '<div class="activity-line"></div>' : ''}
                </div>
                <div class="activity-content">
                    <div class="activity-text">${act.text}</div>
                    <div class="activity-time">${act.time}</div>
                </div>
            </div>
        `).join('');
    }

    function quickSearch(val) {
        const input = document.getElementById('apptSearch');
        if (input) input.value = val;
        filterApptTable(val);
    }

    window.filterApptTable = filterApptTable;
    window.quickSearch = quickSearch;
    window.callNextToken = callNextToken;
    window.receptionistConfirmArrival = receptionistConfirmArrival;
    window.receptionistCancelAppt = receptionistCancelAppt;

    // ============================================================
    // 2. APPOINTMENTS PAGE
    // ============================================================
    let listAppointments = [];

    async function initAppointments() {
        initHeaderAndSidebar();
        await loadAppointmentsList();
    }

    async function loadAppointmentsList() {
        try {
            const raw = await CMS.api.list(`/receptionist/appointments/?date=${TODAY}`);
            listAppointments = (raw || []).map(CMSAdapters.adaptAppointment);
            renderAppointmentsTable();
        } catch (err) {
            console.error('Error loading appointments:', err);
            showToast('Failed to load appointments from server', 'danger');
        }
    }

    function renderAppointmentsTable() {
        const qInput = document.getElementById('apptSearch');
        const sfSelect = document.getElementById('statusFilter');
        const tfSelect = document.getElementById('typeFilter');

        const q = qInput ? qInput.value.toLowerCase().trim() : '';
        const sf = sfSelect ? sfSelect.value : '';
        const tf = tfSelect ? tfSelect.value : '';

        let data = [...listAppointments];
        if (q) data = data.filter(a => a.patientName.toLowerCase().includes(q) || String(a.token).includes(q) || (a.patientId && a.patientId.toLowerCase().includes(q)));
        if (sf) data = data.filter(a => a.status === sf);
        if (tf) data = data.filter(a => a.type === tf);

        const countEl = document.getElementById('apptCount');
        const infoEl = document.getElementById('apptInfo');
        if (countEl) countEl.textContent = `${data.length} records`;
        if (infoEl) infoEl.textContent = `Showing ${data.length} of ${listAppointments.length}`;

        const tbody = document.getElementById('apptBody');
        if (!tbody) return;

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7"><div class="table-empty"><div class="table-empty-icon">📭</div><div class="table-empty-title">No appointments found</div></div></td></tr>';
            return;
        }

        const ti = { 'General': '🩺', 'Follow-up': '🔄', 'Emergency': '🚨', 'Walk-in': '🚶' };

        tbody.innerHTML = data.map(a => {
            let actionButtons = '';
            if (a.status === 'Booked') {
                actionButtons += `<button class="action-btn approve" title="Confirm Arrival & Issue Token" onclick="receptionistListCheckIn(${a.rawId})">📍 Confirm Arrival</button>`;
            } else if (a.status === 'Confirmed' || a.status === 'Waiting') {
                actionButtons += `<span style="font-size:var(--text-xs);font-weight:600;color:var(--accent);">Token #${String(a.token).padStart(2, '0')}</span>`;
            }

            if (a.status !== 'Completed' && a.status !== 'Cancelled') {
                actionButtons += `<button class="action-btn delete" title="Cancel Appointment" onclick="receptionistListCancel(${a.rawId}, '${esc(a.patientName)}')">✕</button>`;
            }

            return `
            <tr>
                <td>
                    <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-xs);background:var(--clr-blush);color:var(--accent);font-weight:700;font-size:var(--text-xs);">
                        ${String(a.token).padStart(2, '0')}
                    </span>
                </td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div class="avatar avatar-sm" style="background:${avatarColor(a.patientId)}">${initials_(a.patientName)}</div>
                        <div>
                            <div class="td-primary">${esc(a.patientName)}</div>
                            <div style="font-size:var(--text-xs);color:var(--text-muted);">${esc(a.patientId)}</div>
                        </div>
                    </div>
                </td>
                <td style="font-weight:600;font-size:var(--text-sm);">${esc(a.time)}</td>
                <td style="font-size:var(--text-xs);">${esc(a.doctor)}</td>
                <td style="font-size:var(--text-xs);">${ti[a.type] || '📋'} ${esc(a.type)}</td>
                <td><span class="badge ${apptStatusClass(a.status)}">${esc(a.status)}</span></td>
                <td class="td-actions">
                    <div class="td-actions-group">
                        ${actionButtons}
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    async function receptionistListCheckIn(id) {
        try {
            await CMS.api.post(`/receptionist/appointments/${id}/check_in/`, {});
            showToast('Arrival confirmed & token issued successfully!', 'success');
            await loadAppointmentsList();
        } catch (err) {
            console.error('Check-in error:', err);
            showToast(err.message || 'Failed to check in patient', 'danger');
        }
    }

    async function receptionistListCancel(id, name) {
        if (!confirm(`Cancel appointment for ${name}?`)) return;
        try {
            await CMS.api.post(`/receptionist/appointments/${id}/cancel/`, {});
            showToast(`Appointment for ${name} cancelled`, 'danger');
            await loadAppointmentsList();
        } catch (err) {
            console.error('Cancel error:', err);
            showToast(err.message || 'Failed to cancel appointment', 'danger');
        }
    }

    window.renderTable = renderAppointmentsTable;
    window.loadAppts = loadAppointmentsList;
    window.receptionistListCheckIn = receptionistListCheckIn;
    window.receptionistListCancel = receptionistListCancel;

    // ============================================================
    // 3. PATIENT REGISTRATION PAGE
    // ============================================================
    function initRegisterPatient() {
        initHeaderAndSidebar();
        bindLivePreview();
        const dobInput = document.getElementById('dob');
        if (dobInput) dobInput.max = TODAY;

        const regForm = document.getElementById('registerForm');
        if (regForm) {
            regForm.addEventListener('submit', handlePatientRegistrationSubmit);
        }
    }

    function bindLivePreview() {
        ['firstName', 'lastName', 'phone', 'gender', 'dob', 'blood', 'allergies'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', updateRegPreview);
                el.addEventListener('change', updateRegPreview);
            }
        });
        updateRegPreview();
    }

    function updateRegPreview() {
        const firstEl = document.getElementById('firstName');
        const lastEl = document.getElementById('lastName');
        const phoneEl = document.getElementById('phone');
        const genderEl = document.getElementById('gender');
        const bloodEl = document.getElementById('blood');
        const dobEl = document.getElementById('dob');
        const allergyEl = document.getElementById('allergies');

        const first = firstEl ? firstEl.value.trim() : '';
        const last = lastEl ? lastEl.value.trim() : '';
        const fullName = (first || last) ? `${first} ${last}`.trim() : 'New Patient';
        const phone = phoneEl ? phoneEl.value.trim() || '—' : '—';
        const gender = genderEl ? genderEl.value || '—' : '—';
        const blood = bloodEl ? bloodEl.value || 'Unknown' : 'Unknown';
        const dob = dobEl ? dobEl.value : '';
        const age = calcAge(dob);
        const allergies = allergyEl ? allergyEl.value.trim() : '';

        const avatar = document.getElementById('previewAvatar');
        if (avatar) {
            avatar.textContent = initials_(fullName === 'New Patient' ? 'PT' : fullName);
            avatar.style.background = avatarColor(fullName);
        }
        const nameEl = document.getElementById('previewName');
        if (nameEl) nameEl.textContent = fullName;

        const phonePreview = document.getElementById('previewPhone');
        if (phonePreview) phonePreview.textContent = phone;

        const demoEl = document.getElementById('previewDemographics');
        if (demoEl) demoEl.textContent = `${gender} · ${age !== '—' ? age + ' yrs' : 'Age —'} · ${blood}`;

        const agePill = document.getElementById('agePreviewPill');
        if (agePill) {
            if (age !== '—') {
                agePill.textContent = `🎂 ${age} yrs`;
                agePill.style.display = 'inline-block';
            } else {
                agePill.style.display = 'none';
            }
        }

        const allergyTag = document.getElementById('previewAllergy');
        if (allergyTag) {
            if (allergies && allergies.toLowerCase() !== 'none') {
                allergyTag.className = 'preview-tag warning';
                allergyTag.textContent = '⚠️ ' + (allergies.length > 20 ? allergies.slice(0, 18) + '…' : allergies);
            } else if (allergies.toLowerCase() === 'none') {
                allergyTag.className = 'preview-tag safe';
                allergyTag.textContent = '✅ No allergies';
            } else {
                allergyTag.className = 'preview-tag safe';
                allergyTag.textContent = 'Allergies: None noted';
            }
        }
    }

    function setAllergy(val) {
        const input = document.getElementById('allergies');
        if (input) {
            input.value = val;
            updateRegPreview();
        }
    }

    function addAllergy(val) {
        const input = document.getElementById('allergies');
        if (!input) return;
        let current = input.value.trim();
        if (!current || current.toLowerCase() === 'none') {
            input.value = val;
        } else {
            const list = current.split(',').map(s => s.trim()).filter(Boolean);
            if (!list.includes(val)) {
                list.push(val);
                input.value = list.join(', ');
            }
        }
        updateRegPreview();
    }

    function resetFormWithPreview() {
        const form = document.getElementById('registerForm');
        if (form) form.reset();
        const el = document.getElementById('formMsg');
        if (el) el.innerHTML = '';
        updateRegPreview();
    }

    async function handlePatientRegistrationSubmit(e) {
        e.preventDefault();
        const first = document.getElementById('firstName').value.trim();
        const last = document.getElementById('lastName').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const gender = document.getElementById('gender').value;
        const dob = document.getElementById('dob').value;
        const blood = document.getElementById('blood').value || 'O+';
        const email = document.getElementById('email').value.trim();
        const address = document.getElementById('address').value.trim();
        const ecName = document.getElementById('ecName').value.trim();
        const ecPhone = document.getElementById('ecPhone').value.trim();
        const allergies = document.getElementById('allergies').value.trim();

        if (!first || !last || !phone || !gender) {
            showRegMsg('Please complete all required fields (First Name, Last Name, Phone Number, Gender).', 'danger');
            return;
        }

        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>⏳</span><span>Registering patient…</span>';
        }

        try {
            const payload = {
                first_name: first,
                last_name: last,
                phone: phone,
                gender: gender.toUpperCase(),
                date_of_birth: dob || null,
                blood_group: blood,
                email: email || '',
                address: address || '',
                emergency_contact_name: ecName || '',
                emergency_contact_phone: ecPhone || ''
            };

            const newPatient = await CMS.api.post('/receptionist/patients/', payload);
            const patId = newPatient.patient_id || `PAT${newPatient.id}`;

            // If allergies/medical notes were provided, record medical history
            if (allergies && allergies.toLowerCase() !== 'none') {
                try {
                    await CMS.api.post('/receptionist/medical-history/', {
                        patient: newPatient.id,
                        allergies: allergies,
                        medical_condition: 'Initial Registration Intake'
                    });
                } catch (medErr) {
                    console.warn('Could not save medical history:', medErr);
                }
            }

            showRegMsg(
                `<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;padding:4px 0;">
                    <div>
                        <div style="font-size:var(--text-base);font-weight:700;">✅ Patient registered successfully!</div>
                        <div style="margin-top:2px;">Patient ID: <strong>${esc(patId)}</strong> · <strong>${esc(newPatient.first_name)} ${esc(newPatient.last_name || '')}</strong></div>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <a href="book-appointment.html?patient=${newPatient.id}" class="btn btn-primary btn-sm" style="text-decoration:none;">📅 Book Appointment Now</a>
                        <a href="patient-details.html?id=${newPatient.id}" class="btn btn-ghost btn-sm" style="text-decoration:none;">👁 View Profile</a>
                    </div>
                </div>`,
                'success'
            );

            showToast(`Patient ${patId} registered successfully!`, 'success');
            document.getElementById('registerForm').reset();
            updateRegPreview();
        } catch (err) {
            console.error('Registration error:', err);
            showRegMsg(err.message || 'Failed to register patient with backend server.', 'danger');
            showToast('Registration failed', 'danger');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>➕</span><span>Register Patient & Generate Chart</span>';
            }
        }
    }

    function showRegMsg(html, type) {
        const el = document.getElementById('formMsg');
        if (!el) return;
        const bg = { success: 'var(--success-light)', danger: 'var(--danger-light)', info: 'var(--info-light)' };
        const col = { success: 'var(--success)', danger: 'var(--danger)', info: 'var(--info)' };
        el.innerHTML = `<div style="padding:14px 18px;border-radius:10px;background:${bg[type] || bg.info};color:${col[type] || col.info};border:1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};">${html}</div>`;
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    window.setAllergy = setAllergy;
    window.addAllergy = addAllergy;
    window.resetFormWithPreview = resetFormWithPreview;

    // ============================================================
    // 4. PATIENT SEARCH PAGE
    // ============================================================
    let searchedPatients = [];

    async function initSearchPatient() {
        initHeaderAndSidebar();
        const mainSearch = document.getElementById('mainSearch');
        if (mainSearch) {
            mainSearch.addEventListener('input', function () {
                const searchInput = document.getElementById('searchInput');
                if (searchInput) searchInput.value = this.value;
                runPatientSearch(this.value);
            });
        }
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                runPatientSearch(this.value);
            });
        }
        const gFilter = document.getElementById('genderFilter');
        const bFilter = document.getElementById('bloodFilter');
        if (gFilter) gFilter.addEventListener('change', () => runPatientSearch(mainSearch ? mainSearch.value : ''));
        if (bFilter) bFilter.addEventListener('change', () => runPatientSearch(mainSearch ? mainSearch.value : ''));

        // Check for URL query param
        const urlParams = new URLSearchParams(window.location.search);
        const qParam = urlParams.get('q') || '';
        if (mainSearch && qParam) mainSearch.value = qParam;
        await runPatientSearch(qParam);
    }

    async function runPatientSearch(query) {
        try {
            const q = (query || '').trim();
            const endpoint = q ? `/receptionist/patients/?search=${encodeURIComponent(q)}` : '/receptionist/patients/';
            const raw = await CMS.api.list(endpoint);
            searchedPatients = (raw || []).map(CMSAdapters.adaptPatient);
            renderSearchResults();
        } catch (err) {
            console.error('Error searching patients:', err);
            showToast('Error searching patients', 'danger');
        }
    }

    function renderSearchResults() {
        const gender = (document.getElementById('genderFilter')?.value || '').toLowerCase();
        const blood = (document.getElementById('bloodFilter')?.value || '').toLowerCase();

        let patients = [...searchedPatients];
        if (gender) patients = patients.filter(p => p.gender.toLowerCase() === gender);
        if (blood) patients = patients.filter(p => p.blood.toLowerCase() === blood);

        const countEl = document.getElementById('resultCount');
        const infoEl = document.getElementById('searchInfo');
        if (countEl) countEl.textContent = `${patients.length} record${patients.length !== 1 ? 's' : ''}`;
        if (infoEl) infoEl.textContent = `${patients.length} patient${patients.length !== 1 ? 's' : ''} found`;

        const tbody = document.getElementById('searchResults');
        if (!tbody) return;

        if (patients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8"><div class="table-empty"><div class="table-empty-icon">📭</div><div class="table-empty-title">No patients found</div><div class="table-empty-desc">Try a different search term or <a href="register-patient.html">register a new patient</a>.</div></div></td></tr>';
            return;
        }

        tbody.innerHTML = patients.map(p => `
            <tr>
                <td><span class="badge badge-neutral">${esc(p.patientId)}</span></td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div class="avatar avatar-sm" style="background:${avatarColor(p.patientId)}">${initials_(p.name)}</div>
                        <div>
                            <div class="td-primary">${esc(p.name)}</div>
                            <div style="font-size:var(--text-xs);color:var(--text-muted);">${esc(p.phone || '—')}</div>
                        </div>
                    </div>
                </td>
                <td>${esc(p.gender || '—')}</td>
                <td>${p.age || '—'}</td>
                <td>${esc(p.blood || '—')}</td>
                <td>${esc(p.phone || '—')}</td>
                <td style="font-size:var(--text-xs);">${esc(p.registeredOn || '—')}</td>
                <td class="td-actions">
                    <div class="td-actions-group">
                        <a class="action-btn view" title="View Details" href="patient-details.html?id=${p.rawId}">👁</a>
                        <a class="action-btn approve" title="Book Appointment" href="book-appointment.html?patient=${p.rawId}">📅</a>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    window.runSearch = runPatientSearch;

    // ============================================================
    // 5. BOOK APPOINTMENT PAGE
    // ============================================================
    let activeDoctors = [];
    let selectedBookingPatient = null;

    async function initBookAppointment() {
        initHeaderAndSidebar();
        const apptDateInput = document.getElementById('apptDate');
        if (apptDateInput) {
            apptDateInput.value = TODAY;
            apptDateInput.min = TODAY;
        }

        await loadDoctorsForBooking();

        // Check if pre-selected patient in URL
        const params = new URLSearchParams(window.location.search);
        const pid = params.get('patient');
        if (pid) {
            try {
                const patRes = await CMS.api.get(`/receptionist/patients/${pid}/`);
                if (patRes) {
                    selectBookingPatient(CMSAdapters.adaptPatient(patRes));
                }
            } catch (err) {
                console.warn('Could not load pre-selected patient:', err);
            }
        }

        const bookForm = document.getElementById('bookForm');
        if (bookForm) {
            bookForm.addEventListener('submit', handleBookAppointmentSubmit);
        }

        const searchInput = document.getElementById('patientSearch');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                searchPatientDropdown(this.value);
            });
        }
    }

    async function loadDoctorsForBooking() {
        const docSelect = document.getElementById('doctorSelect');
        if (!docSelect) return;
        try {
            const rawDocs = await CMS.api.list('/receptionist/doctors/');
            activeDoctors = (rawDocs || []).map(CMSAdapters.adaptDoctor);
            docSelect.innerHTML = '<option value="">Select doctor</option>' +
                activeDoctors.map(d => `<option value="${d.rawId}">${esc(d.name)} — ${esc(d.specialization)}</option>`).join('');
        } catch (err) {
            console.error('Error loading doctors:', err);
        }
    }

    async function searchPatientDropdown(q) {
        const dd = document.getElementById('patientDropdown');
        if (!dd) return;
        if (!q.trim()) { dd.style.display = 'none'; return; }
        try {
            const raw = await CMS.api.list(`/receptionist/patients/?search=${encodeURIComponent(q.trim())}`);
            const found = (raw || []).map(CMSAdapters.adaptPatient).slice(0, 8);
            if (found.length === 0) {
                dd.style.display = 'none';
                return;
            }
            dd.innerHTML = found.map(p => `
                <div class="patient-dropdown-row" data-id="${p.rawId}" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border-light);font-size:var(--text-sm);" onmouseover="this.style.background='var(--clr-blush)'" onmouseout="this.style.background=''">
                    <strong>${esc(p.patientId)}</strong> — ${esc(p.name)} · ${esc(p.phone || '—')}
                </div>
            `).join('');
            dd.style.display = 'block';

            // Bind click handlers safely
            dd.querySelectorAll('.patient-dropdown-row').forEach((row, idx) => {
                row.addEventListener('click', () => {
                    selectBookingPatient(found[idx]);
                });
            });
        } catch (err) {
            console.error('Error querying patients for dropdown:', err);
        }
    }

    function selectBookingPatient(p) {
        selectedBookingPatient = p;
        const pidInput = document.getElementById('patientId');
        const pSearchInput = document.getElementById('patientSearch');
        const dd = document.getElementById('patientDropdown');
        const selContainer = document.getElementById('selectedPatient');

        if (pidInput) pidInput.value = p.rawId;
        if (pSearchInput) pSearchInput.value = '';
        if (dd) dd.style.display = 'none';

        if (selContainer) {
            selContainer.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--accent-light);border-radius:var(--radius-sm);">
                    <div class="avatar avatar-sm" style="background:${avatarColor(p.patientId)}">${initials_(p.name)}</div>
                    <div>
                        <div style="font-weight:600;font-size:var(--text-sm);">${esc(p.name)}</div>
                        <div style="font-size:var(--text-xs);color:var(--text-muted);">${esc(p.patientId)} · ${esc(p.phone || '—')}</div>
                    </div>
                    <button type="button" onclick="clearBookingPatient()" style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;">✕</button>
                </div>`;
        }
    }

    function clearBookingPatient() {
        selectedBookingPatient = null;
        const pidInput = document.getElementById('patientId');
        const selContainer = document.getElementById('selectedPatient');
        if (pidInput) pidInput.value = '';
        if (selContainer) selContainer.innerHTML = '';
    }

    async function handleBookAppointmentSubmit(e) {
        e.preventDefault();
        if (!selectedBookingPatient) {
            showBookMsg('Please search and select a patient first.', 'danger');
            return;
        }

        const docSelect = document.getElementById('doctorSelect');
        const doctorId = docSelect ? docSelect.value : '';
        const apptDate = document.getElementById('apptDate').value;
        const apptTimeInput = document.getElementById('apptTime').value;
        const apptType = document.getElementById('apptType').value;
        const reason = document.getElementById('reason').value.trim();

        if (!doctorId) {
            showBookMsg('Please select a doctor.', 'danger');
            return;
        }
        if (!apptDate || !apptTimeInput) {
            showBookMsg('Please select appointment date and time.', 'danger');
            return;
        }

        const time24 = CMSAdapters.time12To24(apptTimeInput);

        try {
            const payload = {
                patient: selectedBookingPatient.rawId,
                doctor: parseInt(doctorId, 10),
                appointment_date: apptDate,
                appointment_time: time24.length === 5 ? `${time24}:00` : time24,
                appointment_type: apptType === 'Emergency' ? 'WALK_IN' : (apptType === 'General' ? 'ADVANCE' : 'ADVANCE'),
                visit_category: apptType,
                reason: reason || 'Consultation'
            };

            const createdAppt = await CMS.api.post('/receptionist/appointments/', payload);

            showBookMsg(
                `<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
                    <div>✅ Appointment booked successfully for <strong>${esc(selectedBookingPatient.name)}</strong> on ${esc(apptDate)} at ${esc(CMSAdapters.time24To12(time24))}.</div>
                    <div style="display:flex;gap:8px;">
                        <a href="appointments.html" class="btn btn-primary btn-sm">📅 View Appointments</a>
                        <a href="token-queue.html" class="btn btn-ghost btn-sm">🎫 Token Queue</a>
                    </div>
                </div>`,
                'success'
            );

            showToast(`Appointment booked for ${selectedBookingPatient.name}`, 'success');
            document.getElementById('bookForm').reset();
            clearBookingPatient();
        } catch (err) {
            console.error('Booking error:', err);
            showBookMsg(err.message || 'Failed to book appointment with server.', 'danger');
            showToast('Booking failed', 'danger');
        }
    }

    function showBookMsg(html, type) {
        const el = document.getElementById('bookMsg');
        if (!el) return;
        const bg = { success: 'var(--success-light)', danger: 'var(--danger-light)' };
        const col = { success: 'var(--success)', danger: 'var(--danger)' };
        el.innerHTML = `<div style="padding:12px 16px;border-radius:var(--radius-sm);background:${bg[type] || bg.danger};color:${col[type] || col.danger};font-size:var(--text-sm);">${html}</div>`;
    }

    window.searchPatient = searchPatientDropdown;
    window.selectPatient = selectBookingPatient;
    window.clearPatient = clearBookingPatient;
    window.clearBookingPatient = clearBookingPatient;

    // ============================================================
    // 6. PATIENT DETAILS PAGE
    // ============================================================
    async function initPatientDetails() {
        initHeaderAndSidebar();
        const params = new URLSearchParams(window.location.search);
        const pid = params.get('id') || params.get('patient');
        if (!pid) {
            showDetailsErr('No patient ID provided in URL.');
            return;
        }

        try {
            const [patRes, medHistRes, apptsRes, invRes] = await Promise.all([
                CMS.api.get(`/receptionist/patients/${pid}/`),
                CMS.api.list(`/receptionist/medical-history/?patient=${pid}`).catch(() => []),
                CMS.api.list(`/receptionist/appointments/?patient=${pid}`).catch(() => []),
                CMS.api.list(`/receptionist/consultation-invoices/?patient=${pid}`).catch(() => [])
            ]);

            const p = CMSAdapters.adaptPatient(patRes);
            const medHist = medHistRes || [];
            const appts = (apptsRes || []).map(CMSAdapters.adaptAppointment);
            const invoices = (invRes || []).map(CMSAdapters.adaptInvoice);

            renderPatientFullDetails(p, medHist, appts, invoices);
        } catch (err) {
            console.error('Error fetching patient details:', err);
            showDetailsErr('Patient record could not be loaded from server.');
        }
    }

    function showDetailsErr(msg) {
        const el = document.getElementById('detailsContent');
        if (el) el.innerHTML = `<div class="card" style="padding:32px;text-align:center;color:var(--danger);">${esc(msg)}</div>`;
    }

    function renderPatientFullDetails(p, medHist, appts, invoices) {
        const titleEl = document.getElementById('pageTitle');
        const subEl = document.getElementById('pageSubtitle');
        const actionsEl = document.getElementById('pageActions');
        const contentEl = document.getElementById('detailsContent');

        if (titleEl) titleEl.textContent = p.name;
        if (subEl) subEl.textContent = `${p.patientId} · ${p.gender} · ${p.age} yrs`;
        if (actionsEl) {
            actionsEl.innerHTML = `<a href="book-appointment.html?patient=${p.rawId}" class="btn btn-primary btn-sm">📅 Book Appointment</a>`;
        }

        const allergiesStr = medHist.map(m => m.allergies).filter(Boolean).join(', ') || 'None noted';

        if (!contentEl) return;

        contentEl.innerHTML = `
            <!-- Profile card -->
            <div class="card" style="margin-bottom:20px;">
                <div class="patient-profile-header">
                    <div class="avatar" style="width:72px;height:72px;font-size:1.5rem;background:${avatarColor(p.patientId)}">${initials_(p.name)}</div>
                    <div style="flex:1;min-width:200px;">
                        <div style="font-size:var(--text-xl);font-weight:700;color:var(--text-primary);margin-bottom:4px;">${esc(p.name)}</div>
                        <div style="font-size:var(--text-sm);color:var(--text-muted);margin-bottom:10px;">${esc(p.patientId)}</div>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;">
                            ${p.blood ? '<span class="badge badge-primary">' + esc(p.blood) + '</span>' : ''}
                            ${p.gender ? '<span class="badge badge-neutral">' + esc(p.gender) + '</span>' : ''}
                            ${p.age ? '<span class="badge badge-neutral">' + p.age + ' years</span>' : ''}
                        </div>
                    </div>
                </div>
            </div>

            <div class="patient-info-grid">
                <!-- Contact Info -->
                <div class="card">
                    <div class="card-header"><div class="card-title">📞 Contact Information</div></div>
                    <div class="card-body">
                        <div style="padding:8px 0;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;"><span style="color:var(--text-muted);font-size:var(--text-xs);font-weight:700;">PHONE</span><span style="font-size:var(--text-sm);font-weight:500;">${esc(p.phone || '—')}</span></div>
                        <div style="padding:8px 0;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;"><span style="color:var(--text-muted);font-size:var(--text-xs);font-weight:700;">EMAIL</span><span style="font-size:var(--text-sm);font-weight:500;">${esc(p.email || '—')}</span></div>
                        <div style="padding:8px 0;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;"><span style="color:var(--text-muted);font-size:var(--text-xs);font-weight:700;">EC NAME</span><span style="font-size:var(--text-sm);font-weight:500;">${esc(p.emergencyContactName || '—')}</span></div>
                        <div style="padding:8px 0;display:flex;justify-content:space-between;"><span style="color:var(--text-muted);font-size:var(--text-xs);font-weight:700;">EC PHONE</span><span style="font-size:var(--text-sm);font-weight:500;">${esc(p.emergencyContactPhone || '—')}</span></div>
                    </div>
                </div>
                <!-- Medical -->
                <div class="card">
                    <div class="card-header"><div class="card-title">🩺 Medical Info</div></div>
                    <div class="card-body">
                        <div style="padding:8px 0;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;"><span style="color:var(--text-muted);font-size:var(--text-xs);font-weight:700;">BLOOD GROUP</span><span style="font-size:var(--text-sm);font-weight:500;">${esc(p.blood || '—')}</span></div>
                        <div style="padding:8px 0;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;"><span style="color:var(--text-muted);font-size:var(--text-xs);font-weight:700;">ALLERGIES</span><span style="font-size:var(--text-sm);font-weight:500;">${esc(allergiesStr)}</span></div>
                        <div style="padding:8px 0;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;"><span style="color:var(--text-muted);font-size:var(--text-xs);font-weight:700;">DOB</span><span style="font-size:var(--text-sm);font-weight:500;">${esc(p.dateOfBirth || '—')}</span></div>
                        <div style="padding:8px 0;display:flex;justify-content:space-between;"><span style="color:var(--text-muted);font-size:var(--text-xs);font-weight:700;">REGISTERED</span><span style="font-size:var(--text-sm);font-weight:500;">${esc(p.registeredOn || '—')}</span></div>
                    </div>
                </div>
            </div>

            <!-- Appointments history -->
            <div class="table-container" style="margin-top:20px;">
                <div class="table-header">
                    <div class="table-title">📅 Appointment History</div>
                    <div class="table-header-right">
                        <a href="book-appointment.html?patient=${p.rawId}" class="btn btn-primary btn-sm">+ Book New</a>
                    </div>
                </div>
                <div class="table-scroll">
                    <table>
                        <thead>
                            <tr><th>Token</th><th>Date</th><th>Time</th><th>Doctor</th><th>Type</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            ${appts.length ? appts.map(a => `
                                <tr>
                                    <td><span class="badge badge-neutral">#${String(a.token).padStart(2, '0')}</span></td>
                                    <td style="font-size:var(--text-sm);">${esc(a.date)}</td>
                                    <td style="font-weight:600;font-size:var(--text-sm);">${esc(a.time)}</td>
                                    <td style="font-size:var(--text-xs);">${esc(a.doctor)}</td>
                                    <td style="font-size:var(--text-xs);">${esc(a.type)}</td>
                                    <td><span class="badge ${apptStatusClass(a.status)}">${esc(a.status)}</span></td>
                                </tr>
                            `).join('') : '<tr><td colspan="6"><div class="table-empty"><div class="table-empty-icon">📭</div><div class="table-empty-title">No appointments yet</div></div></td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Billing history -->
            <div class="table-container" style="margin-top:20px;">
                <div class="table-header">
                    <div class="table-title">💳 Billing History</div>
                    <div class="table-header-right">
                        <a href="billing.html?search=${encodeURIComponent(p.patientId)}" class="btn btn-secondary btn-sm">Manage in Billing</a>
                    </div>
                </div>
                <div class="table-scroll">
                    <table>
                        <thead>
                            <tr><th>Invoice</th><th>Date</th><th>Type</th><th>Amount</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            ${invoices.length ? invoices.map(b => `
                                <tr>
                                    <td><span class="badge badge-neutral" style="font-family:monospace;font-size:11px;">${esc(b.invoiceNumber)}</span></td>
                                    <td style="font-size:var(--text-sm);">${esc(b.date || '—')}</td>
                                    <td><span class="badge badge-info">Consultation</span></td>
                                    <td style="font-weight:700;font-size:var(--text-sm);">₹${b.totalAmount.toFixed(2)}</td>
                                    <td><span class="badge ${b.status === 'Paid' ? 'badge-success' : 'badge-danger'}">${esc(b.status)}</span></td>
                                </tr>
                            `).join('') : '<tr><td colspan="5"><div class="table-empty"><div class="table-empty-icon">🧾</div><div class="table-empty-title">No billing records found</div></div></td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ============================================================
    // 7. TOKEN QUEUE PAGE
    // ============================================================
    let queueTokens = [];

    async function initTokenQueue() {
        initHeaderAndSidebar();
        await loadTokenQueueData();
        setInterval(loadTokenQueueData, 30000);
    }

    async function loadTokenQueueData() {
        try {
            const raw = await CMS.api.list(`/receptionist/tokens/?date=${TODAY}`);
            queueTokens = (raw || []).map(CMSAdapters.adaptToken);
            renderTokenQueuePage();
        } catch (err) {
            console.error('Error loading token queue:', err);
            showToast('Failed to load token queue from server', 'danger');
        }
    }

    function renderTokenQueuePage() {
        const inProg = queueTokens.find(t => t.rawStatus === 'CALLED');
        const waiting = queueTokens.filter(t => t.rawStatus === 'WAITING').sort((a, b) => a.token - b.token);
        const done = queueTokens.filter(t => t.rawStatus === 'COMPLETED').sort((a, b) => b.token - a.token);

        const nowNum = document.getElementById('nowNum');
        const nowName = document.getElementById('nowName');
        const nowInfo = document.getElementById('nowInfo');
        const waitCount = document.getElementById('waitCount');
        const nextUp = document.getElementById('nextUp');
        const qBadge = document.getElementById('qBadge');
        const doneBadge = document.getElementById('doneBadge');

        if (nowNum) nowNum.textContent = inProg ? String(inProg.token).padStart(2, '0') : '—';
        if (nowName) nowName.textContent = inProg ? inProg.patientName : 'No active patient';
        if (nowInfo) nowInfo.textContent = inProg ? inProg.doctorName : 'Click "Call Next" to begin';
        if (waitCount) waitCount.textContent = waiting.length;
        if (nextUp) nextUp.textContent = waiting.length ? `Next: ${waiting[0].patientName}` : 'Next: —';
        if (qBadge) qBadge.textContent = `${waiting.length} waiting`;
        if (doneBadge) doneBadge.textContent = `${done.length} done`;

        const wEl = document.getElementById('waitingList');
        if (wEl) {
            wEl.innerHTML = waiting.length ? waiting.map((t, i) => `
                <div class="token-queue-item" style="${i === 0 ? 'background:var(--accent-light);' : ''}">
                    <div class="token-num-badge" style="${i === 0 ? 'background:var(--accent);color:#fff;' : ''}">${String(t.token).padStart(2, '0')}</div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:var(--text-sm);font-weight:600;color:var(--text-primary);">${esc(t.patientName)}</div>
                        <div style="font-size:var(--text-xs);color:var(--text-muted);">${esc(t.doctorName)}</div>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="queueCallToken(${t.rawId}, '${esc(t.patientName)}')">Call</button>
                </div>
            `).join('') : '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:var(--text-sm);">Queue is empty 🎉</div>';
        }

        const dEl = document.getElementById('doneList');
        if (dEl) {
            dEl.innerHTML = done.length ? done.map(t => `
                <div class="token-queue-item">
                    <div class="token-num-badge" style="background:var(--success-light);color:var(--success);">${String(t.token).padStart(2, '0')}</div>
                    <div style="flex:1;">
                        <div style="font-size:var(--text-sm);font-weight:600;">${esc(t.patientName)}</div>
                        <div style="font-size:var(--text-xs);color:var(--text-muted);">${esc(t.doctorName)}</div>
                    </div>
                    <span class="badge badge-success">Done</span>
                </div>
            `).join('') : '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:var(--text-sm);">Nothing completed yet.</div>';
        }
    }

    async function queueCallNext() {
        const next = queueTokens.filter(t => t.rawStatus === 'WAITING').sort((a, b) => a.token - b.token)[0];
        if (!next) {
            showToast('No more patients in queue 🎉', 'info');
            return;
        }
        try {
            await CMS.api.post(`/receptionist/tokens/${next.rawId}/call_next/`, {});
            showToast(`Token #${String(next.token).padStart(2, '0')} called for ${next.patientName}`, 'info');
            await loadTokenQueueData();
        } catch (err) {
            console.error('Call next error:', err);
            showToast(err.message || 'Failed to call token', 'danger');
        }
    }

    async function queueCallToken(id, name) {
        try {
            await CMS.api.post(`/receptionist/tokens/${id}/call_next/`, {});
            showToast(`${name} called`, 'info');
            await loadTokenQueueData();
        } catch (err) {
            console.error('Call token error:', err);
            showToast(err.message || 'Failed to call token', 'danger');
        }
    }

    async function queueCompleteNow() {
        const inProg = queueTokens.find(t => t.rawStatus === 'CALLED');
        if (!inProg) {
            showToast('No patient currently called/in progress', 'warning');
            return;
        }
        try {
            await CMS.api.post(`/receptionist/tokens/${inProg.rawId}/complete/`, {});
            showToast(`${inProg.patientName} marked completed ✅`, 'success');
            await loadTokenQueueData();
        } catch (err) {
            console.error('Complete token error:', err);
            showToast(err.message || 'Failed to complete token', 'danger');
        }
    }

    window.callNext = queueCallNext;
    window.callToken = queueCallToken;
    window.queueCallToken = queueCallToken;
    window.completeNow = queueCompleteNow;

    // ============================================================
    // 8. BILLING PAGE
    // ============================================================
    let billingInvoices = [];
    let billingPayments = [];
    let currentBillSearch = '';
    let currentBillStatusFilter = '';

    async function initBilling() {
        initHeaderAndSidebar();
        const searchInput = document.getElementById('billSearch');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                currentBillSearch = this.value.toLowerCase().trim();
                renderBillingTable();
            });
        }
        const statusSelect = document.getElementById('billStatusFilter');
        if (statusSelect) {
            statusSelect.addEventListener('change', function () {
                currentBillStatusFilter = this.value;
                renderBillingTable();
            });
        }

        // Check search query parameter from URL
        const params = new URLSearchParams(window.location.search);
        const qParam = params.get('search');
        if (qParam && searchInput) {
            searchInput.value = qParam;
            currentBillSearch = qParam.toLowerCase().trim();
        }

        await loadBillingData();
    }

    async function loadBillingData() {
        try {
            const [invRes, payRes] = await Promise.all([
                CMS.api.list('/receptionist/consultation-invoices/'),
                CMS.api.list('/receptionist/consultation-payments/')
            ]);

            billingInvoices = (invRes || []).map(CMSAdapters.adaptInvoice);
            billingPayments = (payRes || []).map(CMSAdapters.adaptPayment);

            updateBillingSummaryCards();
            renderBillingTable();
        } catch (err) {
            console.error('Error loading billing records:', err);
            showToast('Failed to load billing records from server', 'danger');
        }
    }

    function updateBillingSummaryCards() {
        const totalCount = billingInvoices.length;
        const unpaidCount = billingInvoices.filter(b => b.status === 'Unpaid' || b.rawStatus === 'PENDING').length;
        const paidToday = billingInvoices.filter(b => (b.status === 'Paid' || b.rawStatus === 'PAID') && b.date === TODAY);
        const totalRevenue = billingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        const bTot = document.getElementById('bTotal');
        const bUnp = document.getElementById('bUnpaid');
        const bPd = document.getElementById('bPaid');
        const bRev = document.getElementById('bRevenue');
        const bCount = document.getElementById('billCount');

        if (bTot) bTot.textContent = totalCount;
        if (bUnp) bUnp.textContent = unpaidCount;
        if (bPd) bPd.textContent = paidToday.length;
        if (bRev) bRev.textContent = `₹${totalRevenue.toLocaleString('en-IN')}`;
        if (bCount) bCount.textContent = `${totalCount} invoices`;
    }

    function renderBillingTable() {
        let bills = [...billingInvoices];

        if (currentBillStatusFilter) {
            bills = bills.filter(b => b.status === currentBillStatusFilter || b.rawStatus === currentBillStatusFilter);
        }
        if (currentBillSearch) {
            bills = bills.filter(b =>
                (b.patientName || '').toLowerCase().includes(currentBillSearch) ||
                (b.invoiceNumber || '').toLowerCase().includes(currentBillSearch) ||
                String(b.patientId || '').includes(currentBillSearch)
            );
        }

        const tbody = document.getElementById('billBody');
        if (!tbody) return;

        if (!bills.length) {
            tbody.innerHTML = '<tr><td colspan="8"><div class="table-empty"><div class="table-empty-icon">🧾</div><div class="table-empty-title">No invoices found</div><div class="table-empty-desc">No consultation invoices matching your filters.</div></div></td></tr>';
            return;
        }

        const sc = { 'Unpaid': 'badge-danger', 'Paid': 'badge-success', 'Pending': 'badge-danger', 'Partial': 'badge-warning' };

        tbody.innerHTML = bills.map(b => {
            const isPaid = b.status === 'Paid' || b.rawStatus === 'PAID';
            return `
            <tr>
                <td><span class="badge badge-neutral" style="font-size:11px;font-family:monospace;">${esc(b.invoiceNumber)}</span></td>
                <td><span class="badge badge-info" style="font-size:11px;">Consultation</span></td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div class="avatar avatar-sm" style="background:${avatarColor(b.patientId)}">${initials_(b.patientName)}</div>
                        <div>
                            <div class="td-primary">${esc(b.patientName)}</div>
                            <div style="font-size:var(--text-xs);color:var(--text-muted);">${esc(b.patientId)}</div>
                        </div>
                    </div>
                </td>
                <td style="font-size:var(--text-xs);color:var(--text-secondary);">OPD Consultation</td>
                <td style="font-weight:700;color:var(--text-primary);">₹${b.totalAmount.toFixed(2)}</td>
                <td style="font-size:var(--text-xs);">${esc(b.date)}</td>
                <td><span class="badge ${sc[b.status] || 'badge-neutral'}">${esc(b.status)}</span></td>
                <td class="td-actions">
                    <div class="td-actions-group">
                        ${!isPaid ? `<button class="action-btn approve" title="Record Payment" onclick="openBillingPayModal(${b.rawId}, '${esc(b.invoiceNumber)}', ${b.totalAmount})">₹ Pay</button>` : ''}
                        <button class="action-btn view" title="View Bill" onclick="viewBillingInvoice(${b.rawId})">👁</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    let activeInvoiceToPay = null;

    function openBillingPayModal(invoiceId, invNum, amount) {
        activeInvoiceToPay = invoiceId;
        const modal = document.getElementById('payModal');
        const overlay = document.getElementById('payModalOverlay');
        const billIdEl = document.getElementById('payBillId');
        const amtEl = document.getElementById('payAmt');

        if (billIdEl) billIdEl.value = invNum;
        if (amtEl) amtEl.value = amount;
        if (modal) modal.style.display = 'block';
        if (overlay) overlay.style.display = 'block';
    }

    function closeBillingPayModal() {
        const modal = document.getElementById('payModal');
        const overlay = document.getElementById('payModalOverlay');
        if (modal) modal.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
        activeInvoiceToPay = null;
    }

    async function handleRecordPaymentSubmit(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (!activeInvoiceToPay) {
            showToast('No active invoice selected for payment', 'danger');
            return;
        }

        const amtInput = document.getElementById('payAmt');
        const methodSelect = document.getElementById('payMethod');
        const refInput = document.getElementById('payRef');

        const amount = amtInput ? parseFloat(amtInput.value) : 0;
        const method = methodSelect ? methodSelect.value : 'CASH';
        const ref = refInput ? refInput.value.trim() : '';

        if (!amount || amount <= 0) {
            showToast('Please enter a valid payment amount', 'danger');
            return;
        }

        try {
            await CMS.api.post('/receptionist/consultation-payments/', {
                invoice: activeInvoiceToPay,
                amount: amount,
                payment_method: method.toUpperCase(),
                transaction_id: ref || `TXN${Date.now().toString().slice(-6)}`
            });

            showToast('Payment recorded successfully! Invoice marked as Paid.', 'success');
            closeBillingPayModal();
            await loadBillingData();
        } catch (err) {
            console.error('Payment error:', err);
            showToast(err.message || 'Failed to record payment', 'danger');
        }
    }

    function viewBillingInvoice(invoiceId) {
        const inv = billingInvoices.find(b => b.rawId === invoiceId);
        if (!inv) return;
        alert(`Invoice: ${inv.invoiceNumber}\nPatient: ${inv.patientName}\nAmount: ₹${inv.totalAmount.toFixed(2)}\nStatus: ${inv.status}\nDate: ${inv.date}`);
    }

    window.openPayModal = openBillingPayModal;
    window.closePayModal = closeBillingPayModal;
    window.openBillingPayModal = openBillingPayModal;
    window.closeBillingPayModal = closeBillingPayModal;
    window.viewBill = viewBillingInvoice;
    window.viewBillingInvoice = viewBillingInvoice;

    // Attach payment form submission
    document.addEventListener('DOMContentLoaded', () => {
        const payForm = document.getElementById('payForm');
        if (payForm) {
            payForm.addEventListener('submit', handleRecordPaymentSubmit);
        }
    });

    // ------------------------------------------------------------
    // Page Route Dispatcher
    // ------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', () => {
        const path = window.location.pathname.toLowerCase();
        if (path.includes('dashboard.html')) {
            initDashboard();
        } else if (path.includes('appointments.html')) {
            initAppointments();
        } else if (path.includes('register-patient.html')) {
            initRegisterPatient();
        } else if (path.includes('search-patient.html')) {
            initSearchPatient();
        } else if (path.includes('book-appointment.html')) {
            initBookAppointment();
        } else if (path.includes('patient-details.html')) {
            initPatientDetails();
        } else if (path.includes('token-queue.html')) {
            initTokenQueue();
        } else if (path.includes('billing.html')) {
            initBilling();
        }
    });

    // Global CMSReceptionist namespace
    window.CMSReceptionist = {
        initDashboard,
        initAppointments,
        initRegisterPatient,
        initSearchPatient,
        initBookAppointment,
        initPatientDetails,
        initTokenQueue,
        initBilling
    };
})();
