import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardNavbar from '../components/DashboardNavbar';
import DashboardFooter from '../components/DashboardFooter';
import authService from '../services/authService';
import api from '../api/axios';
import './Recommendations.css';

const Recommendations = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  // State management
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [statistics, setStatistics] = useState(null);
  const [canGenerate, setCanGenerate] = useState(false);
  const [checkingGeneration, setCheckingGeneration] = useState(true);
  const [nextAvailableTime, setNextAvailableTime] = useState(null);
  const [hoursRemaining, setHoursRemaining] = useState(null);
  
  // Modal states
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    status: 'viewed',
    feedback: ''
  });

  // Metadata
  const [metadata, setMetadata] = useState({
    categories: [],
    statuses: [],
    source_types: []
  });

  useEffect(() => {
    fetchRecommendations();
    fetchStatistics();
    checkCanGenerate();
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    try {
      const response = await api.get('/recommendations/metadata');
      if (response.data && response.data.data) {
        setMetadata(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching metadata:', err);
    }
  };

  const fetchRecommendations = async () => {
    setRecommendationsLoading(true);
    try {
      const response = await api.get('/recommendations', {
        params: { per_page: 20 }
      });
      
      console.log('Recommendations API Response:', response.data);
      
      let recData = [];
      if (response.data && response.data.data) {
        if (response.data.data.data && Array.isArray(response.data.data.data)) {
          recData = response.data.data.data;
        } else if (Array.isArray(response.data.data)) {
          recData = response.data.data;
        }
      }
      
      console.log('Processed recommendations:', recData);
      setRecommendations(recData);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setRecommendations([]);
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await api.get('/recommendations/statistics');
      console.log('Statistics API Response:', response.data);
      
      if (response.data && response.data.data) {
        setStatistics(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
  };

  const checkCanGenerate = async () => {
    setCheckingGeneration(true);
    try {
      const response = await api.get('/ai/can-generate');
      console.log('Can Generate API Response:', response.data);
      
      if (response.data && response.data.status === 'success') {
        setCanGenerate(response.data.can_generate);
        
        if (!response.data.can_generate) {
          if (response.data.next_available_at) {
            setNextAvailableTime(response.data.next_available_at);
          }
          if (response.data.hours_remaining !== undefined) {
            setHoursRemaining(response.data.hours_remaining);
          }
        }
      }
    } catch (err) {
      console.error('Error checking generation status:', err);
      console.error('Error details:', err.response?.data);
      setCanGenerate(false);
      
      // Show error to user
      if (err.response?.status === 500) {
        setError('Unable to check recommendation status. Please try refreshing the page.');
        setTimeout(() => setError(''), 5000);
      }
    } finally {
      setCheckingGeneration(false);
    }
  };

  const handleRequestRecommendation = async () => {
    if (!canGenerate) {
      let errorMsg = 'You cannot generate a new recommendation at this time.';
      if (hoursRemaining !== null) {
        errorMsg += ` Please wait ${hoursRemaining.toFixed(1)} hours.`;
      } else {
        errorMsg += ' Please wait 24 hours from your last request.';
      }
      setError(errorMsg);
      setTimeout(() => setError(''), 5000);
      return;
    }

    setLoading(true);
    clearMessages();

    try {
      const response = await api.post('/ai/predict/me');
      console.log('Generate Recommendation Response:', response.data);
      
      if (response.data && response.data.status === 'success') {
        setMessage('AI recommendation generated successfully!');
        
        setTimeout(() => {
          setMessage('');
          fetchRecommendations();
          fetchStatistics();
          checkCanGenerate();
        }, 2000);
      }
    } catch (err) {
      console.error('Error generating recommendation:', err);
      console.error('Error response:', err.response?.data);
      
      if (err.response?.status === 429) {
        const errorData = err.response.data;
        setError(`You already have a recent AI recommendation. Please wait 24 hours before generating a new one.`);
        
        if (errorData.next_available_at) {
          setNextAvailableTime(errorData.next_available_at);
        }
        
        // Refresh the can generate status
        checkCanGenerate();
      } else if (err.response?.data?.errors) {
        const errors = Object.values(err.response.data.errors).flat();
        setError(errors.join(', '));
      } else {
        setError(err.response?.data?.message || 'Failed to generate recommendation. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (recommendation) => {
    setSelectedRecommendation(recommendation);
    setShowDetailModal(true);
  };

  const handleOpenFeedback = (recommendation) => {
    setSelectedRecommendation(recommendation);
    setFeedbackForm({
      status: recommendation.status || 'viewed',
      feedback: recommendation.feedback || ''
    });
    setShowFeedbackModal(true);
  };

  const handleFeedbackChange = (e) => {
    const { name, value } = e.target;
    setFeedbackForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();

    try {
      await api.patch(`/recommendations/${selectedRecommendation.recommendation_id}/status`, feedbackForm);
      
      setMessage('Feedback submitted successfully!');
      setShowFeedbackModal(false);
      
      setTimeout(() => {
        setMessage('');
        fetchRecommendations();
        fetchStatistics();
      }, 2000);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError(err.response?.data?.message || 'Failed to submit feedback.');
    } finally {
      setLoading(false);
    }
  };

  const clearMessages = () => {
    setMessage('');
    setError('');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'pending': return 'status-pending';
      case 'viewed': return 'status-viewed';
      case 'accepted': return 'status-accepted';
      case 'rejected': return 'status-rejected';
      case 'ignored': return 'status-ignored';
      default: return 'status-default';
    }
  };

  const getCategoryIcon = (category) => {
    const iconMap = {
      'Budget': (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
          <path d="M12 18V6"></path>
        </svg>
      ),
      'Goal': (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="6"></circle>
          <circle cx="12" cy="12" r="2"></circle>
        </svg>
      ),
      'Saving': (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23"></line>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
      ),
      'Spending': (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
          <line x1="1" y1="10" x2="23" y2="10"></line>
        </svg>
      ),
      'Income': (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      ),
      'General': (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      ),
      'Behavioral': (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      )
    };
    
    return iconMap[category] || iconMap['General'];
  };

  const getConfidenceColor = (confidence) => {
    const score = parseFloat(confidence);
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  // Helper function to format confidence score as percentage
  const formatConfidence = (score) => {
    const numScore = parseFloat(score);
    // If score is between 0 and 1, multiply by 100
    if (numScore > 0 && numScore < 1) {
      return (numScore * 100).toFixed(1);
    }
    // If score is already a percentage (0-100)
    return numScore.toFixed(1);
  };

  return (
    <div className="recommendations-page">
      <DashboardNavbar activePage="Recommendations" />
      
      <main className="recommendations-main">
        <div className="recommendations-container">
          {/* Page Header */}
          <div className="page-header">
            <div className="page-header-content">
              <div className="page-header-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <h1>Your Financial Recommendations</h1>
              <p>Personalized advice to guide your financial journey.</p>
            </div>
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

          {/* Tip of the Day */}
          <div className="tip-of-day-card">
            <div className="tip-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            </div>
            <div className="tip-content">
              <h3>Tip of the Day</h3>
              <p>Automate your savings! Set up an automatic transfer from your checking account to your savings account each payday. Even small, consistent contributions add up significantly over time.</p>
            </div>
          </div>

          {/* Actionable Steps */}
          <div className="actionable-steps-section">
            <h2 className="section-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 11 12 14 22 4"></polyline>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
              Actionable Steps
            </h2>

            {recommendationsLoading ? (
              <div className="loading-state">Loading recommendations...</div>
            ) : recommendations.length === 0 ? (
              <div className="empty-state-large">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <h3>No recommendations yet</h3>
                <p>Click "Request New Recommendation" below to get your first AI-powered financial advice!</p>
              </div>
            ) : (
              <div className="recommendations-grid">
                {recommendations.map((recommendation) => {
                  const confidenceScore = recommendation.confidence_score;
                  const hasConfidence = confidenceScore !== null && 
                                       confidenceScore !== undefined && 
                                       !isNaN(parseFloat(confidenceScore));
                  
                  return (
                    <div key={recommendation.recommendation_id} className="recommendation-card">
                      <div className="recommendation-icon">
                        {getCategoryIcon(recommendation.category)}
                      </div>
                      <h3 className="recommendation-title">{recommendation.title || recommendation.category}</h3>
                      <p className="recommendation-preview">
                        {recommendation.recomm_text?.substring(0, 120)}...
                      </p>
                      <div className="recommendation-meta">
                        <span className={`status-badge ${getStatusBadgeClass(recommendation.status)}`}>
                          {recommendation.status}
                        </span>
                        {hasConfidence && (
                          <span className="confidence-badge" style={{ color: getConfidenceColor(formatConfidence(confidenceScore)) }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                            </svg>
                            {formatConfidence(confidenceScore)}% confidence
                          </span>
                        )}
                      </div>
                      <button 
                        className="learn-more-btn"
                        onClick={() => handleViewDetails(recommendation)}
                      >
                        Learn More
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14"></path>
                          <path d="M12 5l7 7-7 7"></path>
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Request New Recommendation Button */}
          <div className="request-section">
            <button 
              className="request-recommendation-btn"
              onClick={handleRequestRecommendation}
              disabled={loading || checkingGeneration || !canGenerate}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              {loading ? 'Generating...' : 'Request New Recommendation'}
            </button>
            {!canGenerate && !checkingGeneration && (
              <div className="generation-info">
                <p className="generation-note">
                  You've reached your recommendation limit (1 per 24 hours).
                </p>
                {hoursRemaining !== null && hoursRemaining > 0 && (
                  <p className="generation-next-time">
                    Please wait {hoursRemaining.toFixed(1)} more hours
                  </p>
                )}
                {nextAvailableTime && (
                  <p className="generation-next-time">
                    Next available: {formatDateTime(nextAvailableTime)}
                  </p>
                )}
              </div>
            )}
            {canGenerate && !checkingGeneration && (
              <p className="generation-available">✓ You can request a new AI recommendation</p>
            )}
          </div>

          {/* Statistics Section */}
          {statistics && (
            <div className="statistics-section">
              <h2 className="section-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                Your Recommendation Statistics
              </h2>
              <div className="statistics-grid">
                <div className="stat-card">
                  <div className="stat-icon total">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                  </div>
                  <div className="stat-content">
                    <p className="stat-label">Total Recommendations</p>
                    <p className="stat-value">{statistics.total_recommendations || 0}</p>
                  </div>
                </div>

                {statistics.by_status && Object.keys(statistics.by_status).map((status) => (
                  <div key={status} className="stat-card">
                    <div className={`stat-icon ${status}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {status === 'pending' && <><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></>}
                        {status === 'viewed' && <><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></>}
                        {status === 'accepted' && <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></>}
                        {status === 'rejected' && <><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></>}
                        {status === 'ignored' && <><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></>}
                      </svg>
                    </div>
                    <div className="stat-content">
                      <p className="stat-label">{status.charAt(0).toUpperCase() + status.slice(1)}</p>
                      <p className="stat-value">{statistics.by_status[status] || 0}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {showDetailModal && selectedRecommendation && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedRecommendation.title || selectedRecommendation.category}</h2>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <div className="detail-meta">
                  <span className={`status-badge ${getStatusBadgeClass(selectedRecommendation.status)}`}>
                    {selectedRecommendation.status}
                  </span>
                  {selectedRecommendation.confidence_score !== null && 
                   selectedRecommendation.confidence_score !== undefined && 
                   !isNaN(parseFloat(selectedRecommendation.confidence_score)) && (
                    <span className="confidence-badge-large" style={{ color: getConfidenceColor(formatConfidence(selectedRecommendation.confidence_score)) }}>
                      Confidence: {formatConfidence(selectedRecommendation.confidence_score)}%
                    </span>
                  )}
                  <span className="date-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    {formatDate(selectedRecommendation.created_at)}
                  </span>
                </div>
                
                <div className="detail-content">
                  <h3>Recommendation</h3>
                  <p>{selectedRecommendation.recomm_text}</p>
                </div>

                {selectedRecommendation.reasoning && (
                  <div className="detail-content">
                    <h3>Why This Recommendation?</h3>
                    <p>{selectedRecommendation.reasoning}</p>
                  </div>
                )}

                {selectedRecommendation.impact_estimate && parseFloat(selectedRecommendation.impact_estimate) > 0 && (
                  <div className="detail-content">
                    <h3>Expected Impact</h3>
                    <p>KES {parseFloat(selectedRecommendation.impact_estimate).toFixed(2)}</p>
                  </div>
                )}

                {selectedRecommendation.source_type && (
                  <div className="detail-content">
                    <h3>Source</h3>
                    <span className="source-badge">{selectedRecommendation.source_type}</span>
                    {selectedRecommendation.model_version && (
                      <span className="source-badge" style={{ marginLeft: '8px' }}>{selectedRecommendation.model_version}</span>
                    )}
                  </div>
                )}

                {selectedRecommendation.feedback && (
                  <div className="detail-content">
                    <h3>Your Feedback</h3>
                    <p className="feedback-text">{selectedRecommendation.feedback}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </button>
              <button 
                className="btn-primary"
                onClick={() => {
                  setShowDetailModal(false);
                  handleOpenFeedback(selectedRecommendation);
                }}
              >
                Update Status & Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && selectedRecommendation && (
        <div className="modal-overlay" onClick={() => setShowFeedbackModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Update Recommendation Status</h2>
              <button className="modal-close" onClick={() => setShowFeedbackModal(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmitFeedback}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    value={feedbackForm.status}
                    onChange={handleFeedbackChange}
                    required
                    disabled={loading}
                  >
                    <option value="viewed">Viewed</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                    <option value="ignored">Ignored</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="feedback">Your Feedback (Optional)</label>
                  <textarea
                    id="feedback"
                    name="feedback"
                    value={feedbackForm.feedback}
                    onChange={handleFeedbackChange}
                    placeholder="Share your thoughts about this recommendation..."
                    rows="4"
                    maxLength="500"
                    disabled={loading}
                  />
                  <small className="char-count">{feedbackForm.feedback.length}/500</small>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowFeedbackModal(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : 'Submit Feedback'}
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

export default Recommendations;