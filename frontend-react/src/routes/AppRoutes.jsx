import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ROLES } from '../utils/constants';

// Layouts
import DashboardLayout from '../layouts/DashboardLayout';
import AuthLayout from '../layouts/AuthLayout';

// Components
import ProtectedRoute from '../components/ProtectedRoute';

// Pages
import LoginPage from '../pages/LoginPage';
import DashboardRedirect from '../pages/DashboardRedirect';
import UnauthorizedPage from '../pages/UnauthorizedPage';
import NotFoundPage from '../pages/NotFoundPage';

import DoctorDashboard from '../pages/doctor/DoctorDashboard';
import ReceptionistDashboard from '../pages/receptionist/ReceptionistDashboard';
import AdminDashboard from '../pages/admin/AdminDashboard';
import LabDashboard from '../pages/lab/LabDashboard';
import PharmacyDashboard from '../pages/pharmacy/PharmacyDashboard';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Root redirector based on authenticated role */}
      <Route path="/" element={<DashboardRedirect />} />

      {/* Public Auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
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
        <Route path="*" element={<DoctorDashboard />} />
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
        <Route path="*" element={<ReceptionistDashboard />} />
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
        <Route path="*" element={<AdminDashboard />} />
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
        <Route path="*" element={<LabDashboard />} />
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
        <Route path="*" element={<PharmacyDashboard />} />
      </Route>

      {/* Error / Fallback routes */}
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRoutes;
