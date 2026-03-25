import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const ProtectedRoute = ({ children, adminOnly = false, allowedRoles = null }) => {
  const { isAuthenticated, user, booting } = useAuth();

  if (booting) {
    return <div className="center-loader">Loading workspace...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/access" replace />;
  }

  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
