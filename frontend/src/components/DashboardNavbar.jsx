import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import './DashboardNavbar.css';

const DashboardNavbar = ({ activePage = 'Dashboard' }) => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef(null);
  
  // Get first letter of user's name
  const getInitial = () => {
    if (user?.name) {
      return user.name.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const navLinks = [
    { name: 'Dashboard', path: '/student/dashboard' },
    { name: 'Finance Hub', path: '/finance-hub' },
    { name: 'Budgets', path: '/budgets' },
    { name: 'Simulation', path: '/simulation' },
    { name: 'Recommendations', path: '/recommendations' },
    { name: 'Goals & Badges', path: '/goals' }
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    setShowDropdown(false);
    
    try {
      await authService.logout();
      navigate('/', { 
        replace: true,
        state: { message: 'You have been logged out successfully.' }
      });
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleProfileClick = () => {
    setShowDropdown(false);
    navigate('/profile-settings');
  };

  return (
    <nav className="dashboard-navbar">
      <div className="dashboard-navbar-container">
        {/* Logo */}
        <div className="dashboard-logo" onClick={() => navigate('/')}>
          <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </div>

        {/* Navigation Links */}
        <div className="nav-links">
          {navLinks.map((link) => (
            <button
              key={link.name}
              onClick={() => navigate(link.path)}
              className={`nav-link ${activePage === link.name ? 'active' : ''}`}
            >
              {link.name}
            </button>
          ))}
        </div>

        {/* User Section with Dropdown */}
        <div className="nav-user-section" ref={dropdownRef}>
          <div 
            className="user-avatar"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            {getInitial()}
          </div>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="dropdown-menu">
              {/* User Info */}
              <div className="dropdown-header">
                <div className="dropdown-avatar">
                  {getInitial()}
                </div>
                <div className="dropdown-user-info">
                  <p className="dropdown-name">{user?.name || 'User'}</p>
                  <p className="dropdown-email">{user?.email || 'user@example.com'}</p>
                </div>
              </div>

              <div className="dropdown-divider"></div>

              {/* Profile & Settings */}
              <button 
                className="dropdown-item"
                onClick={handleProfileClick}
              >
                <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Profile & Settings
              </button>

              <div className="dropdown-divider"></div>

              {/* Logout */}
              <button 
                className="dropdown-item logout"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default DashboardNavbar;