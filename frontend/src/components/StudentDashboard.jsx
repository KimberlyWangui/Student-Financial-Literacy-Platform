import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import DashboardNavbar from '../components/DashboardNavbar';
import DashboardFooter from '../components/DashboardFooter';
import api from '../api/axios';
import './StudentDashboard.css';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // State for real data
  const [budgetData, setBudgetData] = useState({
    totalBudget: 0,
    totalIncome: 0,
    totalExpenses: 0,
    currentBalance: 0
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State for latest recommendation
  const [latestRecommendation, setLatestRecommendation] = useState(null);
  const [recommendationLoading, setRecommendationLoading] = useState(true);

  const financialGoals = [
    { name: 'Emergency Fund', progress: 57, current: 850, target: 1500 },
    { name: 'New Laptop', progress: 30, current: 300, target: 1000 }
  ];

  useEffect(() => {
    fetchDashboardData();
    fetchLatestRecommendation();
  }, []);

  const fetchLatestRecommendation = async () => {
    setRecommendationLoading(true);
    try {
      const response = await api.get('/recommendations', {
        params: { per_page: 1 }
      });
      
      console.log('Recommendations Response:', response.data);
      
      let recommendation = null;
      if (response.data && response.data.data) {
        if (response.data.data.data && Array.isArray(response.data.data.data) && response.data.data.data.length > 0) {
          recommendation = response.data.data.data[0];
        } else if (Array.isArray(response.data.data) && response.data.data.length > 0) {
          recommendation = response.data.data[0];
        }
      }
      
      setLatestRecommendation(recommendation);
      console.log('Latest Recommendation:', recommendation);
    } catch (err) {
      console.error('Error fetching latest recommendation:', err);
    } finally {
      setRecommendationLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch budget summary
      const budgetResponse = await api.get('/budgets/my-summary');
      
      // Fetch financial summary
      const financialResponse = await api.get('/financial-data/my-summary');
      
      // Fetch recent transactions
      const transactionsResponse = await api.get('/financial-data', {
        params: { per_page: 6 }
      });

      console.log('Budget Response:', budgetResponse.data);
      console.log('Financial Response:', financialResponse.data);

      // Process financial data FIRST
      let totalIncome = 0;
      let totalExpenses = 0;
      let balance = 0;

      if (financialResponse.data && financialResponse.data.data) {
        const financialData = financialResponse.data.data;
        
        // Check if summary exists
        if (financialData.summary) {
          // Remove any commas and parse the values
          const incomeStr = String(financialData.summary.total_income).replace(/,/g, '');
          const expenseStr = String(financialData.summary.total_expenses).replace(/,/g, '');
          const balanceStr = String(financialData.summary.balance).replace(/,/g, '');
          
          totalIncome = parseFloat(incomeStr) || 0;
          totalExpenses = parseFloat(expenseStr) || 0;
          balance = parseFloat(balanceStr) || 0;
          
          console.log('Parsed Financial Data:', {
            totalIncome,
            totalExpenses,
            balance
          });
        }
      }

      // Process budget data
      let totalBudget = 0;
      
      if (budgetResponse.data && budgetResponse.data.data) {
        const budgetSummary = budgetResponse.data.data;
        
        // Get total budgeted amount
        if (budgetSummary.total_budgets) {
          totalBudget = parseFloat(budgetSummary.total_budgets) || 0;
        } else if (budgetSummary.financial_summary && budgetSummary.financial_summary.total_budgeted_amount) {
          totalBudget = parseFloat(budgetSummary.financial_summary.total_budgeted_amount) || 0;
        }
        
        console.log('Total Budget:', totalBudget);
      }

      setBudgetData({
        totalBudget: totalBudget,
        totalIncome: totalIncome,
        totalExpenses: totalExpenses,
        currentBalance: balance
      });

      // Process transactions
      let transactionData = [];
      if (transactionsResponse.data && transactionsResponse.data.data) {
        if (Array.isArray(transactionsResponse.data.data.data)) {
          transactionData = transactionsResponse.data.data.data;
        } else if (Array.isArray(transactionsResponse.data.data)) {
          transactionData = transactionsResponse.data.data;
        }
      }
      setRecentTransactions(transactionData);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      console.error('Error details:', err.response?.data);
    } finally {
      setLoading(false);
    }
  };

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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  // Prepare data for bar chart
  const chartData = [
    {
      name: 'Budget',
      amount: budgetData.totalBudget,
      fill: '#4c6ef5'
    },
    {
      name: 'Income',
      amount: budgetData.totalIncome,
      fill: '#10b981'
    },
    {
      name: 'Expenses',
      amount: budgetData.totalExpenses,
      fill: '#ef4444'
    }
  ];

  console.log('Chart Data:', chartData);

  return (
    <div className="student-dashboard-page">
      <DashboardNavbar activePage="Dashboard" />
      
      <main className="dashboard-main">
        <div className="dashboard-container">
          {/* Welcome Section */}
          <div className="welcome-section">
            <div>
              <h1 className="welcome-title">Welcome back, {user?.name || 'Student'}!</h1>
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
                    <p className="budget-value balance">KES {budgetData.currentBalance.toFixed(2)}</p>
                  </div>
                  <div className="budget-item">
                    <p className="budget-label">Income / Expenses</p>
                    <p className="budget-value income-expense">
                      <span className="income">KES {budgetData.totalIncome.toFixed(2)}</span> / <span className="expense">KES {budgetData.totalExpenses.toFixed(2)}</span>
                    </p>
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="chart-container">
                  {loading ? (
                    <div className="chart-loading">Loading chart...</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fill: '#666', fontSize: 14 }}
                          axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <YAxis 
                          tick={{ fill: '#666', fontSize: 12 }}
                          axisLine={{ stroke: '#e5e7eb' }}
                          tickFormatter={(value) => `KES ${value.toLocaleString()}`}
                        />
                        <Tooltip 
                          formatter={(value) => [`KES ${value.toFixed(2)}`, 'Amount']}
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '10px'
                          }}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: '20px' }}
                          iconType="square"
                        />
                        <Bar 
                          dataKey="amount" 
                          radius={[8, 8, 0, 0]}
                          maxBarSize={80}
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="dashboard-card">
                <div className="card-header">
                  <h2 className="card-title">Recent Transactions</h2>
                  <p className="card-subtitle">Your latest financial activities.</p>
                </div>

                {loading ? (
                  <div className="loading-state">Loading transactions...</div>
                ) : recentTransactions.length === 0 ? (
                  <div className="empty-state">
                    <p>No transactions yet. Start by adding your first income or expense!</p>
                  </div>
                ) : (
                  <div className="transactions-table">
                    <div className="table-header">
                      <span className="col-date">Date</span>
                      <span className="col-description">Description</span>
                      <span className="col-category">Category</span>
                      <span className="col-amount">Amount</span>
                    </div>
                    {recentTransactions.map((transaction) => (
                      <div key={transaction.id || transaction.entry_id} className="table-row">
                        <span className="col-date">{formatDate(transaction.entry_date)}</span>
                        <span className="col-description">{transaction.description || transaction.category}</span>
                        <span className="col-category">{transaction.category}</span>
                        <span className={`col-amount ${transaction.entry_type === 'income' ? 'positive' : 'negative'}`}>
                          {transaction.entry_type === 'income' ? '+' : '-'}KES {parseFloat(transaction.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Quick Actions & Goals */}
            <div className="dashboard-right">
              {/* Quick Actions */}
              <div className="dashboard-card quick-actions-card">
                <h2 className="card-title">Quick Actions</h2>
                <div className="quick-actions">
                  <button className="action-btn primary" onClick={() => navigate('/finance-hub')}>
                    Add Income/Expense
                  </button>
                  <button className="action-btn secondary" onClick={() => navigate('/simulation')}>
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
                      <p className="goal-amount">KES {goal.current} of KES {goal.target}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Latest Recommendation */}
              <div className="dashboard-card recommendation-card">
                <h2 className="card-title">Your Latest Recommendation</h2>
                <p className="card-subtitle">Fresh advice for you!</p>
                
                {recommendationLoading ? (
                  <div className="recommendation-content">
                    <p className="recommendation-loading">Loading recommendation...</p>
                  </div>
                ) : latestRecommendation ? (
                  <div className="recommendation-content">
                    <div className="recommendation-meta">
                      <span className={`recommendation-status ${latestRecommendation.status}`}>
                        {latestRecommendation.status}
                      </span>
                      <span className="recommendation-category">
                        {latestRecommendation.category}
                      </span>
                    </div>
                    <p className="recommendation-text">
                      {latestRecommendation.recomm_text?.length > 150 
                        ? `${latestRecommendation.recomm_text.substring(0, 150)}...` 
                        : latestRecommendation.recomm_text}
                    </p>
                    {latestRecommendation.confidence_score && (
                      <p className="recommendation-confidence">
                        Confidence: {(parseFloat(latestRecommendation.confidence_score) * 100).toFixed(1)}%
                      </p>
                    )}
                    <button 
                      className="recommendation-btn"
                      onClick={() => navigate('/recommendations')}
                    >
                      View Full Recommendation
                    </button>
                  </div>
                ) : (
                  <div className="recommendation-content">
                    <p className="recommendation-empty">
                      No recommendations yet. Generate your first AI-powered recommendation!
                    </p>
                    <button 
                      className="recommendation-btn"
                      onClick={() => navigate('/recommendations')}
                    >
                      Get Your First Recommendation
                    </button>
                  </div>
                )}
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