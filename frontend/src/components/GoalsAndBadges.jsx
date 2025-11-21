import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardNavbar from '../components/DashboardNavbar';
import DashboardFooter from '../components/DashboardFooter';
import authService from '../services/authService';
import api from '../api/axios';
import './GoalsAndBadges.css';

const GoalsAndBadges = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  // State management
  const [activeTab, setActiveTab] = useState('goals');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Goals state
  const [goals, setGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalFormData, setGoalFormData] = useState({
    goal_name: '',
    target_amount: '',
    current_amount: 0,
    deadline: '',
    description: '',
    goal_type: 'short-term',
    status: 'in_progress'
  });

  // Badges state
  const [badges, setBadges] = useState([]);
  const [myBadges, setMyBadges] = useState([]);
  const [badgeProgress, setBadgeProgress] = useState([]);
  const [badgesLoading, setBadgesLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    fetchGoals();
    fetchBadges();
    fetchMyBadges();
    fetchBadgeProgress();
    fetchLeaderboard();
  }, []);

  // ==================== GOALS FUNCTIONS ====================

  const fetchGoals = async () => {
    setGoalsLoading(true);
    try {
      const response = await api.get('/goals');
      
      console.log('Goals Response:', response.data);
      
      let goalsData = [];
      if (response.data && response.data.data) {
        if (Array.isArray(response.data.data.data)) {
          goalsData = response.data.data.data;
        } else if (Array.isArray(response.data.data)) {
          goalsData = response.data.data;
        }
      }
      
      console.log('Processed Goals:', goalsData);
      setGoals(goalsData);
    } catch (err) {
      console.error('Error fetching goals:', err);
      setGoals([]);
    } finally {
      setGoalsLoading(false);
    }
  };

  const handleGoalChange = (e) => {
    const { name, value } = e.target;
    setGoalFormData(prev => ({
      ...prev,
      [name]: value
    }));
    clearMessages();
  };

  const handleGoalSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();

    if (parseFloat(goalFormData.target_amount) <= 0) {
      setError('Target amount must be greater than 0');
      setLoading(false);
      return;
    }

    const submissionData = {
      goal_name: goalFormData.goal_name,
      target_amount: parseFloat(goalFormData.target_amount),
      current_amount: parseFloat(goalFormData.current_amount) || 0,
      deadline: goalFormData.deadline,
      goal_type: goalFormData.goal_type || 'short-term',
      status: goalFormData.status || 'in_progress'
    };

    try {
      if (editingGoal) {
        await api.put(`/goals/${editingGoal.id}`, submissionData);
        setMessage('Goal updated successfully!');
      } else {
        await api.post('/goals', submissionData);
        setMessage('Goal created successfully!');
      }
      
      setShowGoalModal(false);
      setEditingGoal(null);
      setGoalFormData({
        goal_name: '',
        target_amount: '',
        current_amount: 0,
        deadline: '',
        description: '',
        goal_type: 'short-term',
        status: 'in_progress'
      });

      setTimeout(() => {
        setMessage('');
        fetchGoals();
      }, 2000);

    } catch (err) {
      console.error('Error saving goal:', err);
      if (err.response?.data?.errors) {
        const errors = Object.values(err.response.data.errors).flat();
        setError(errors.join(', '));
      } else {
        setError(err.response?.data?.message || 'Failed to save goal. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditGoal = (goal) => {
    setEditingGoal(goal);
    setGoalFormData({
      goal_name: goal.goal_name,
      target_amount: goal.target_amount,
      current_amount: goal.current_amount || 0,
      deadline: goal.deadline,
      description: goal.description || '',
      goal_type: goal.goal_type || 'short-term',
      status: goal.status || 'in_progress'
    });
    setShowGoalModal(true);
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm('Are you sure you want to delete this goal?')) {
      return;
    }

    try {
      await api.delete(`/goals/${goalId}`);
      setMessage('Goal deleted successfully!');
      
      setTimeout(() => {
        setMessage('');
        fetchGoals();
      }, 1500);
    } catch (err) {
      console.error('Error deleting goal:', err);
      setError(err.response?.data?.message || 'Failed to delete goal.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleAddProgress = async (goalId) => {
    const amount = prompt('Enter amount to add to this goal:');
    
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return;
    }

    try {
      await api.post(`/goals/${goalId}/add-progress`, {
        amount: parseFloat(amount)
      });
      
      setMessage('Progress added successfully!');
      
      setTimeout(() => {
        setMessage('');
        fetchGoals();
        // Check for new badges after progress
        handleCheckBadges();
      }, 1500);
    } catch (err) {
      console.error('Error adding progress:', err);
      setError(err.response?.data?.message || 'Failed to add progress.');
      setTimeout(() => setError(''), 3000);
    }
  };

  // ==================== BADGES FUNCTIONS ====================

  const fetchBadges = async () => {
    setBadgesLoading(true);
    try {
      const response = await api.get('/badges');
      
      console.log('Badges Response:', response.data);
      
      let badgesData = [];
      if (response.data && response.data.data) {
        if (Array.isArray(response.data.data.data)) {
          badgesData = response.data.data.data;
        } else if (Array.isArray(response.data.data)) {
          badgesData = response.data.data;
        }
      }
      
      console.log('Processed Badges:', badgesData);
      setBadges(badgesData);
    } catch (err) {
      console.error('Error fetching badges:', err);
      setBadges([]);
    } finally {
      setBadgesLoading(false);
    }
  };

  const fetchMyBadges = async () => {
    try {
      const response = await api.get('/badges/my-badges');
      
      console.log('My Badges Response:', response.data);
      
      let myBadgesData = [];
      if (response.data) {
        if (Array.isArray(response.data.data)) {
          myBadgesData = response.data.data;
        } else if (Array.isArray(response.data)) {
          myBadgesData = response.data;
        }
      }
      
      console.log('Processed My Badges:', myBadgesData);
      setMyBadges(myBadgesData);
    } catch (err) {
      console.error('Error fetching my badges:', err);
      console.error('Error response:', err.response?.data);
      setMyBadges([]);
    }
  };

  const fetchBadgeProgress = async () => {
    try {
      const response = await api.get('/badges/my-progress');
      
      console.log('Badge Progress Response:', response.data);
      
      let progressData = [];
      if (response.data) {
        if (response.data.data && Array.isArray(response.data.data)) {
          progressData = response.data.data;
        } else if (Array.isArray(response.data)) {
          progressData = response.data;
        } else if (response.data.progress && Array.isArray(response.data.progress)) {
          progressData = response.data.progress;
        }
      }
      
      console.log('Processed Badge Progress:', progressData);
      setBadgeProgress(progressData);
    } catch (err) {
      console.error('Error fetching badge progress:', err);
      console.error('Error response:', err.response?.data);
      setBadgeProgress([]);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await api.get('/badges/leaderboard', {
        params: { limit: 10 }
      });
      
      console.log('Leaderboard Response:', response.data);
      
      let leaderboardData = [];
      if (response.data) {
        if (response.data.data && Array.isArray(response.data.data)) {
          leaderboardData = response.data.data;
        } else if (Array.isArray(response.data)) {
          leaderboardData = response.data;
        } else if (response.data.leaderboard && Array.isArray(response.data.leaderboard)) {
          leaderboardData = response.data.leaderboard;
        }
      }
      
      console.log('Processed Leaderboard:', leaderboardData);
      setLeaderboard(leaderboardData);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      console.error('Error response:', err.response?.data);
      setLeaderboard([]);
    }
  };

  const handleCheckBadges = async () => {
    setLoading(true);
    try {
      const response = await api.post('/badges/check-my-badges');
      
      console.log('Check Badges Response:', response.data);
      
      if (response.data && response.data.data) {
        const data = response.data.data;
        if (data.newly_earned && Array.isArray(data.newly_earned) && data.newly_earned.length > 0) {
          setMessage(`Congratulations! You earned ${data.newly_earned.length} new badge(s)!`);
          fetchMyBadges();
          fetchBadgeProgress();
          fetchLeaderboard();
        } else {
          setMessage('No new badges earned. Keep working towards your goals!');
        }
      }
      
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error('Error checking badges:', err);
      setError(err.response?.data?.message || 'Failed to check badges.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // ==================== UTILITY FUNCTIONS ====================

  const clearMessages = () => {
    setMessage('');
    setError('');
  };

  const calculateProgress = (current, target) => {
    if (target === 0) return 0;
    return Math.min((current / target) * 100, 100);
  };

  const getProgressColor = (progress) => {
    if (progress >= 100) return '#10b981';
    if (progress >= 75) return '#3b82f6';
    if (progress >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'in_progress': return 'status-in-progress';
      case 'completed': return 'status-completed';
      case 'abandoned': return 'status-abandoned';
      case 'missed': return 'status-abandoned';
      default: return 'status-default';
    }
  };

  const hasBadge = (badgeId) => {
    if (!Array.isArray(myBadges)) return false;
    return myBadges.some(b => (b.badge_id || b.id) === badgeId);
  };

  const getBadgeProgress = (badgeId) => {
    if (!Array.isArray(badgeProgress)) return null;
    const progress = badgeProgress.find(p => (p.badge_id || p.id) === badgeId);
    return progress || null;
  };

  return (
    <div className="goals-badges-page">
      <DashboardNavbar activePage="Goals & Badges" />
      
      <main className="goals-badges-main">
        <div className="goals-badges-container">
          {/* Page Header */}
          <div className="page-header">
            <div className="page-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="6"></circle>
                <circle cx="12" cy="12" r="2"></circle>
              </svg>
            </div>
            <h1>Goals & Badges</h1>
            <p>Track your progress and celebrate achievements</p>
          </div>

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
          <div className="tabs-container">
            <button
              className={`tab-button ${activeTab === 'goals' ? 'active' : ''}`}
              onClick={() => setActiveTab('goals')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="6"></circle>
                <circle cx="12" cy="12" r="2"></circle>
              </svg>
              My Financial Goals
            </button>
            <button
              className={`tab-button ${activeTab === 'badges' ? 'active' : ''}`}
              onClick={() => setActiveTab('badges')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
              </svg>
              Earned Badges
            </button>
          </div>

          {/* GOALS TAB */}
          {activeTab === 'goals' && (
            <div className="goals-content">
              <div className="content-header">
                <h2>My Financial Goals</h2>
                <button 
                  className="add-goal-btn"
                  onClick={() => {
                    setEditingGoal(null);
                    setGoalFormData({
                      goal_name: '',
                      target_amount: '',
                      current_amount: 0,
                      deadline: '',
                      description: '',
                      goal_type: 'short-term',
                      status: 'in_progress'
                    });
                    setShowGoalModal(true);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Set Goal
                </button>
              </div>

              {goalsLoading ? (
                <div className="loading-state">Loading goals...</div>
              ) : goals.length === 0 ? (
                <div className="empty-state">
                  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="6"></circle>
                    <circle cx="12" cy="12" r="2"></circle>
                  </svg>
                  <h3>No Goals Yet</h3>
                  <p>Set your first financial goal to start tracking your progress!</p>
                  <button 
                    className="empty-state-btn"
                    onClick={() => setShowGoalModal(true)}
                  >
                    Create Your First Goal
                  </button>
                </div>
              ) : (
                <div className="goals-grid">
                  {goals.map((goal) => {
                    const progress = calculateProgress(goal.current_amount, goal.target_amount);
                    const progressColor = getProgressColor(progress);
                    
                    return (
                      <div key={goal.id} className="goal-card">
                        <div className="goal-header">
                          <div className="goal-icon" style={{ backgroundColor: `${progressColor}20`, color: progressColor }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"></circle>
                              <circle cx="12" cy="12" r="6"></circle>
                              <circle cx="12" cy="12" r="2"></circle>
                            </svg>
                          </div>
                          <span className={`status-badge ${getStatusBadgeClass(goal.status)}`}>
                            {goal.status?.replace('_', ' ').replace('-', ' ')}
                          </span>
                        </div>
                        
                        <h3 className="goal-name">{goal.goal_name}</h3>
                        {goal.description && (
                          <p className="goal-description">{goal.description}</p>
                        )}
                        
                        <div className="goal-amounts">
                          <span className="current-amount">KES {parseFloat(goal.current_amount).toLocaleString()}</span>
                          <span className="target-amount">of KES {parseFloat(goal.target_amount).toLocaleString()}</span>
                        </div>
                        
                        <div className="progress-bar-container">
                          <div className="progress-bar">
                            <div 
                              className="progress-fill" 
                              style={{ width: `${progress}%`, backgroundColor: progressColor }}
                            ></div>
                          </div>
                          <span className="progress-percentage" style={{ color: progressColor }}>
                            {progress.toFixed(1)}%
                          </span>
                        </div>
                        
                        {goal.deadline && (
                          <div className="goal-deadline">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                              <line x1="16" y1="2" x2="16" y2="6"></line>
                              <line x1="8" y1="2" x2="8" y2="6"></line>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            Deadline: {formatDate(goal.deadline)}
                          </div>
                        )}
                        
                        <div className="goal-actions">
                          <button 
                            className="action-btn progress-btn"
                            onClick={() => handleAddProgress(goal.id)}
                            disabled={goal.status === 'completed' || goal.status === 'abandoned' || goal.status === 'missed'}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="12" y1="5" x2="12" y2="19"></line>
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Update Progress
                          </button>
                          <button 
                            className="action-btn edit-btn"
                            onClick={() => handleEditGoal(goal)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button 
                            className="action-btn delete-btn"
                            onClick={() => handleDeleteGoal(goal.id)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* BADGES TAB */}
          {activeTab === 'badges' && (
            <div className="badges-content">
              {/* Earned Badges Section */}
              <div className="badges-section">
                <div className="section-header">
                  <h2>Earned Badges</h2>
                  <button 
                    className="check-badges-btn"
                    onClick={handleCheckBadges}
                    disabled={loading}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="23 4 9 18 1 10"></polyline>
                    </svg>
                    {loading ? 'Checking...' : 'Check for New Badges'}
                  </button>
                </div>

                {badgesLoading ? (
                  <div className="loading-state">Loading badges...</div>
                ) : !Array.isArray(myBadges) || myBadges.length === 0 ? (
                  <div className="empty-state-small">
                    <p>No badges earned yet. Complete tasks to earn your first badge!</p>
                  </div>
                ) : (
                  <div className="badges-grid">
                    {myBadges.map((badge) => (
                      <div key={badge.badge_id || badge.id} className="badge-card earned">
                        <div className="badge-icon">
                          {badge.image_url ? (
                            <img src={badge.image_url_full || badge.image_url} alt={badge.badge_name} />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                            </svg>
                          )}
                        </div>
                        <h3 className="badge-name">{badge.badge_name}</h3>
                        <p className="badge-description">{badge.description}</p>
                        <div className="badge-xp">+{badge.xp_reward || badge.xp_earned || 0} XP</div>
                        {badge.earned_at && (
                          <div className="badge-earned-date">
                            Earned {formatDate(badge.earned_at)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available Badges Section */}
              <div className="badges-section">
                <h2>Available Badges</h2>
                {badgesLoading ? (
                  <div className="loading-state">Loading badges...</div>
                ) : !Array.isArray(badges) || badges.length === 0 ? (
                  <div className="empty-state-small">
                    <p>No badges available at the moment.</p>
                  </div>
                ) : (
                  <div className="badges-grid">
                    {badges.filter(badge => !hasBadge(badge.badge_id)).map((badge) => {
                      const progress = getBadgeProgress(badge.badge_id);
                      const progressPercent = progress ? (progress.current_value / badge.criteria_value * 100) : 0;
                      
                      return (
                        <div key={badge.badge_id} className="badge-card locked">
                          <div className="badge-icon">
                            {badge.image_url ? (
                              <img src={badge.image_url_full || badge.image_url} alt={badge.badge_name} className="locked-image" />
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                              </svg>
                            )}
                          </div>
                          <h3 className="badge-name">{badge.badge_name}</h3>
                          <p className="badge-description">{badge.description}</p>
                          <p className="badge-criteria">{badge.criteria_description}</p>
                          
                          {progress && (
                            <div className="badge-progress">
                              <div className="badge-progress-bar">
                                <div 
                                  className="badge-progress-fill" 
                                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                                ></div>
                              </div>
                              <span className="badge-progress-text">
                                {progress.current_value} / {badge.criteria_value}
                              </span>
                            </div>
                          )}
                          
                          <div className="badge-xp">+{badge.xp_reward} XP</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Leaderboard Section */}
              <div className="leaderboard-section">
                <h2>Top Badge Earners</h2>
                {!Array.isArray(leaderboard) || leaderboard.length === 0 ? (
                  <div className="empty-state-small">
                    <p>No leaderboard data available yet.</p>
                  </div>
                ) : (
                  <div className="leaderboard-table">
                    <div className="leaderboard-header">
                      <span>Rank</span>
                      <span>Student</span>
                      <span>Badges</span>
                      <span>Total XP</span>
                    </div>
                    {leaderboard.map((entry, index) => (
                      <div 
                        key={entry.student_id || entry.id || index} 
                        className={`leaderboard-row ${entry.student_id === user?.id ? 'current-user' : ''}`}
                      >
                        <span className="rank">
                          {index === 0 && '🥇'}
                          {index === 1 && '🥈'}
                          {index === 2 && '🥉'}
                          {index > 2 && `#${index + 1}`}
                        </span>
                        <span className="student-name">
                          {entry.name || 'Unknown Student'}
                          {(entry.student_id === user?.id || entry.id === user?.id) && (<span className="you-badge">You</span>)}
                        </span>
                        <span className="badge-count">{entry.badge_count || 0}</span>
                        <span className="xp-total">{entry.xp_total || entry.total_xp || 0} XP</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Goal Modal */}
      {showGoalModal && (
        <div className="modal-overlay" onClick={() => setShowGoalModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingGoal ? 'Edit Goal' : 'Create New Goal'}</h2>
              <button className="modal-close" onClick={() => setShowGoalModal(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleGoalSubmit} className="goal-form">
              <div className="form-group">
                <label htmlFor="goal_name">Goal Name *</label>
                <input
                  type="text"
                  id="goal_name"
                  name="goal_name"
                  value={goalFormData.goal_name}
                  onChange={handleGoalChange}
                  placeholder="e.g., Emergency Fund"
                  required
                  disabled={loading}
                  maxLength="100"
                />
              </div>

              <div className="form-group">
                <label htmlFor="target_amount">Target Amount (KES) *</label>
                <input
                  type="number"
                  id="target_amount"
                  name="target_amount"
                  value={goalFormData.target_amount}
                  onChange={handleGoalChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="current_amount">Current Amount (KES)</label>
                <input
                  type="number"
                  id="current_amount"
                  name="current_amount"
                  value={goalFormData.current_amount}
                  onChange={handleGoalChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="deadline">Deadline *</label>
                <input
                  type="date"
                  id="deadline"
                  name="deadline"
                  value={goalFormData.deadline}
                  onChange={handleGoalChange}
                  required
                  disabled={loading}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="form-group">
                <label htmlFor="goal_type">Goal Type</label>
                <select
                  id="goal_type"
                  name="goal_type"
                  value={goalFormData.goal_type}
                  onChange={handleGoalChange}
                  disabled={loading}
                >
                  <option value="short-term">Short-term</option>
                  <option value="long-term">Long-term</option>
                </select>
              </div>

              <div className="modal-footer">
                <button 
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowGoalModal(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : editingGoal ? 'Update Goal' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DashboardFooter />
    </div>
  );
};

export default GoalsAndBadges;