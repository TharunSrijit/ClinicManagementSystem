import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { ROLE_DASHBOARDS } from '../utils/constants';

export const DashboardRedirect = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const target = ROLE_DASHBOARDS[user.role] || '/unauthorized';
  return <Navigate to={target} replace />;
};

export default DashboardRedirect;
