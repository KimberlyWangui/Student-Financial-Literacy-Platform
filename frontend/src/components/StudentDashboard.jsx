import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import DashboardNavbar from '../components/DashboardNavbar';
import DashboardFooter from '../components/DashboardFooter';
import './StudentDashboard.css';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    
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

  // Mock data - will be replaced with backend data later
  const budgetData = {
    currentBalance: 1862.31,
    income: 800,
    expenses: 137.69
  };

  const financialGoals = [
    { name: 'Emergency Fund', progress: 57, current: 850, target: 1500 },
    { name: 'New Laptop', progress: 30, current: 300, target: 1000 }
  ];

  const recentTransactions = [
    { date: '2024-07-28', description: 'Coffee at Local Cafe', category: 'Food & Drinks', amount: -4.5 },
    { date: '2024-07-27', description: 'Monthly Allowance', category: 'Income', amount: 500 },
    { date: '2024-07-26', description: 'Textbook Purchase', category: 'Education', amount: -75 },
    { date: '2024-07-25', description: 'Online Subscription', category: 'Entertainment', amount: -12.99 },
    { date: '2024-07-24', description: 'Part-time Job Payment', category: 'Income', amount: 300 },
    { date: '2024-07-23', description: 'Groceries for the week', category: 'Food & Drinks', amount: -45.2 }
  ];

  return (
    <div className="student-dashboard-page">
      <DashboardNavbar activePage="Dashboard" />
      
      <main className="dashboard-main">
        <div className="dashboard-container">
          {/* Welcome Section */}
          <div className="welcome-section">
            <div>
              <h1 className="welcome-title">Welcome back, {user?.name || 'Alex'}!</h1>
              <p className="welcome-subtitle">Here's a quick overview of your financial journey. Keep up the great work!</p>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="dashboard-grid">
            {/* Left Column - Budget & Transactions */}
            <div className="dashboard-left">
              {/* Budget Overview */}
              <div className="dashboard-card">
                <div className="card-header">
                  <h2 className="card-title">Budget Overview</h2>
                  <p className="card-subtitle">Your financial summary at a glance.</p>
                </div>
                
                <div className="budget-summary">
                  <div className="budget-item">
                    <p className="budget-label">Current Balance</p>
                    <p className="budget-value balance">${budgetData.currentBalance.toFixed(2)}</p>
                  </div>
                  <div className="budget-item">
                    <p className="budget-label">Income / Expenses</p>
                    <p className="budget-value income-expense">
                      <span className="income">${budgetData.income}</span> / <span className="expense">${budgetData.expenses}</span>
                    </p>
                  </div>
                </div>

                {/* Placeholder Chart */}
                <div className="chart-placeholder">
                  <p className="chart-text">📊 Chart visualization will go here</p>
                  <p className="chart-subtext">Budget trends over time</p>
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="dashboard-card">
                <div className="card-header">
                  <h2 className="card-title">Recent Transactions</h2>
                  <p className="card-subtitle">Your latest financial activities.</p>
                </div>

                <div className="transactions-table">
                  <div className="table-header">
                    <span className="col-date">Date</span>
                    <span className="col-description">Description</span>
                    <span className="col-category">Category</span>
                    <span className="col-amount">Amount</span>
                  </div>
                  {recentTransactions.map((transaction, index) => (
                    <div key={index} className="table-row">
                      <span className="col-date">{transaction.date}</span>
                      <span className="col-description">{transaction.description}</span>
                      <span className="col-category">{transaction.category}</span>
                      <span className={`col-amount ${transaction.amount > 0 ? 'positive' : 'negative'}`}>
                        {transaction.amount > 0 ? '+' : ''}{transaction.amount < 0 ? '-' : ''}${Math.abs(transaction.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Quick Actions & Goals */}
            <div className="dashboard-right">
              {/* Quick Actions */}
              <div className="dashboard-card quick-actions-card">
                <h2 className="card-title">Quick Actions</h2>
                <div className="quick-actions">
                  <button className="action-btn primary">
                    Add Income/Expense
                  </button>
                  <button className="action-btn secondary">
                    Start Simulation
                  </button>
                </div>
              </div>

              {/* Financial Goals */}
              <div className="dashboard-card">
                <h2 className="card-title">Financial Goals</h2>
                <p className="card-subtitle">Keep tracking your progress!</p>
                
                <div className="goals-list">
                  {financialGoals.map((goal, index) => (
                    <div key={index} className="goal-item">
                      <div className="goal-header">
                        <span className="goal-name">{goal.name}</span>
                        <span className="goal-percentage">{goal.progress}%</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${goal.progress}%` }}></div>
                      </div>
                      <p className="goal-amount">${goal.current} of ${goal.target}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Latest Recommendation */}
              <div className="dashboard-card recommendation-card">
                <h2 className="card-title">Your Latest Recommendation</h2>
                <p className="card-subtitle">Fresh advice for you!</p>
                
                <div className="recommendation-content">
                  <p className="recommendation-text">
                    "Consider reviewing your monthly subscriptions. Even small savings add up over time to boost your emergency fund!"
                  </p>
                  <button className="recommendation-btn">
                    View Full Recommendation
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <DashboardFooter />
    </div>
  );
};

export default StudentDashboard;