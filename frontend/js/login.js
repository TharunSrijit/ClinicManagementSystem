// ============================================================
// CMS - LOGIN (now signs in against the Django backend)
// File: js/login.js        Needs js/api.js loaded first.
// The hard-coded demo accounts and cms_users lookups are gone;
// accounts now live in the backend database.
// ============================================================
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

togglePassword.addEventListener('click', () => {
    const showPassword = passwordInput.type === 'password';
    passwordInput.type = showPassword ? 'text' : 'password';
    togglePassword.textContent = showPassword ? 'Hide' : 'Show';
    togglePassword.setAttribute('aria-pressed', String(showPassword));
});

loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    message.textContent = '';

    if (!loginForm.reportValidity()) return;

    const requiredRole = loginForm.dataset.role;   // 'ADMIN' or 'STAFF' (the portal toggle)
    const originalLabel = submitLabel.textContent;
    submitButton.disabled = true;
    submitLabel.textContent = 'Signing in...';

    try {
        const result = await CMS.login(usernameInput.value.trim(), passwordInput.value);

        // The portal toggle is only a convenience: the server decides the real role.
        const isAdmin = result.user.backendRole === 'ADMIN';
        if ((requiredRole === 'ADMIN' && !isAdmin) || (requiredRole === 'STAFF' && isAdmin)) {
            CMS.session.clear();
            message.textContent = 'This sign-in is not authorized for this workspace.';
            return;
        }

        window.location.assign(result.dashboard);
    } catch (error) {
        if (error.status === 401) {
            message.textContent = 'Sign-in failed. Please check your username and password.';
        } else if (error.status === 0) {
            message.textContent = error.message;            // server unreachable
        } else {
            message.textContent = 'Could not sign in: ' + error.message;
        }
    } finally {
        submitButton.disabled = false;
        submitLabel.textContent = originalLabel;
    }
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