import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import authService from '../services/authService';
import { redirectToDashboard } from '../utils/redirectHelper';
import './OTPVerification.css';

function OTPVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';
  const userId = location.state?.userId || localStorage.getItem('temp_user_id') || '';
  const messageFromState = location.state?.message || '';
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  
  // Create refs for each input
  const inputRefs = useRef([]);

  // Timer for resend button
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  // Redirect if no email or userId provided
  useEffect(() => {
    if (!email || !userId) {
      navigate('/signin');
    }
  }, [email, userId, navigate]);

  const handleChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Clear error when user types
    if (error) setError('');
    if (successMessage) setSuccessMessage('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    // Handle paste
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      // Paste will be handled by handlePaste
      return;
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    
    // Only accept 6 digits
    if (/^\d{6}$/.test(pastedData)) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    
    // Check if all digits are entered
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Call verification API with user_id
      const response = await authService.verifyOTP(userId, otpCode);
      
      console.log('OTP verification response:', response);
      
      // Store token after successful OTP verification
      if (response.token) {
        localStorage.setItem('auth_token', response.token);
      }
      
      if (response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
      }
      
      // Clear temporary user_id
      localStorage.removeItem('temp_user_id');
      
      setSuccessMessage('OTP verified successfully! Redirecting...');
      
      setTimeout(() => {
        if (response.user?.role) {
          redirectToDashboard(navigate, response.user.role, { message: 'Welcome back!' });
        } else {
          navigate('/signin', { state: { message: 'Session expired. Please log in again.' } });
        }
      }, 1500);
      
    } catch (error) {
      console.error('OTP verification error:', error);
      
      if (error.message) {
        setError(error.message);
      } else {
        setError('Invalid OTP. Please try again.');
      }
      
      // Clear OTP on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Call resend OTP API with user_id
      const response = await authService.resendOTP(userId);
      
      console.log('Resend OTP response:', response);
      
      setSuccessMessage(response.message || 'OTP resent successfully! Check your email.');
      setResendTimer(60);
      setCanResend(false);
      
    } catch (error) {
      console.error('Resend OTP error:', error);
      setError(error.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToSignIn = () => {
    navigate('/signin');
  };

  return (
    <div className="otp-container">
      <div className="otp-card">
        <div className="logo">
          <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <span className="logo-text">PennyWise</span>
        </div>
        
        <div className="otp-header">
          <h1 className="title">Verify Your Email</h1>
          <p className="subtitle">
            {messageFromState || "We've sent a 6-digit verification code to"}<br />
            <strong>{email}</strong>
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="success-message">
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="error-message-box">
            {error}
          </div>
        )}

        <form onSubmit={handleVerify} className="otp-form">
          <div className="otp-inputs">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                maxLength="1"
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className={`otp-input ${error ? 'error' : ''}`}
                disabled={isLoading}
                autoFocus={index === 0}
              />
            ))}
          </div>

          <button 
            type="submit" 
            className="verify-button"
            disabled={isLoading || otp.join('').length !== 6}
          >
            {isLoading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>

        <div className="otp-footer">
          <p className="resend-text">
            Didn't receive the code?{' '}
            {canResend ? (
              <button 
                onClick={handleResend} 
                className="resend-button"
                disabled={isLoading}
              >
                Resend OTP
              </button>
            ) : (
              <span className="timer">
                Resend in {resendTimer}s
              </span>
            )}
          </p>

          <button 
            onClick={handleBackToSignIn} 
            className="back-button"
            disabled={isLoading}
          >
            ← Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

export default OTPVerification;