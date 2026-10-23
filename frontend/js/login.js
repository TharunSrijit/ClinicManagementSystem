const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const message = document.getElementById('form-message');
const submitButton = document.getElementById('submit-button');
const togglePassword = document.getElementById('toggle-password');
const submitLabel = document.getElementById('submit-label');
const portalEyebrow = document.getElementById('portal-eyebrow');
const portalIntro = document.getElementById('portal-intro');
const portalOptions = document.querySelectorAll('.portal-option');

const dashboardByRole = {
    ADMIN: 'admin/dashboard.html',
    DOCTOR: 'doctor/dashboard.html',
    RECEPTIONIST: 'receptionist/dashboard.html',
    LAB_TECHNICIAN: 'lab/dashboard.html',
    PHARMACIST: 'pharmacy/dashboard.html'
};

// const localAccounts = {
//     admin: { password: 'admin123', role: 'ADMIN', userRole: 'admin', fullName: 'Administrator' }
// };
const localAccounts = {
    admin: { password: 'admin123', role: 'ADMIN', userRole: 'admin', fullName: 'Administrator' },
    doctor: { password: 'doctor123', role: 'DOCTOR', userRole: 'doctor', fullName: 'Dr. Arun Kumar', profileId: 'DOC001', profileType: 'doctor' },
    reception: { password: 'reception123', role: 'RECEPTIONIST', userRole: 'receptionist', fullName: 'Receptionist' },
    receptionist: { password: ['reception123', 'receptionist123'], role: 'RECEPTIONIST', userRole: 'receptionist', fullName: 'Receptionist' },
    pharmacy: { password: 'pharmacy123', role: 'PHARMACIST', userRole: 'pharmacist', fullName: 'Pharmacist' },
    pharmacist: { password: 'pharmacist123', role: 'PHARMACIST', userRole: 'pharmacist', fullName: 'Pharmacist' },
    lab: { password: 'lab123', role: 'LAB_TECHNICIAN', userRole: 'lab', fullName: 'Lab Technician' }
}

const registeredRoleDetails = {
    Admin: { role: 'ADMIN', userRole: 'admin' },
    Doctor: { role: 'DOCTOR', userRole: 'doctor' },
    Receptionist: { role: 'RECEPTIONIST', userRole: 'receptionist' },
    'Lab Technician': { role: 'LAB_TECHNICIAN', userRole: 'lab' },
    Pharmacist: { role: 'PHARMACIST', userRole: 'pharmacist' }
};

function findRegisteredAccount(username) {
    let users;

    try {
        users = JSON.parse(localStorage.getItem('cms_users') || '[]');
    } catch (error) {
        return null;
    }

    const user = users.find(item => item.username && item.username.toLowerCase() === username);
    const roleDetails = user && registeredRoleDetails[user.role];

    if (!user || !roleDetails) return null;

    return {
        id: user.id,
        password: user.password,
        role: roleDetails.role,
        userRole: roleDetails.userRole,
        fullName: user.name,
        status: user.status,
        profileId: user.profileId,
        profileType: user.profileType
    };
}

function readStoredRecords(key) {
    let doctors;

    try {
        doctors = JSON.parse(localStorage.getItem(key) || '[]');
    } catch (error) {
        return [];
    }

    return Array.isArray(doctors) ? doctors : [];
}

function normalizeDoctorName(name) {
    return (name || '').toLowerCase().replace(/^dr\.?\s*/, '').replace(/\s+/g, ' ').trim();
}

function findDoctorProfile(account) {
    let doctors = readStoredRecords('cms_doctors');

    const targetProfileId = account.profileId || 'DOC001';
    const targetNormalizedName = normalizeDoctorName(account.fullName || 'Dr. Arun Kumar');
    let existingDoctor = doctors.find(item =>
        item.id === targetProfileId || (item.name && normalizeDoctorName(item.name) === targetNormalizedName)
    );

    if (!existingDoctor && (account.userRole === 'doctor' || account.role === 'DOCTOR')) {
        const demoDoctor = {
            id: targetProfileId,
            staffId: 'STAFF001',
            name: account.fullName || 'Dr. Arun Kumar',
            email: 'arun.kumar@medicare.com',
            phone: '9876543210',
            specialization: 'Cardiology',
            status: 'Active',
            createdAt: new Date().toLocaleDateString()
        };
        doctors.push(demoDoctor);
        existingDoctor = demoDoctor;
        try {
            localStorage.setItem('cms_doctors', JSON.stringify(doctors));
        } catch (error) {}
    }

    if (account.profileType === 'staff' && account.profileId) {
        const staffProfile = readStoredRecords('cms_staff').find(person =>
            person.id === account.profileId && person.role === 'Doctor'
        );
        if (!staffProfile) return null;

        const doctor = doctors.find(item =>
            item.id === staffProfile.doctorId || item.staffId === staffProfile.id
        );
        return doctor ? { doctor, staffProfile } : null;
    }

    let doctor = account.profileId
        ? doctors.find(item => item.id === account.profileId)
        : null;

    if (!doctor) {
        const normalizedName = normalizeDoctorName(account.fullName || '');
        const matches = doctors.filter(item =>
            item.name && normalizeDoctorName(item.name) === normalizedName
        );
        if (matches.length >= 1) doctor = matches[0];
    }

    return doctor ? { doctor, staffProfile: null } : null;
}

