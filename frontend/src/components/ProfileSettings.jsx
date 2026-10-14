import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import DashboardNavbar from '../components/DashboardNavbar';
import DashboardFooter from '../components/DashboardFooter';
import api from '../api/axios';
import './ProfileSettings.css';

const ProfileSettings = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || ''
  });

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    new_password_confirmation: ''
  });

  const [studentProfileData, setStudentProfileData] = useState({
    year_of_study: '',
    living_situation: '',
    monthly_allowance_range: '',
    course: '',
    birth_date: '',
    gender: ''
  });

  const [metadata, setMetadata] = useState({
    allowance_ranges: [],
    gender_options: [],
    years_of_study: [],
    living_situations: []
  });

  const [hasStudentProfile, setHasStudentProfile] = useState(false);
  const [studentProfileId, setStudentProfileId] = useState(null);

  // Fetch metadata and student profile on component mount
  useEffect(() => {
    if (user?.role === 'student') {
      fetchMetadata();
      fetchStudentProfile();
    }
  }, []);

  const fetchMetadata = async () => {
    try {
      const response = await api.get('/student-profiles/metadata');
      if (response.data && response.data.data) {
        setMetadata(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching metadata:', err);
    }
  };

  const fetchStudentProfile = async () => {
    try {
      const response = await api.get('/student-profiles/me');
      
      if (response.data && response.data.data) {
        const profile = response.data.data;
        setStudentProfileData({
          year_of_study: profile.year_of_study || '',
          living_situation: profile.living_situation || '',
          monthly_allowance_range: profile.monthly_allowance_range || '',
          course: profile.course || '',
          birth_date: profile.birth_date || '',
          gender: profile.gender || ''
        });
        setHasStudentProfile(true);
        setStudentProfileId(profile.profile_id);
      }
    } catch (err) {
      console.log('No student profile found or error fetching:', err);
      setHasStudentProfile(false);
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
    clearMessages();
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
    clearMessages();
  };

  const handleStudentProfileChange = (e) => {
    const { name, value } = e.target;
    setStudentProfileData(prev => ({
      ...prev,
      [name]: value
    }));
    clearMessages();
  };

  const clearMessages = () => {
    setMessage('');
    setError('');
  };

  // Update Profile Information (Name & Email)
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();

    try {
      const response = await api.patch(`/users/${user.id}`, {
        name: profileData.name,
        email: profileData.email
      });

      // Update local storage with new user data
      const updatedUser = { ...user, name: profileData.name, email: profileData.email };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setMessage('Profile updated successfully!');
      
      // Reload page after 2 seconds to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Profile update error:', err);
      setError(err.response?.data?.message || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Change Password
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();

    // Validate passwords match
    if (passwordData.new_password !== passwordData.new_password_confirmation) {
      setError('New passwords do not match.');
      setLoading(false);
      return;
    }

    // Validate password length
    if (passwordData.new_password.length < 8) {
      setError('New password must be at least 8 characters long.');
      setLoading(false);
      return;
    }

    try {
      await api.patch(`/users/${user.id}`, {
        password: passwordData.new_password,
        password_confirmation: passwordData.new_password_confirmation
      });

      setMessage('Password updated successfully!');
      
      // Clear password fields
      setPasswordData({
        current_password: '',
        new_password: '',
        new_password_confirmation: ''
      });
    } catch (err) {
      console.error('Password update error:', err);
      setError(err.response?.data?.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Create or Update Student Profile
  const handleStudentProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();

    try {
      let response;
      
      if (hasStudentProfile && studentProfileId) {
        // Update existing profile (PUT or PATCH)
        response = await api.put(`/student-profiles/${studentProfileId}`, studentProfileData);
        setMessage('Student profile updated successfully!');
      } else {
        // Create new profile (POST)
        response = await api.post('/student-profiles', studentProfileData);
        setMessage('Student profile created successfully!');
        setHasStudentProfile(true);
        setStudentProfileId(response.data.data.profile_id);
      }

      // Refresh profile data after successful save
      await fetchStudentProfile();
      
    } catch (err) {
      console.error('Student profile error:', err);
      if (err.response?.data?.errors) {
        const errors = Object.values(err.response.data.errors).flat();
        setError(errors.join(', '));
      } else {
        setError(err.response?.data?.message || 'Failed to save student profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-settings-page">
      <DashboardNavbar activePage="Profile" />
      
      <main className="profile-main">
        <div className="profile-container">
          <h1 className="profile-title">Profile & Settings</h1>
          <p className="profile-subtitle">Manage your account information and preferences</p>

          {/* Success/Error Messages */}
          {message && (
            <div className="alert alert-success">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              {message}
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {error}
            </div>
          )}

          {/* Tabs */}
          <div className="profile-tabs">
            <button 
              className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              Profile Information
            </button>
            <button 
              className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              Security
            </button>
            {user?.role === 'student' && (
              <button 
                className={`tab-btn ${activeTab === 'student-profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('student-profile')}
              >
                Student Profile
              </button>
            )}
          </div>

          {/* Profile Information Tab */}
          {activeTab === 'profile' && (
            <div className="profile-card">
              <h2 className="card-title">Personal Information</h2>
              <p className="card-description">Update your name and email address</p>
              
              <form onSubmit={handleProfileUpdate} className="profile-form">
                <div className="form-group">
                  <label htmlFor="name">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={profileData.name}
                    onChange={handleProfileChange}
                    placeholder="Enter your full name"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={profileData.email}
                    onChange={handleProfileChange}
                    placeholder="Enter your email"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Account Type</label>
                  <input
                    type="text"
                    value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Student'}
                    disabled
                    className="disabled-input"
                  />
                </div>

                <button type="submit" className="save-btn" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="profile-card">
              <h2 className="card-title">Change Password</h2>
              <p className="card-description">Update your password to keep your account secure</p>
              
              <form onSubmit={handlePasswordUpdate} className="profile-form">
                <div className="form-group">
                  <label htmlFor="new_password">New Password</label>
                  <input
                    type="password"
                    id="new_password"
                    name="new_password"
                    value={passwordData.new_password}
                    onChange={handlePasswordChange}
                    placeholder="Enter new password (min 8 characters)"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="new_password_confirmation">Confirm New Password</label>
                  <input
                    type="password"
                    id="new_password_confirmation"
                    name="new_password_confirmation"
                    value={passwordData.new_password_confirmation}
                    onChange={handlePasswordChange}
                    placeholder="Confirm new password"
                    required
                    disabled={loading}
                  />
                </div>

                <button type="submit" className="save-btn" disabled={loading}>
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          )}

          {/* Student Profile Tab */}
          {activeTab === 'student-profile' && user?.role === 'student' && (
            <div className="profile-card">
              <h2 className="card-title">Student Profile</h2>
              <p className="card-description">
                {hasStudentProfile 
                  ? 'Update your academic and personal information' 
                  : 'Create your student profile to get personalized recommendations'}
              </p>
              
              <form onSubmit={handleStudentProfileSubmit} className="profile-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="year_of_study">Year of Study *</label>
                    <select
                      id="year_of_study"
                      name="year_of_study"
                      value={studentProfileData.year_of_study}
                      onChange={handleStudentProfileChange}
                      required
                      disabled={loading}
                    >
                      <option value="">Select year</option>
                      {metadata.years_of_study.map(year => (
                        <option key={year} value={year}>
                          Year {year.charAt(0).toUpperCase() + year.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="living_situation">Living Situation *</label>
                    <select
                      id="living_situation"
                      name="living_situation"
                      value={studentProfileData.living_situation}
                      onChange={handleStudentProfileChange}
                      required
                      disabled={loading}
                    >
                      <option value="">Select living situation</option>
                      {metadata.living_situations.map(situation => (
                        <option key={situation} value={situation}>
                          {situation}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="monthly_allowance_range">Monthly Allowance Range *</label>
                  <select
                    id="monthly_allowance_range"
                    name="monthly_allowance_range"
                    value={studentProfileData.monthly_allowance_range}
                    onChange={handleStudentProfileChange}
                    required
                    disabled={loading}
                  >
                    <option value="">Select your monthly allowance range</option>
                    {metadata.allowance_ranges.map(range => (
                      <option key={range} value={range}>
                        KSh {range}
                      </option>
                    ))}
                  </select>
                  <span className="helper-text">Select the range that best matches your monthly budget</span>
                </div>

                <div className="form-group">
                  <label htmlFor="course">Course/Major *</label>
                  <input
                    type="text"
                    id="course"
                    name="course"
                    value={studentProfileData.course}
                    onChange={handleStudentProfileChange}
                    placeholder="e.g., Computer Science, Business Administration"
                    required
                    disabled={loading}
                    maxLength={255}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="birth_date">Birth Date</label>
                    <input
                      type="date"
                      id="birth_date"
                      name="birth_date"
                      value={studentProfileData.birth_date}
                      onChange={handleStudentProfileChange}
                      disabled={loading}
                      max={new Date().toISOString().split('T')[0]}
                      min="1950-01-01"
                    />
                    <span className="helper-text">Your age will be calculated automatically</span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="gender">Gender</label>
                    <select
                      id="gender"
                      name="gender"
                      value={studentProfileData.gender}
                      onChange={handleStudentProfileChange}
                      disabled={loading}
                    >
                      <option value="">Select gender (optional)</option>
                      {metadata.gender_options.map(gender => (
                        <option key={gender} value={gender}>
                          {gender === 'prefer_not_to_say' 
                            ? 'Prefer not to say' 
                            : gender.charAt(0).toUpperCase() + gender.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button type="submit" className="save-btn" disabled={loading}>
                  {loading ? 'Saving...' : (hasStudentProfile ? 'Update Profile' : 'Create Profile')}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      <DashboardFooter />
    </div>
  );
};

export default ProfileSettings;