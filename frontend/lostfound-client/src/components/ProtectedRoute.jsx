import React from 'react';
import { Navigate } from 'react-router-dom';

// ProtectedRoute: reads auth from localStorage (app_jwt + lf_user), checks token expiry,
// and enforces optional role-based access (case-insensitive). Logs decisions to console for debugging.
export default function ProtectedRoute({ children, roles } = {}) {
  const token = localStorage.getItem('app_jwt');
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('lf_user') || 'null');
  } catch (e) {
    user = null;
  }

  if (!token || !user) {
    console.debug('[ProtectedRoute] unauthenticated - redirect to login', { tokenExists: !!token, user });
    return <Navigate to="/login" replace />;
  }

  // Check token expiry (best-effort)
  let payload = null;
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload && payload.exp && Date.now() >= payload.exp * 1000) {
        console.debug('[ProtectedRoute] token expired', { payload });
        localStorage.removeItem('app_jwt');
        localStorage.removeItem('lf_user');
        return <Navigate to="/login" replace />;
      }
    }
  } catch (err) {
    console.debug('[ProtectedRoute] token parse error', err);
    localStorage.removeItem('app_jwt');
    localStorage.removeItem('lf_user');
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0) {
    let roleName = user?.roleName || user?.role || null;
    if (!roleName && payload) {
      roleName = payload.role || (Array.isArray(payload.roles) ? payload.roles[0] : payload.roles) || payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || null;
    }

    console.debug('[ProtectedRoute] role check', { user, payload, roleName, requiredRoles: roles });

    if (!roleName) {
      return <Navigate to="/dashboard" replace />;
    }

    const roleLower = roleName.toString().toLowerCase();
    const allowed = roles.map(r => r.toString().toLowerCase());
    if (!allowed.includes(roleLower)) {
      console.debug('[ProtectedRoute] role not allowed', { roleName, allowed });
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}