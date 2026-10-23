// ============================================================
// CMS - ADMIN DASHBOARD
// File: js/admin-dashboard.js
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const user = CMS.requireRole(['admin']);
    if (!user) return;

    const signInLink = document.getElementById('sign-in-link');
    if (signInLink) {
        signInLink.addEventListener('click', (e) => {
            e.preventDefault();
            CMS.session.clear();
            window.location.href = '../index.html';
        });
    }

    try {
        const [dashData, users] = await Promise.all([
            CMS.api.get('/admin/dashboard/').catch(() => null),
            CMS.api.list('/admin/users/').catch(() => [])
        ]);

        if (dashData) {
            const totalDoctorsEl = document.getElementById('totalDoctors');
            const totalStaffEl = document.getElementById('totalStaff');
            if (totalDoctorsEl) totalDoctorsEl.textContent = dashData.total_doctors ?? 0;
            if (totalStaffEl) {
                const staffCount = (dashData.total_receptionists || 0) +
                                   (dashData.total_lab_technicians || 0) +
                                   (dashData.total_pharmacists || 0);
                totalStaffEl.textContent = staffCount;
            }
        }

        if (users && users.length > 0) {
            const totalUsersEl = document.getElementById('totalUsers');
            const activeUsersEl = document.getElementById('activeUsers');
            if (totalUsersEl) totalUsersEl.textContent = users.length;
            if (activeUsersEl) {
                activeUsersEl.textContent = users.filter(u => u.is_active).length;
            }
        }
    } catch (err) {
        console.error('Failed to load admin dashboard stats:', err);
    }
});