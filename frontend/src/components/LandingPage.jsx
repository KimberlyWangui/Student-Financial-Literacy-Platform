import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './LandingPage.css';
import HeroImage from '../assets/Hero.jpeg';

// Import icons
import { FaWallet, FaChartLine, FaLightbulb, FaTrophy } from 'react-icons/fa';

const LandingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get message from navigation state (from logout)
  const messageFromState = location.state?.message || '';
  const [showMessage, setShowMessage] = useState(!!messageFromState);

  // Auto-hide message after 5 seconds
  useEffect(() => {
    if (showMessage && messageFromState) {
      const timer = setTimeout(() => {
        setShowMessage(false);
        // Clear the location state to prevent message from showing on refresh
        window.history.replaceState({}, document.title);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [showMessage, messageFromState]);

  const handleGetStarted = () => {
    navigate('/signup');
  };

  const handleLearnMore = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSignUp = () => {
    navigate('/signup');
  };

  const handleLogIn = () => {
    navigate('/signin');
  };

  const handleCloseMessage = () => {
    setShowMessage(false);
    window.history.replaceState({}, document.title);
  };

  const features = [
    {
      icon: <FaWallet />,
      title: 'Smart Budgeting',
      description: 'Track income, expenses, and categorize spending to gain full control of your finances.'
    },
    {
      icon: <FaChartLine />,
      title: 'Investment Simulations',
      description: 'Experiment with various investment strategies in a risk-free environment and watch your wealth grow.'
    },
    {
      icon: <FaLightbulb />,
      title: 'Personalized Guidance',
      description: 'Receive tailored financial tips and actionable advice to build better money habits.'
    },
    {
      icon: <FaTrophy />,
      title: 'Goals & Rewards',
      description: 'Set financial goals, track your progress, and earn badges for every milestone achieved.'
    }
  ];

  return (
    <div className="landing-page">
      {/* Logout Success Message - Fixed at Top */}
      {showMessage && messageFromState && (
        <div className="logout-notification">
          <div className="notification-content">
            <svg 
              className="notification-icon" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M22 11.08V12a10 10 0 1 1-5.93-9.14" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <polyline 
                points="22 4 12 14.01 9 11.01" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
            <span className="notification-text">{messageFromState}</span>
            <button 
              onClick={handleCloseMessage}
              className="notification-close"
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Header/Navigation */}
      <header className="navbar">
        <div className="navbar-container">
          {/* SAME LOGO AS SIGNIN */}
          <div className="logo">
            <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span className="logo-text">PennyWise</span>
          </div>
          
          <div className="nav-buttons">
            <button onClick={handleSignUp} className="btn-signup">Sign Up</button>
            <button onClick={handleLogIn} className="btn-login">Log In</button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section" style={{ backgroundImage: `url(${HeroImage})` }}>
        <div className="hero-overlay">
          <div className="hero-content">
            <h1 className="hero-title">Unlock Your Financial Potential</h1>
            <p className="hero-subtitle">
              PennyWise empowers students with essential tools for budget management,
              investment simulation, and personalized financial guidance to build a secure future.
            </p>
            <div className="hero-buttons">
              <button onClick={handleGetStarted} className="btn-get-started">
                Get Started
              </button>
              <button onClick={handleLearnMore} className="btn-learn-more">
                Learn More
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <h2 className="features-title">Empowering Your Financial Journey</h2>
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-brand">
            {/* SAME LOGO AS SIGNIN IN FOOTER */}
            <div className="footer-logo">
              <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <p className="footer-tagline">
              Empowering students with financial literacy.
            </p>
            <div className="social-icons">
              <a href="#" aria-label="Facebook"><i className="fab fa-facebook"></i></a>
              <a href="#" aria-label="Twitter"><i className="fab fa-twitter"></i></a>
              <a href="#" aria-label="LinkedIn"><i className="fab fa-linkedin"></i></a>
              <a href="#" aria-label="Instagram"><i className="fab fa-instagram"></i></a>
            </div>
          </div>

          <div className="footer-links">
            <div className="footer-column">
              <h4>Company</h4>
              <ul>
                <li><a href="#">About</a></li>
                <li><a href="#">Careers</a></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4>Resources</h4>
              <ul>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Help Center</a></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4>Legal</h4>
              <ul>
                <li><a href="#">Terms of Service</a></li>
                <li><a href="#">Privacy Policy</a></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4>Contact Us</h4>
              <ul>
                <li><a href="#">Support</a></li>
                <li><a href="#">Sales</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2025 PennyWise. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;