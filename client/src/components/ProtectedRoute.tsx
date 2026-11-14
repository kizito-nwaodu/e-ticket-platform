import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading, hasRole, getPrimaryPortalPath } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Not logged in -> send to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If page is not meant for this role -> immediately redirect to their own portal
  if (allowedRoles && !hasRole(allowedRoles)) {
    const userHome = getPrimaryPortalPath(user);
    return <Navigate to={userHome} replace />;
  }

  return <>{children}</>;
};
