import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { redirectToDashboard } from '../utils/redirectHelper';
import './GoogleCallback.css';

function GoogleCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCallback = () => {
      try {
        const urlParams = new URLSearchParams(location.search);
        const encodedData = urlParams.get('data');
        const errorParam = urlParams.get('error');

        if (errorParam) {
          setError(decodeURIComponent(errorParam));
          setTimeout(() => {
            navigate('/signin', { state: { message: 'Google login failed. Please try again.' } });
          }, 2000);
          return;
        }

        if (!encodedData) {
          setError('No authentication data received');
          setTimeout(() => navigate('/signin'), 2000);
          return;
        }

        const decodedData = JSON.parse(atob(encodedData));

        if (!decodedData.token || !decodedData.user) {
          setError('Invalid authentication data received');
          setTimeout(() => navigate('/signin'), 2000);
          return;
        }

        localStorage.setItem('auth_token', decodedData.token);
        localStorage.setItem('user', JSON.stringify(decodedData.user));

        const userRole = decodedData.user?.role || decodedData.role || 'student';

        setTimeout(() => {
          redirectToDashboard(navigate, userRole, { message: 'Welcome back!' });
        }, 1000);
      } catch {
        setError('Failed to process authentication data');
        setTimeout(() => {
          navigate('/signin', { state: { message: 'Google login failed. Please try again.' } });
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