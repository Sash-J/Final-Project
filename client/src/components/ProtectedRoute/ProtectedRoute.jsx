import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/context/AuthContext';

const ProtectedRoute = ({ children, roles, permissions }) => {
    const { user, loading, hasRole, hasPermission } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="loading-screen">Verifying Access...</div>;
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (roles && !hasRole(roles)) {
        return <Navigate to="/" replace />;
    }

    if (permissions && !hasPermission(permissions)) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default ProtectedRoute;
