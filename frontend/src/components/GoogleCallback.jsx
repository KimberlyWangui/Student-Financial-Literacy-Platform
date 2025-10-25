import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import authService from '../services/authService';
import { redirectToDashboard } from '../utils/redirectHelper';
import './GoogleCallback.css';

function GoogleCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the full callback URL with query parameters
        const callbackUrl = `/auth/google/callback${location.search}`;
        
        console.log('Processing Google callback:', callbackUrl);
        
        // Send callback to backend
        const response = await authService.handleGoogleCallback(callbackUrl);
        
        console.log('Google callback response:', response);
        
        // Check if user exists or needs registration
        if (response.token && response.user) {
          // User successfully logged in
          localStorage.setItem('auth_token', response.token);
          localStorage.setItem('user', JSON.stringify(response.user));
          
          // Redirect to dashboard
          setTimeout(() => {
            redirectToDashboard(navigate, response.user.role, {
              message: 'Welcome back!'
            });
          }, 1000);
        } else {
          // Something went wrong
          setError('Authentication failed. Please try again.');
          setTimeout(() => {
            navigate('/signin');
          }, 2000);
        }
        
      } catch (error) {
        console.error('Google callback error:', error);
        setError(error.message || 'Google authentication failed. Please try again.');
        
        setTimeout(() => {
          navigate('/signin', {
            state: { message: 'Google login failed. Please try again.' }
          });
        }, 2000);
      }
    };

    handleCallback();
  }, [location, navigate]);

  return (
    <div className="callback-container">
      <div className="callback-card">
        <div className="logo">
          <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <span className="logo-text">PennyWise</span>
        </div>

        {error ? (
          <div className="error-state">
            <svg className="error-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <h2>Authentication Failed</h2>
            <p>{error}</p>
            <p className="redirect-text">Redirecting to sign in...</p>
          </div>
        ) : (
          <div className="loading-state">
            <div className="spinner"></div>
            <h2>Completing Google Sign In</h2>
            <p>Please wait while we authenticate your account...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default GoogleCallback;