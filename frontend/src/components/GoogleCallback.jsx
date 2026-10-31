import { useEffect,useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { redirectToDashboard } from '../utils/redirectHelper';
import './GoogleCallback.css';
import api from '../api/axios';

function GoogleCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const handled = useRef(false); // the code works once, so only run the exchange once

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const fail = (text) => {
      setError(text);
      setTimeout(() => {
        navigate('/signin', { state: { message: 'Google login failed. Please try again.' } });
      }, 2000);
    };

    const run = async () => {
      const params = new URLSearchParams(location.search);
      const errorParam = params.get('error');
      const code = params.get('code');

      // Take the code out of the address bar straight away.
      window.history.replaceState({}, '', '/auth/google/success');

      if (errorParam) {
        fail(decodeURIComponent(errorParam));
        return;
      }
      if (!code) {
        fail('No authentication data received');
        return;
      }

      try {
        const { data } = await api.post('/auth/google/exchange', { code });
        if (!data.token || !data.user) throw new Error('Invalid data');

        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        const userRole = data.user.role || data.role || 'student';
        redirectToDashboard(navigate, userRole, { message: 'Welcome back!' });
      } catch {
        fail('This sign-in has expired. Please try again.');
      }
    };

    run();
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