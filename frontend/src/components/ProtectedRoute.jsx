import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) return <LoadingSpinner message="Checking session…" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user.account_status === 'pending') return <Navigate to="/pending" replace />;
  if (user.account_status === 'rejected') return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;

  return children;
}
