// ============================================================
// CMS - API LAYER (replaces localStorage as the data source)
// File: js/api.js
//
// Load this BEFORE any other page script:
//   <script src="../js/api.js"></script>
//
// Usage on any page:
//   CMS.requireRole('receptionist', 'admin');            // guard
//   const patients = await CMS.api.list('/receptionist/patients/', { search: 'ann' });
//   await CMS.api.post('/receptionist/patients/', { first_name: 'Ann', ... });
// ============================================================
(function () {

    // Change this one line when the backend moves (or set window.CMS_API_BASE first)
    const API_BASE = window.CMS_API_BASE || 'http://127.0.0.1:8000/api';

    // URL of the frontend root, works from any subfolder (admin/, doctor/, ...)
    const ROOT_URL = document.currentScript.src.replace(/js\/api\.js.*$/, '');

    // Backend role -> the lowercase role the existing pages already check
    const ROLE_TO_UI = {
        ADMIN: 'admin', RECEPTIONIST: 'receptionist', DOCTOR: 'doctor',
        LAB_TECHNICIAN: 'lab', PHARMACIST: 'pharmacist'
    };
    const DASHBOARD = {
        ADMIN: 'admin/dashboard.html', RECEPTIONIST: 'receptionist/dashboard.html',
        DOCTOR: 'doctor/dashboard.html', LAB_TECHNICIAN: 'lab/dashboard.html',
        PHARMACIST: 'pharmacy/dashboard.html'
    };

    // ---------------- session (same keys the old code used) ----------------
    const session = {
        get access() { return localStorage.getItem('fd_access'); },
        get refresh() { return localStorage.getItem('fd_refresh'); },
        get user() {
            try { return JSON.parse(localStorage.getItem('loggedInUser') || 'null'); }
            catch (e) { return null; }
        },
        clear() {
            ['fd_access', 'fd_refresh', 'fd_name', 'loggedInUser']
                .forEach(k => localStorage.removeItem(k));
        }
    };

    function goToLogin() { window.location.assign(ROOT_URL + 'index.html'); }

    // ---------------- errors ----------------
    class ApiError extends Error {
        constructor(message, status, data) {
            super(message);
            this.name = 'ApiError';
            this.status = status;   // 0 = server unreachable
            this.data = data;       // raw error body, e.g. { appointment_date: ['...'] }
        }
    }

    // Turns DRF error bodies ({detail} or {field: [msgs]}) into readable text
    function errorMessage(data, status) {
        if (!data) return 'Request failed (' + status + ').';
        if (typeof data === 'string') return data;
        if (data.detail) return String(data.detail);
        return Object.entries(data).map(function (entry) {
            const key = entry[0], val = entry[1];
            const text = Array.isArray(val) ? val.join(' ')
                : (typeof val === 'object' ? JSON.stringify(val) : String(val));
            return key === 'non_field_errors' ? text : key + ': ' + text;
        }).join('\n');
    }

    // ---------------- token refresh (shared, so parallel 401s refresh once) ----------------
    let refreshing = null;
    function refreshAccess() {
        if (!session.refresh) return Promise.resolve(false);
        if (!refreshing) {
            refreshing = fetch(API_BASE + '/auth/token/refresh/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh: session.refresh })
            }).then(async function (res) {
                if (!res.ok) return false;
                const data = await res.json();
                localStorage.setItem('fd_access', data.access);
                if (data.refresh) localStorage.setItem('fd_refresh', data.refresh);
                return true;
            }).catch(function () { return false; })
                .finally(function () { refreshing = null; });
        }
        return refreshing;
    }

    // ---------------- core request ----------------
    async function request(path, options, canRetry) {
        options = options || {};
        const method = options.method || 'GET';
        const auth = options.auth !== false;

        let url = API_BASE + path;
        if (options.query) {
            const q = new URLSearchParams();
            Object.entries(options.query).forEach(function (e) {
                if (e[1] !== undefined && e[1] !== null && e[1] !== '') q.append(e[0], e[1]);
            });
            if ([...q].length) url += (url.includes('?') ? '&' : '?') + q.toString();
        }

        const headers = {};
        const hasBody = options.body !== undefined;
        if (hasBody) headers['Content-Type'] = 'application/json';
        if (auth && session.access) headers['Authorization'] = 'Bearer ' + session.access;

        let res;
        try {
            res = await fetch(url, {
                method: method, headers: headers,
                body: hasBody ? JSON.stringify(options.body) : undefined
            });
        } catch (e) {
            throw new ApiError('Cannot reach the server. Is the backend running?', 0, null);
        }

        // Expired access token: refresh once and retry, otherwise go back to login
        if (res.status === 401 && auth && canRetry !== false) {
            if (await refreshAccess()) return request(path, options, false);
            session.clear();
            goToLogin();
            throw new ApiError('Your session has expired. Please sign in again.', 401, null);
        }

        let data = null;
        const text = await res.text();
        if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }

        if (!res.ok) throw new ApiError(errorMessage(data, res.status), res.status, data);
        return data;
    }

    const api = {
        get: (path, query) => request(path, { query: query }),
        post: (path, body) => request(path, { method: 'POST', body: body === undefined ? {} : body }),
        put: (path, body) => request(path, { method: 'PUT', body: body }),
        patch: (path, body) => request(path, { method: 'PATCH', body: body }),
        delete: (path) => request(path, { method: 'DELETE' }),
        // Always returns an array, whether or not the backend paginates
        list: async function (path, query) {
            const data = await request(path, { query: query });
            return Array.isArray(data) ? data : (data && data.results) || [];
        },
        raw: request
    };

    // ---------------- login / logout / guard ----------------
    async function login(username, password) {
        const data = await request('/auth/login/', {
            method: 'POST', auth: false,
            body: { username: username, password: password }
        });

        localStorage.setItem('fd_access', data.access);
        localStorage.setItem('fd_refresh', data.refresh);
        localStorage.setItem('fd_name', data.full_name || data.username);

        const uiRole = ROLE_TO_UI[data.role] || String(data.role || '').toLowerCase();
        const user = {
            id: data.user_id, userId: data.user_id, doctorId: null,
            username: data.username,
            name: data.full_name || data.username,
            fullName: data.full_name || data.username,
            role: uiRole, userRole: uiRole, backendRole: data.role,
            profileId: null, profileType: null
        };

        // Doctor pages need the doctor profile id (appointments etc. use it)
        if (data.role === 'DOCTOR') {
            try {
                const profiles = await api.list('/doctor/profile/');
                if (profiles[0]) {
                    user.doctorId = profiles[0].id;
                    user.profileId = profiles[0].id;
                    user.profileType = 'doctor';
                }
            } catch (e) { /* login still succeeds; doctor pages will report missing profile */ }
        }

        localStorage.setItem('loggedInUser', JSON.stringify(user));
        return { user: user, dashboard: DASHBOARD[data.role] };
    }

    async function logout() {
        try {
            if (session.refresh) await request('/auth/logout/', { method: 'POST', body: { refresh: session.refresh } });
        } catch (e) { /* even if the server call fails, sign out locally */ }
        session.clear();
        goToLogin();
    }

    // Call at the top of every protected page. Replaces the old inline AUTH GUARD.
    function requireRole() {
        const allowed = Array.prototype.slice.call(arguments);
        const user = session.user;
        if (!session.access || !user || (allowed.length && allowed.indexOf(user.role) === -1)) {
            goToLogin();
            return null;
        }
        return user;
    }

    window.CMS = {
        api: api, session: session, login: login, logout: logout, requireRole: requireRole,
        ApiError: ApiError, ROOT_URL: ROOT_URL, API_BASE: API_BASE,
        ROLE_TO_UI: ROLE_TO_UI, DASHBOARD: DASHBOARD
    };
})();