// ============================================================
// CMS - ADMIN MANAGEMENT
// File: js/admin.js
// ============================================================

let allDoctors = [];
let allStaff = [];
let allUsers = [];

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

    if (document.getElementById('doctorTableBody')) {
        await loadDoctors();
    }
    if (document.getElementById('staffTableBody')) {
        updateStaffRoleFields();
        await loadStaff();
    }
    if (document.getElementById('userTableBody')) {
        await loadUsers();
    }
});

// ============================================================
// DOCTOR MANAGEMENT
// ============================================================
async function loadDoctors() {
    const tableBody = document.getElementById('doctorTableBody');
    if (!tableBody) return;
    try {
        allDoctors = await CMS.api.list('/admin/doctors/');
        displayDoctors(allDoctors);
    } catch (err) {
        console.error('Failed to load doctors:', err);
        tableBody.innerHTML = '<tr><td colspan="7">Failed to load doctors.</td></tr>';
    }
}

function searchDoctors() {
    const q = (document.getElementById('doctorSearch')?.value || '').toLowerCase().trim();
    if (!q) {
        displayDoctors(allDoctors);
        return;
    }
    const filtered = allDoctors.filter(d => 
        (d.full_name || '').toLowerCase().includes(q) ||
        (d.email || '').toLowerCase().includes(q) ||
        (d.specialization || '').toLowerCase().includes(q) ||
        (d.doctor_id || '').toLowerCase().includes(q)
    );
    displayDoctors(filtered);
}

