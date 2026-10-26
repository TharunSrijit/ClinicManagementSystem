import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ROLES } from '../utils/constants';

// Layouts
import DashboardLayout from '../layouts/DashboardLayout';
import AuthLayout from '../layouts/AuthLayout';

// Components
import ProtectedRoute from '../components/ProtectedRoute';

// Public & Error Pages
import LoginPage from '../pages/LoginPage';
import DashboardRedirect from '../pages/DashboardRedirect';
import UnauthorizedPage from '../pages/UnauthorizedPage';
import NotFoundPage from '../pages/NotFoundPage';

// Receptionist Pages
import ReceptionistDashboard from '../pages/receptionist/ReceptionistDashboard';
import ReceptionistAppointmentsPage from '../pages/receptionist/ReceptionistAppointmentsPage';
import BookAppointmentPage from '../pages/receptionist/BookAppointmentPage';
import ReceptionistTokensPage from '../pages/receptionist/ReceptionistTokensPage';
import ReceptionistPatientsPage from '../pages/receptionist/ReceptionistPatientsPage';
import RegisterPatientPage from '../pages/receptionist/RegisterPatientPage';
import PatientDetailsPage from '../pages/receptionist/PatientDetailsPage';
import ReceptionistBillingPage from '../pages/receptionist/ReceptionistBillingPage';

// Doctor Pages
import DoctorDashboard from '../pages/doctor/DoctorDashboard';
import DoctorAppointmentsPage from '../pages/doctor/DoctorAppointmentsPage';
import DoctorQueuePage from '../pages/doctor/DoctorQueuePage';
import DoctorPatients from '../pages/doctor/DoctorPatients';
import DoctorPatientDetails from '../pages/doctor/DoctorPatientDetails';
import DoctorConsultationsPage from '../pages/doctor/DoctorConsultationsPage';
import DoctorPrescriptionsPage from '../pages/doctor/DoctorPrescriptionsPage';
import DoctorLabOrdersPage from '../pages/doctor/DoctorLabOrdersPage';
import DoctorMedicinesPage from '../pages/doctor/DoctorMedicinesPage';

// Admin Pages
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminUsersPage from '../pages/admin/AdminUsersPage';
import AdminDoctorsPage from '../pages/admin/AdminDoctorsPage';
import AdminStaffPage from '../pages/admin/AdminStaffPage';
import AdminMedicinesPage from '../pages/admin/AdminMedicinesPage';
import AdminLabTestsPage from '../pages/admin/AdminLabTestsPage';

// Lab Pages
import LabDashboard from '../pages/lab/LabDashboard';
import LabOrdersPage from '../pages/lab/LabOrdersPage';
import LabResultsPage from '../pages/lab/LabResultsPage';
import LabBillingPage from '../pages/lab/LabBillingPage';

// Pharmacy Pages
import PharmacyDashboard from '../pages/pharmacy/PharmacyDashboard';
import PharmacyPrescriptionsPage from '../pages/pharmacy/PharmacyPrescriptionsPage';
import PharmacyDispensesPage from '../pages/pharmacy/PharmacyDispensesPage';
import PharmacyStockPage from '../pages/pharmacy/PharmacyStockPage';
import PharmacyBillingPage from '../pages/pharmacy/PharmacyBillingPage';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Root redirector based on authenticated role */}
      <Route path="/" element={<DashboardRedirect />} />

      {/* Public Auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Protected Receptionist routes */}
      <Route
        path="/receptionist"
        element={
          <ProtectedRoute allowedRoles={[ROLES.RECEPTIONIST, ROLES.ADMIN]}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ReceptionistDashboard />} />
        <Route path="appointments" element={<ReceptionistAppointmentsPage />} />
        <Route path="appointments/book" element={<BookAppointmentPage />} />
        <Route path="tokens" element={<ReceptionistTokensPage />} />
        <Route path="queue" element={<ReceptionistTokensPage />} />
        <Route path="patients" element={<ReceptionistPatientsPage />} />
        <Route path="patients/register" element={<RegisterPatientPage />} />
        <Route path="patients/:id" element={<PatientDetailsPage />} />
        <Route path="billing" element={<ReceptionistBillingPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Protected Doctor routes */}
      <Route
        path="/doctor"
        element={
          <ProtectedRoute allowedRoles={[ROLES.DOCTOR, ROLES.ADMIN]}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DoctorDashboard />} />
        <Route path="appointments" element={<DoctorAppointmentsPage />} />
        <Route path="queue" element={<DoctorQueuePage />} />
        <Route path="patients" element={<DoctorPatients />} />
        <Route path="patients/:id" element={<DoctorPatientDetails />} />
        <Route path="consultations" element={<DoctorConsultationsPage />} />
        <Route path="prescriptions" element={<DoctorPrescriptionsPage />} />
        <Route path="lab-orders" element={<DoctorLabOrdersPage />} />
        <Route path="medicines" element={<DoctorMedicinesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Protected Admin routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="doctors" element={<AdminDoctorsPage />} />
        <Route path="staff" element={<AdminStaffPage />} />
        <Route path="medicines" element={<AdminMedicinesPage />} />
        <Route path="lab-tests" element={<AdminLabTestsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Protected Lab routes */}
      <Route
        path="/lab"
        element={
          <ProtectedRoute allowedRoles={[ROLES.LAB_TECHNICIAN, ROLES.ADMIN]}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<LabDashboard />} />
        <Route path="orders" element={<LabOrdersPage />} />
        <Route path="results" element={<LabResultsPage />} />
        <Route path="billing" element={<LabBillingPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Protected Pharmacy routes */}
      <Route
        path="/pharmacy"
        element={
          <ProtectedRoute allowedRoles={[ROLES.PHARMACIST, ROLES.ADMIN]}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<PharmacyDashboard />} />
        <Route path="prescriptions" element={<PharmacyPrescriptionsPage />} />
        <Route path="dispenses" element={<PharmacyDispensesPage />} />
        <Route path="stock" element={<PharmacyStockPage />} />
        <Route path="billing" element={<PharmacyBillingPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Error / Fallback routes */}
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRoutes;
