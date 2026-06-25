import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Route-level gate: renders children only if the user holds `perm`
 * (a permission key like "subscriptions.view"); otherwise sends to /no-access.
 * Pair with menu-visibility filtering in the Sidebar — this is the enforcement.
 */
const RequirePermission: React.FC<{ perm: string; children: React.ReactElement }> = ({ perm, children }) => {
    const allowed = useAuthStore((s) => s.permissions.includes(perm));
    return allowed ? children : <Navigate to="/no-access" replace />;
};

export default RequirePermission;