function displayDoctors(doctors) {
    const tableBody = document.getElementById('doctorTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (!doctors || doctors.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7">No doctors found.</td></tr>';
        return;
    }
    doctors.forEach(doc => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${doc.doctor_id || doc.id}</td>
            <td>${doc.full_name || '-'}</td>
            <td>${doc.email || '-'}</td>
            <td>${doc.phone || '-'}</td>
            <td>${doc.specialization || '-'}</td>
            <td><span class="status-badge status-confirmed">Active</span></td>
            <td>
                <button type="button" class="btn-table" onclick="editDoctor(${doc.id})">Edit</button>
                <button type="button" class="btn-table btn-danger" onclick="deleteDoctor(${doc.id})">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function addDoctor() {
    const name = document.getElementById('doctorName')?.value.trim();
    const email = document.getElementById('doctorEmail')?.value.trim();
    const phone = document.getElementById('doctorPhone')?.value.trim();
    const specialization = document.getElementById('doctorSpecialization')?.value.trim();

    if (!name || !email || !phone || !specialization) {
        alert('Please fill all doctor details.');
        return;
    }

    const nameParts = name.split(' ');
    const firstName = nameParts[0] || 'Doctor';
    const lastName = nameParts.slice(1).join(' ') || '';
    const username = ('dr_' + firstName.toLowerCase() + (Date.now() % 1000)).replace(/[^a-z0-9_]/g, '');

    try {
        await CMS.api.post('/admin/users/create_staff/', {
            role: 'DOCTOR',
            username: username,
            password: 'TempPassword123!',
            email: email,
            first_name: firstName,
            last_name: lastName,
            phone: phone,
            profile: {
                doctor_id: 'DOC' + Math.floor(1000 + Math.random() * 9000),
                specialization: specialization,
                qualification: 'MBBS',
                registration_number: 'REG' + (Date.now() % 100000),
                consultation_fee: 500
            }
        });
        alert('Doctor added successfully. Login username: ' + username + ' (Default password: TempPassword123!)');
        document.getElementById('doctorForm')?.reset();
        await loadDoctors();
    } catch (err) {
        console.error('Failed to add doctor:', err);
        alert('Failed to add doctor: ' + (err.message || 'Server error'));
    }
}

async function editDoctor(id) {
    const doc = allDoctors.find(d => d.id === id);
    if (!doc) return;
    const newSpec = prompt('Update doctor specialization:', doc.specialization || '');
    if (newSpec === null) return;
    const newFee = prompt('Update consultation fee:', doc.consultation_fee || '500');
    if (newFee === null) return;

    try {
        await CMS.api.patch(`/admin/doctors/${id}/`, {
            specialization: newSpec.trim(),
            consultation_fee: parseFloat(newFee) || doc.consultation_fee
        });
        alert('Doctor updated successfully.');
        await loadDoctors();
    } catch (err) {
        console.error('Failed to update doctor:', err);
        alert('Failed to update doctor: ' + (err.message || 'Server error'));
    }
}

async function deleteDoctor(id) {
    if (!confirm('Are you sure you want to delete this doctor?')) return;
    try {
        await CMS.api.delete(`/admin/doctors/${id}/`);
        alert('Doctor deleted successfully.');
        await loadDoctors();
    } catch (err) {
        console.error('Failed to delete doctor:', err);
        alert('Failed to delete doctor: ' + (err.message || 'Server error'));
    }
}

// ============================================================
// STAFF MANAGEMENT
// ============================================================
function updateStaffRoleFields() {
    const roleInput = document.getElementById('staffRole');
    const specField = document.getElementById('doctor-specialization-field');
    const specInput = document.getElementById('staffSpecialization');
    if (!roleInput || !specField) return;
    const isDoctor = roleInput.value === 'Doctor';
    specField.hidden = !isDoctor;
    if (specInput) specInput.required = isDoctor;
}

async function loadStaff() {
    const tableBody = document.getElementById('staffTableBody');
    if (!tableBody) return;
    try {
        const [receptionists, labTechs, pharmacists] = await Promise.all([
            CMS.api.list('/admin/receptionists/').catch(() => []),
            CMS.api.list('/admin/lab-technicians/').catch(() => []),
            CMS.api.list('/admin/pharmacists/').catch(() => [])
        ]);

        allStaff = [
            ...receptionists.map(r => ({
                id: r.employee_id || ('REC' + r.id),
                name: r.full_name || 'Staff Member',
                email: r.email || '-',
                phone: r.phone || '-',
                role: 'Receptionist',
                status: 'Active',
                rawId: r.id,
                userId: r.user,
                endpoint: 'receptionists'
            })),
            ...labTechs.map(l => ({
                id: l.employee_id || ('LAB' + l.id),
                name: l.full_name || 'Staff Member',
                email: l.email || '-',
                phone: l.phone || '-',
                role: 'Lab Technician',
                status: 'Active',
                rawId: l.id,
                userId: l.user,
                endpoint: 'lab-technicians'
            })),
            ...pharmacists.map(p => ({
                id: p.employee_id || ('PHARM' + p.id),
                name: p.full_name || 'Staff Member',
                email: p.email || '-',
                phone: p.phone || '-',
                role: 'Pharmacist',
                status: 'Active',
                rawId: p.id,
                userId: p.user,
                endpoint: 'pharmacists'
            }))
        ];

        displayStaff(allStaff);
    } catch (err) {
        console.error('Failed to load staff:', err);
        tableBody.innerHTML = '<tr><td colspan="7">Failed to load staff.</td></tr>';
    }
}

function searchStaff() {
    const q = (document.getElementById('staffSearch')?.value || '').toLowerCase().trim();
    if (!q) {
        displayStaff(allStaff);
        return;
    }
    const filtered = allStaff.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );
    displayStaff(filtered);
}

function displayStaff(staffList) {
    const tableBody = document.getElementById('staffTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (!staffList || staffList.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7">No staff found.</td></tr>';
        return;
    }
    staffList.forEach(s => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${s.id}</td>
            <td>${s.name}</td>
            <td>${s.email}</td>
            <td>${s.phone}</td>
            <td>${s.role}</td>
            <td><span class="status-badge status-confirmed">${s.status}</span></td>
            <td>
                <button type="button" class="btn-table" onclick="editStaff('${s.id}')">Edit</button>
                <button type="button" class="btn-table btn-danger" onclick="deleteStaff('${s.id}')">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function addStaff() {
    const name = document.getElementById('staffName')?.value.trim();
    const email = document.getElementById('staffEmail')?.value.trim();
    const phone = document.getElementById('staffPhone')?.value.trim();
    const role = document.getElementById('staffRole')?.value;
    const spec = document.getElementById('staffSpecialization')?.value.trim() || '';

    if (!name || !email || !phone || !role) {
        alert('Please fill all required staff details.');
        return;
    }

    const roleMap = {
        'Receptionist': 'RECEPTIONIST',
        'Lab Technician': 'LAB_TECHNICIAN',
        'Pharmacist': 'PHARMACIST',
        'Doctor': 'DOCTOR'
    };
    const backendRole = roleMap[role];
    if (!backendRole) {
        alert('Invalid role selected.');
        return;
    }

    const nameParts = name.split(' ');
    const firstName = nameParts[0] || 'Staff';
    const lastName = nameParts.slice(1).join(' ') || '';
    const username = (firstName.toLowerCase() + (Date.now() % 1000)).replace(/[^a-z0-9_]/g, '');

    const empId = (role === 'Receptionist' ? 'REC' : role === 'Lab Technician' ? 'LAB' : 'PHARM') + Math.floor(1000 + Math.random() * 9000);

    const profileData = {
        employee_id: empId,
        phone: phone,
        qualification: role === 'Pharmacist' ? 'B.Pharm' : role === 'Lab Technician' ? 'B.Sc MLT' : undefined
    };

    try {
        await CMS.api.post('/admin/users/create_staff/', {
            role: backendRole,
            username: username,
            password: 'TempPassword123!',
            email: email,
            first_name: firstName,
            last_name: lastName,
            phone: phone,
            profile: profileData
        });
        alert('Staff added successfully. Login username: ' + username + ' (Default password: TempPassword123!)');
        document.getElementById('staffForm')?.reset();
        updateStaffRoleFields();
        await loadStaff();
    } catch (err) {
        console.error('Failed to add staff:', err);
        alert('Failed to add staff: ' + (err.message || 'Server error'));
    }
}

async function editStaff(id) {
    const person = allStaff.find(s => s.id === id);
    if (!person) return;
    const newPhone = prompt('Update phone number:', person.phone !== '-' ? person.phone : '');
    if (newPhone === null) return;
    try {
        await CMS.api.patch(`/admin/${person.endpoint}/${person.rawId}/`, {
            phone: newPhone.trim()
        });
        alert('Staff updated successfully.');
        await loadStaff();
    } catch (err) {
        console.error('Failed to update staff:', err);
        alert('Failed to update staff: ' + (err.message || 'Server error'));
    }
}

async function deleteStaff(id) {
    const person = allStaff.find(s => s.id === id);
    if (!person) return;
    if (!confirm(`Are you sure you want to delete ${person.name}?`)) return;
    try {
        await CMS.api.delete(`/admin/${person.endpoint}/${person.rawId}/`);
        alert('Staff deleted successfully.');
        await loadStaff();
    } catch (err) {
        console.error('Failed to delete staff:', err);
        alert('Failed to delete staff: ' + (err.message || 'Server error'));
    }
}

// ============================================================
// USER MANAGEMENT
// ============================================================
async function loadUsers() {
    const tableBody = document.getElementById('userTableBody');
    if (!tableBody) return;
    try {
        allUsers = await CMS.api.list('/admin/users/');
        displayUsers(allUsers);
    } catch (err) {
        console.error('Failed to load users:', err);
        tableBody.innerHTML = '<tr><td colspan="7">Failed to load user accounts.</td></tr>';
    }
}

function searchUsers() {
    const q = (document.getElementById('userSearch')?.value || '').toLowerCase().trim();
    if (!q) {
        displayUsers(allUsers);
        return;
    }
    const filtered = allUsers.filter(u =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q) ||
        ((u.first_name || '') + ' ' + (u.last_name || '')).toLowerCase().includes(q)
    );
    displayUsers(filtered);
}

function displayUsers(usersList) {
    const tableBody = document.getElementById('userTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (!usersList || usersList.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7">No user accounts found.</td></tr>';
        return;
    }
    usersList.forEach(u => {
        const row = document.createElement('tr');
        const fullName = (u.first_name || u.last_name) ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.username;
        const statusClass = u.is_active ? 'status-confirmed' : 'status-cancelled';
        const statusText = u.is_active ? 'Active' : 'Inactive';
        const toggleAction = u.is_active ? 'Deactivate' : 'Activate';
        row.innerHTML = `
            <td>${u.id}</td>
            <td>${fullName}</td>
            <td>${u.email || '-'}</td>
            <td>${u.username}</td>
            <td>${u.role}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <button type="button" class="btn-table" onclick="toggleUserStatus(${u.id})">${toggleAction}</button>
                <button type="button" class="btn-table btn-danger" onclick="deleteUser(${u.id})">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function addUser() {
    const name = document.getElementById('userName')?.value.trim();
    const email = document.getElementById('userEmail')?.value.trim();
    const username = document.getElementById('userUsername')?.value.trim().toLowerCase();
    const password = document.getElementById('userPassword')?.value;
    const role = document.getElementById('userRole')?.value;

    if (!name || !email || !username || !password || !role) {
        alert('Please fill all user details.');
        return;
    }

    const roleMap = {
        'Admin': 'ADMIN',
        'Doctor': 'DOCTOR',
        'Receptionist': 'RECEPTIONIST',
        'Lab Technician': 'LAB_TECHNICIAN',
        'Pharmacist': 'PHARMACIST'
    };
    const backendRole = roleMap[role];
    if (!backendRole) {
        alert('Invalid role selected.');
        return;
    }

    const nameParts = name.split(' ');
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || '';

    try {
        await CMS.api.post('/admin/users/', {
            username: username,
            password: password,
            email: email,
            first_name: firstName,
            last_name: lastName,
            role: backendRole,
            is_active: true
        });
        alert('User created successfully.');
        document.getElementById('userForm')?.reset();
        await loadUsers();
    } catch (err) {
        console.error('Failed to create user:', err);
        alert('Failed to create user: ' + (err.message || 'Server error'));
    }
}

async function toggleUserStatus(id) {
    const user = allUsers.find(u => u.id === id);
    if (!user) return;
    const action = user.is_active ? 'deactivate' : 'activate';
    try {
        await CMS.api.post(`/admin/users/${id}/${action}/`, {});
        await loadUsers();
    } catch (err) {
        console.error(`Failed to ${action} user:`, err);
        alert(`Failed to ${action} user: ` + (err.message || 'Server error'));
    }
}

async function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
        await CMS.api.delete(`/admin/users/${id}/`);
        alert('User deleted successfully.');
        await loadUsers();
    } catch (err) {
        console.error('Failed to delete user:', err);
        alert('Failed to delete user: ' + (err.message || 'Server error'));
    }
}
