# MedCore Clinic Management System — React + Vite Frontend

A modern, role-driven Single Page Application (SPA) for the Clinic Management System (CMS), built with React 19, Vite, React Router v7, and Vanilla CSS design tokens. Directly integrated with the Django REST Framework backend and MySQL database.

---

## 1. Project Architecture & Structure

```
frontend-react/
├── public/                  # Static assets & icons
├── src/
│   ├── assets/              # SVG vectors and imagery
│   ├── components/          # Reusable presentation and interactive components
│   │   ├── Badge.jsx            # Dynamic status indicators (success, warning, danger, info)
│   │   ├── DataTable.jsx        # Data table with loading skeletons & empty states
│   │   ├── Modal.jsx            # Accessible dialogs with ESC-key and backdrop-blur
│   │   ├── Navbar.jsx           # Top header bar with real-time calendar & user role badge
│   │   ├── ProtectedRoute.jsx   # Role-based route authorization & session guard
│   │   ├── Sidebar.jsx          # Role-driven navigation drawer
│   │   └── StatCard.jsx         # KPI metric card with trends and subtitles
│   ├── context/
│   │   └── AuthContext.jsx      # Global auth state, JWT tokens, session lifecycle
│   ├── hooks/
│   │   ├── useAuth.js           # Auth context consumer
│   │   └── useFetch.js          # Reusable asynchronous data fetcher hook
│   ├── layouts/
│   │   ├── AuthLayout.jsx       # Centered layout for staff login
│   │   └── DashboardLayout.jsx  # Main application shell (Sidebar + Navbar + Page Outlet)
│   ├── pages/
│   │   ├── admin/AdminDashboard.jsx               # System KPIs, accounts audit, doctor roster
│   │   ├── doctor/DoctorDashboard.jsx             # Clinical desk, consultations, prescriptions, lab orders
│   │   ├── lab/LabDashboard.jsx                   # Specimen intake, test analysis, findings entry
│   │   ├── pharmacy/PharmacyDashboard.jsx         # Prescriptions queue, medicine stock, dispensing
│   │   ├── receptionist/ReceptionistDashboard.jsx # Walk-in & advance booking, queue tokens, billing
│   │   ├── DashboardRedirect.jsx                  # Automatic role-based dashboard forwarding
│   │   ├── LoginPage.jsx                          # Authentication view with demo staff switcher
│   │   ├── NotFoundPage.jsx                       # 404 handler
│   │   └── UnauthorizedPage.jsx                   # 403 insufficient permission view
│   ├── routes/
│   │   └── AppRoutes.jsx        # Route tree with role enforcement
│   ├── services/
│   │   ├── apiClient.js         # Centralized Fetch client with JWT injection & refresh
│   │   ├── authService.js       # Login, token storage, and logout
│   │   ├── adminService.js      # Admin dashboard, users, and catalog APIs
│   │   ├── doctorService.js     # Doctor appointments, consultations, and medical history
│   │   ├── labService.js        # Lab orders, sample collection, and diagnostic results
│   │   ├── pharmacyService.js   # Prescriptions queue, dispense, and stock inventory
│   │   └── receptionistService.js # Receptionist booking, doctor slots, tokens, and billing
│   ├── styles/
│   │   ├── dashboard.css        # Layout, sidebar, and workspace styles
│   │   ├── globals.css          # Design system classes, cards, buttons, tables
│   │   └── variables.css        # Colors, radii, typography, elevation tokens
│   ├── utils/
│   │   ├── constants.js         # User roles, status definitions, dashboard routes
│   │   └── formatters.js        # Currency (INR), dates, times, and badge styles
│   ├── App.jsx                  # Root application component
│   └── main.jsx                 # Client entrypoint
├── .env.example             # Environment variable template
├── package.json             # NPM dependencies and scripts
└── vite.config.js           # Vite dev server and proxy configuration
```

---

## 2. Prerequisites

- **Node.js**: v18.0 or higher
- **npm**: v9.0 or higher
- **Backend Service**: Django REST Framework running at `http://127.0.0.1:8000`

---

## 3. Installation & Setup

1. Navigate to the `frontend-react` folder:
   ```bash
   cd frontend-react
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Configure environment variables:
   Copy `.env.example` to `.env` if custom backend URL is desired:
   ```bash
   cp .env.example .env
   ```
   *Default:* Requests to `/api` are automatically proxied to `http://127.0.0.1:8000` via [vite.config.js](file:///Users/tharunsrijit/Documents/CMS/frontend-react/vite.config.js).

---

## 4. Running the Development Server

Start the Vite development server with Hot Module Replacement (HMR):
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## 5. Building for Production

Compile optimized production assets into `dist/`:
```bash
npm run build
```

Preview the production build locally:
```bash
npm run preview
```

---

## 6. Authentication & Roles

Authentication uses standard JWT tokens (`access` and `refresh`) obtained from `/api/auth/login/`.

Available Roles and Dashboards:
- **`ADMIN`** (`/admin`): Clinic oversight, user provisioning, doctor roster, and master catalogs.
- **`DOCTOR`** (`/doctor`): Strictly isolated to the logged-in doctor's assigned appointments, clinical consultations, e-prescriptions, and diagnostic orders.
- **`RECEPTIONIST`** (`/receptionist`): Patient directory, Walk-in (today only) and Advance (1-7 days ahead) booking with real-time slot validation, patient check-in, token issuance, and consultation billing.
- **`LAB_TECHNICIAN`** (`/lab`): Specimen collection, processing pipeline, and pathologist findings entry.
- **`PHARMACIST`** (`/pharmacy`): Prescriptions fulfillment, medicine stock batches, and dispensing with automatic inventory deduction.

---

## 7. Business Logic & Scheduling Rules Enforced

- **Walk-in Appointments**:
  - Valid strictly for the current local clinic date.
  - Expired or past slots are locked and cannot be selected.
- **Advance Appointments**:
  - Valid from tomorrow up to 7 days ahead.
  - Slots are fetched live from `/api/receptionist/doctors/{id}/slots/?type=ADVANCE&date={date}`.
- **Arrival Confirmation vs Booking**:
  - Booking reserves the doctor slot.
  - Token issuance occurs upon patient check-in (`/appointments/{id}/check_in/`).
- **Doctor Appointment Isolation**:
  - Doctor appointments are fetched strictly via `/api/doctor/appointments/` ensuring physicians only see their own appointments.
