import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, user, booting } = useAuth();

  if (booting) {
    return <div className="center-loader">Loading workspace...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
