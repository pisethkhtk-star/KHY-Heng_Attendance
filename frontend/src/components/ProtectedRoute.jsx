import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, roles, resource }) => {
  const { user, loading, hasRole, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm font-medium text-slate-400 font-khmer">Checking authorization...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !hasRole(roles)) {
    return <Navigate to="/" replace />;
  }

  if (resource) {
    const resources = Array.isArray(resource) ? resource : [resource];
    const isAllowed = resources.some(res => hasPermission(res));
    if (!isAllowed) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
