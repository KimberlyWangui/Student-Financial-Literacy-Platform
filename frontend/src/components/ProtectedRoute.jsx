import { Navigate } from 'react-router-dom';
import authService from '../services/authService';

function ProtectedRoute({ children, allowedRoles = [] }) {
  const isAuthenticated = authService.isAuthenticated();
  const user = authService.getCurrentUser();

  // If not authenticated, redirect to signin
  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  // If allowedRoles is specified and user's role is not in the list, redirect
  if (allowedRoles.length > 0 && user) {
    const userRole = user.role || 'student'; // Default to student if no role
    
    if (!allowedRoles.includes(userRole)) {
      // Redirect to appropriate dashboard based on their actual role
      if (userRole === 'admin') {
        return <Navigate to="/admin/dashboard" replace />;
      } else {
        return <Navigate to="/student/dashboard" replace />;
      }
    }
  }

  // User is authenticated and has correct role
  return children;
}

export default ProtectedRoute;