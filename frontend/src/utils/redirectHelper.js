/**
 * Get the appropriate dashboard route based on user role
 * @param {string} role - User role (admin, student, etc.)
 * @returns {string} - Dashboard route
 */
export const getDashboardRoute = (role) => {
  switch (role?.toLowerCase()) {
    case 'admin':
      return '/admin/dashboard';
    case 'student':
      return '/student/dashboard';
    default:
      return '/student/dashboard'; // Default to student dashboard
  }
};

/**
 * Redirect user to their dashboard based on role
 * @param {object} navigate - React Router navigate function
 * @param {string} role - User role
 * @param {object} state - Optional state to pass to dashboard
 */
export const redirectToDashboard = (navigate, role, state = {}) => {
  const route = getDashboardRoute(role);
  navigate(route, { state });
};

export default {
  getDashboardRoute,
  redirectToDashboard
};