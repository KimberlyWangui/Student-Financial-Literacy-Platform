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
      // DEBUG LOGS
      console.log('=== GOOGLE CALLBACK DEBUG ===');
      console.log('1. Full URL:', window.location.href);
      console.log('2. Search params:', location.search);
      
      try {
        // Get data from URL parameters (sent by Laravel backend)
        const urlParams = new URLSearchParams(location.search);
        const encodedData = urlParams.get('data');
        const errorParam = urlParams.get('error');
        
        console.log('3. Encoded data:', encodedData ? 'EXISTS' : 'NULL');
        console.log('4. Error param:', errorParam);
        
        // Check if there's an error from backend
        if (errorParam) {
          console.log('5. Has error parameter');
          setError(decodeURIComponent(errorParam));
          setTimeout(() => {
            navigate('/signin', {
              state: { message: 'Google login failed. Please try again.' }
            });
          }, 2000);
          return;
        }

        // Check if we have data
        if (!encodedData) {
          console.log('6. No encoded data found!');
          setError('No authentication data received');
          setTimeout(() => {
            navigate('/signin');
          }, 2000);
          return;
        }

        // Decode the base64 data from backend
        const decodedData = JSON.parse(atob(encodedData));
        
        console.log('7. Decoded data:', decodedData);
        console.log('8. Token exists:', !!decodedData.token);
        console.log('9. User exists:', !!decodedData.user);
        console.log('10. User role:', decodedData.user?.role || decodedData.role);
        
        // Validate that we have required data
        if (!decodedData.token || !decodedData.user) {
          console.log('11. Missing token or user!');
          setError('Invalid authentication data received');
          setTimeout(() => {
            navigate('/signin');
          }, 2000);
          return;
        }

        // Store token and user data in localStorage
        localStorage.setItem('auth_token', decodedData.token);
        localStorage.setItem('user', JSON.stringify(decodedData.user));
        
        console.log('12. Token and user stored in localStorage');
        console.log('13. Stored token:', localStorage.getItem('auth_token'));
        console.log('14. Stored user:', localStorage.getItem('user'));
        
        const userRole = decodedData.user?.role || decodedData.role || 'student';
        console.log('15. Final user role:', userRole);
        console.log('16. About to redirect to dashboard...');
        
        // Redirect to appropriate dashboard based on role
        setTimeout(() => {
          console.log('17. Calling redirectToDashboard with role:', userRole);
          redirectToDashboard(navigate, userRole, {
            message: 'Welcome back!'
          });
        }, 1000);
        
      } catch (error) {
        console.error('ERROR in callback:', error);
        console.error('Error stack:', error.stack);
        setError('Failed to process authentication data');
        
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