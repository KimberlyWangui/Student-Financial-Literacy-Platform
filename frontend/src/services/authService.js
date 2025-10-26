import api from '../api/axios';

// Authentication service functions
const authService = {
  // Register a new user
  register: async (userData) => {
    try {
      const response = await api.post('/register', {
        name: userData.name,
        email: userData.email,
        password: userData.password,
        password_confirmation: userData.password_confirmation
      });
      
      // If registration is successful, store token and user data
      if (response.data.token) {
        localStorage.setItem('auth_token', response.data.token);
      }
      
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return response.data;
    } catch (error) {
      // Handle errors
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      throw new Error('Registration failed. Please try again.');
    }
  },

  // Login user
  login: async (credentials) => {
    try {
      const response = await api.post('/login', {
        email: credentials.email,
        password: credentials.password
      });
      
      // The API returns: message, two_factor_required, user_id
      // We don't store token yet because 2FA is required
      
      return response.data;
    } catch (error) {
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      throw new Error('Login failed. Please check your credentials.');
    }
  },

  // Logout user
  // Logout user
logout: async () => {
  try {
    const token = localStorage.getItem('auth_token');
    
    // Only call API if we have a token
    if (token) {
      await api.post('/logout');
    }
    
    // Clear local storage regardless of API response
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('temp_user_id'); // Also clear temp user id
    
    return { message: 'Logged out successfully' };
  } catch (error) {
    // Even if API call fails, clear local storage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('temp_user_id');
    
    console.error('Logout error:', error);
    // Don't throw error, still return success since we cleared local storage
    return { message: 'Logged out successfully' };
  }
},

  // Get current user
  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    const token = localStorage.getItem('auth_token');
    return !!token;
  },

  // Get auth token
  getToken: () => {
    return localStorage.getItem('auth_token');
  },

  // Verify OTP
  verifyOTP: async (userId, otp) => {
    try {
      const response = await api.post('/verify-otp', {
        user_id: userId,
        otp: otp
      });
      
      // Store token after successful verification
      if (response.data.token) {
        localStorage.setItem('auth_token', response.data.token);
      }
      
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return response.data;
    } catch (error) {
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      throw new Error('OTP verification failed. Please try again.');
    }
  },

  // Resend OTP
  resendOTP: async (userId) => {
    try {
      const response = await api.post('/resend-otp', {
        user_id: userId
      });
      
      return response.data;
    } catch (error) {
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      throw new Error('Failed to resend OTP. Please try again.');
    }
  },

  // Google OAuth - Get redirect URL
  getGoogleAuthUrl: async () => {
    try {
      const response = await api.get('/auth/google');
      return response.data;
    } catch (error) {
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      throw new Error('Failed to initialize Google login.');
    }
  }
};

export default authService;