togglePassword.addEventListener('click', () => {
    const showPassword = passwordInput.type === 'password';
    passwordInput.type = showPassword ? 'text' : 'password';
    togglePassword.textContent = showPassword ? 'Hide' : 'Show';
    togglePassword.setAttribute('aria-pressed', String(showPassword));
});

loginForm.addEventListener('submit', event => {
    event.preventDefault();
    message.textContent = '';

    if (!loginForm.reportValidity()) return;

    const username = usernameInput.value.trim().toLowerCase();
    const registeredAccount = findRegisteredAccount(username);
    const account = registeredAccount || localAccounts[username];
    const requiredRole = loginForm.dataset.role;
    const doctorProfile = account && account.userRole === 'doctor'
        ? findDoctorProfile(account)
        : null;

    if (registeredAccount && registeredAccount.status !== 'Active') {
        message.textContent = 'This account is inactive. Contact your clinic administrator.';
        return;
    }

    const passwordMatches = account && (Array.isArray(account.password)
        ? account.password.includes(passwordInput.value)
        : account.password === passwordInput.value);

    if (!passwordMatches) {
        message.textContent = 'Sign-in failed. Please check your username and password.';
        return;
    }

    if (account && account.userRole === 'doctor' && (
        !doctorProfile ||
        doctorProfile.doctor.status !== 'Active' ||
        (doctorProfile.staffProfile && doctorProfile.staffProfile.status !== 'Active')
    )) {
        message.textContent = 'This doctor profile is inactive or unavailable. Contact your clinic administrator.';
        return;
    }

    const isAuthorized = requiredRole === 'ADMIN'
        ? account.role === 'ADMIN'
        : requiredRole === 'STAFF'
            ? account.role !== 'ADMIN'
            : true;

    if (!isAuthorized) {
        message.textContent = 'This sign-in is not authorized for this workspace.';
        return;
    }

    const resolvedDoctorId = (doctorProfile && doctorProfile.doctor && doctorProfile.doctor.id) || account.profileId || null;

    localStorage.setItem('fd_access', 'local-session');
    localStorage.setItem('fd_refresh', '');
    localStorage.setItem('fd_name', account.fullName);
    localStorage.setItem('loggedInUser', JSON.stringify({
        id: account.id || resolvedDoctorId || null,
        userId: account.id || null,
        doctorId: resolvedDoctorId,
        username,
        name: account.fullName,
        fullName: account.fullName,
        role: account.userRole,
        userRole: account.userRole,
        profileId: account.profileId || resolvedDoctorId,
        profileType: account.profileType || (doctorProfile && 'doctor') || null
    }));
    window.location.assign(dashboardByRole[account.role]);
});

portalOptions.forEach(option => {
    option.addEventListener('click', () => {
        const isAdmin = option.dataset.role === 'ADMIN';
        loginForm.dataset.role = isAdmin ? 'ADMIN' : 'STAFF';

        portalOptions.forEach(portalOption => {
            const isCurrent = portalOption === option;
            portalOption.classList.toggle('is-current', isCurrent);
            portalOption.setAttribute('aria-pressed', String(isCurrent));
        });

        portalEyebrow.textContent = isAdmin ? 'ADMINISTRATOR ACCESS' : 'STAFF PORTAL';
        portalIntro.textContent = isAdmin
            ? 'Sign in with your administrator account to continue.'
            : 'Sign in with your staff account to continue.';
        submitLabel.textContent = isAdmin ? 'Sign in as Admin' : 'Sign in as Staff';
        document.title = isAdmin
            ? 'Administrator Sign In | Clinic Management System'
            : 'Sign In | Clinic Management System';
        message.textContent = '';
    });
});