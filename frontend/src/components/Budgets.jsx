import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardNavbar from '../components/DashboardNavbar';
import DashboardFooter from '../components/DashboardFooter';
import authService from '../services/authService';
import api from '../api/axios';
import './Budgets.css';

const Budgets = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [budgets, setBudgets] = useState([]);
  const [budgetsLoading, setBudgetsLoading] = useState(true);
  const [budgetSummary, setBudgetSummary] = useState(null);

  useEffect(() => {
    fetchBudgets();
    fetchBudgetSummary();
  }, []);

  const fetchBudgets = async () => {
    setBudgetsLoading(true);
    try {
      const response = await api.get('/budgets', {
        params: { per_page: 20 }
      });
      
      let budgetData = [];
      
      if (response.data && response.data.data) {
        if (Array.isArray(response.data.data)) {
          budgetData = response.data.data;
        } else if (response.data.data.data && Array.isArray(response.data.data.data)) {
          budgetData = response.data.data.data;
        }
      }
      
      budgetData = budgetData.map(budget => ({
        ...budget,
        id: budget.id || budget.budget_id
      }));
      
      setBudgets(budgetData);
    } catch (err) {
      console.error('Error fetching budgets:', err);
      setBudgets([]);
    } finally {
      setBudgetsLoading(false);
    }
  };

  const fetchBudgetSummary = async () => {
    try {
      const response = await api.get('/budgets/my-summary');
      
      if (response.data && response.data.data) {
        setBudgetSummary(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching budget summary:', err);
    }
  };

  const handleCreateBudget = () => {
    navigate('/finance-hub', { state: { openBudgetForm: true } });
  };

  const handleEditBudget = (budget) => {
    navigate('/finance-hub', { 
      state: { 
        openBudgetForm: true, 
        editBudget: {
          id: budget.id || budget.budget_id,
          category: budget.category,
          amount: budget.amount,
          start_date: budget.start_date,
          end_date: budget.end_date,
          actual_spent: budget.actual_spent || 0,
          status: budget.status
        }
      } 
    });
  };

  const handleDeleteBudget = async (budget) => {
    const budgetId = budget.id || budget.budget_id;
    
    if (!window.confirm('Are you sure you want to delete this budget?')) {
      return;
    }

    try {
      await api.delete(`/budgets/${budgetId}`);
      setMessage('Budget deleted successfully!');
      
      setTimeout(() => {
        setMessage('');
        fetchBudgets();
        fetchBudgetSummary();
      }, 1500);
    } catch (err) {
      console.error('Error deleting budget:', err);
      setError('Failed to delete budget.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleSyncBudget = async (budget) => {
    const budgetId = budget.id || budget.budget_id;
    
    try {
      await api.post(`/budgets/${budgetId}/sync-actual-spent`);
      setMessage('Budget synced with actual spending!');
      
      setTimeout(() => {
        setMessage('');
        fetchBudgets();
        fetchBudgetSummary();
      }, 1500);
    } catch (err) {
      console.error('Error syncing budget:', err);
      setError(err.response?.data?.message || 'Failed to sync budget.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  const getCategoryIcon = (category) => {
    const iconMap = {
      'Food & Drinks': (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
          <line x1="6" y1="1" x2="6" y2="4"></line>
          <line x1="10" y1="1" x2="10" y2="4"></line>
          <line x1="14" y1="1" x2="14" y2="4"></line>
        </svg>
      ),
      'Transportation': (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path>
          <circle cx="7" cy="17" r="2"></circle>
          <path d="M9 17h6"></path>
          <circle cx="17" cy="17" r="2"></circle>
        </svg>
      ),
      'Entertainment': (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
          <polyline points="17 2 12 7 7 2"></polyline>
        </svg>
      ),
      'Education': (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
      ),
      'Housing': (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      ),
      'Utilities': (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      ),
      'Healthcare': (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
        </svg>
      ),
      'Shopping': (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
      ),
      'Other': (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      )
    };
    
    return iconMap[category] || (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="1" x2="12" y2="23"></line>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
      </svg>
    );
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'active': return '#10b981';
      case 'completed': return '#3b82f6';
      case 'over': return '#ef4444';
      case 'under': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'active': return 'status-active';
      case 'completed': return 'status-completed';
      case 'over': return 'status-over';
      case 'under': return 'status-under';
      default: return 'status-default';
    }
  };

  const calculateBudgetProgress = (budget) => {
    const spent = parseFloat(budget.actual_spent) || 0;
    const amount = parseFloat(budget.amount) || 1;
    return Math.min((spent / amount) * 100, 100);
  };

  return (
    <div className="budgets-page">
      <DashboardNavbar activePage="Budgets" />
      
      <main className="budgets-main">
        <div className="budgets-container">
          {/* Page Header */}
          <div className="page-header">
            <div className="page-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
                <path d="M12 18V6"></path>
              </svg>
            </div>
            <h1>Budget Management</h1>
            <p>Track your spending across different categories and stay on top of your finances</p>
            <button 
              className="create-budget-btn"
              onClick={handleCreateBudget}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Create New Budget
            </button>
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

          {/* Budget Summary */}
          {budgetSummary && (
            <div className="budget-summary-section">
              <h2 className="section-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                Budget Overview
              </h2>
              <div className="summary-cards">
                <div className="summary-card">
                  <div className="summary-icon active">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  <div className="summary-content">
                    <p className="summary-label">Active Budgets</p>
                    <p className="summary-value">{budgetSummary.status_counts?.active || 0}</p>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-icon total">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="1" x2="12" y2="23"></line>
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                  </div>
                  <div className="summary-content">
                    <p className="summary-label">Total Budget</p>
                    <p className="summary-value">KES {parseFloat(budgetSummary.total_budgets || 0).toFixed(2)}</p>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-icon over">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                  </div>
                  <div className="summary-content">
                    <p className="summary-label">Exceeded</p>
                    <p className="summary-value">{budgetSummary.exceeded_budgets || 0}</p>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-icon completed">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  </div>
                  <div className="summary-content">
                    <p className="summary-label">Completed</p>
                    <p className="summary-value">{budgetSummary.status_counts?.completed || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Budgets List */}
          <div className="budgets-list-section">
            <h2 className="section-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
              Your Budgets
            </h2>
            
            {budgetsLoading ? (
              <div className="loading-state">Loading budgets...</div>
            ) : budgets.length === 0 ? (
              <div className="empty-state-large">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
                  <path d="M12 18V6"></path>
                </svg>
                <h3>No budgets yet</h3>
                <p>Click "Create New Budget" above to create your first budget and start tracking your spending!</p>
              </div>
            ) : (
              <div className="budgets-grid">
                {budgets.map((budget) => (
                  <div key={budget.id} className="budget-card">
                    <div className="budget-card-header">
                      <div className="budget-category">
                        <span className="category-icon-large">
                          {getCategoryIcon(budget.category)}
                        </span>
                        <h3>{budget.category}</h3>
                      </div>
                      <span className={`status-badge ${getStatusBadgeClass(budget.status)}`}>
                        {budget.status}
                      </span>
                    </div>

                    <div className="budget-amounts">
                      <div className="amount-item">
                        <span className="amount-label">Budget</span>
                        <span className="amount-value">KES {parseFloat(budget.amount).toFixed(2)}</span>
                      </div>
                      <div className="amount-item">
                        <span className="amount-label">Spent</span>
                        <span className={`amount-value ${parseFloat(budget.actual_spent) > parseFloat(budget.amount) ? 'over-budget' : ''}`}>
                          KES {parseFloat(budget.actual_spent || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="amount-item">
                        <span className="amount-label">Remaining</span>
                        <span className="amount-value remaining">
                          KES {(parseFloat(budget.amount) - parseFloat(budget.actual_spent || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="budget-progress-container">
                      <div className="progress-header">
                        <span className="progress-label">Progress</span>
                        <span className="progress-percentage">
                          {calculateBudgetProgress(budget).toFixed(0)}%
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ 
                            width: `${calculateBudgetProgress(budget)}%`,
                            backgroundColor: getStatusColor(budget.status)
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="budget-dates">
                      <span className="date-item">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        {formatDate(budget.start_date)} - {formatDate(budget.end_date)}
                      </span>
                    </div>

                    <div className="budget-actions">
                      <button 
                        onClick={() => handleSyncBudget(budget)}
                        className="action-btn sync-btn"
                        title="Sync with actual spending"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="23 4 23 10 17 10"></polyline>
                          <polyline points="1 20 1 14 7 14"></polyline>
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                        Sync
                      </button>
                      <button 
                        onClick={() => handleEditBudget(budget)}
                        className="action-btn edit-btn"
                        title="Edit budget"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteBudget(budget)}
                        className="action-btn delete-btn-budget"
                        title="Delete budget"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <DashboardFooter />
    </div>
  );
};

export default Budgets;