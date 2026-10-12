import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminNavbar from '../components/AdminNavbar';
import api from '../api/axios';
import './AdminDashboard.css';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Add loading state
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Update metrics state to use real data
  const [metrics, setMetrics] = useState({
    totalStudents: 0,
    studentsGrowth: '+0%',
    activeUsers: 0,
    activePercentage: '0%',
    newToday: 0,
    newComparison: '+0',
    financialEntries: 12450,
    entriesToday: 230,
    activeGoals: 5123,
    goalsCreated: 45,
    badgesEarned: 1234,
    badgesToday: 18
  });

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch metrics data on component mount
  useEffect(() => {
    fetchMetricsData();
  }, []);

  // Function to fetch all metrics
  const fetchMetricsData = async () => {
    setMetricsLoading(true);
    try {
      // Fetch all three metrics in parallel
      const [totalStudentsRes, activeStudentsRes, newStudentsRes] = await Promise.all([
        api.get('/student-profiles/total-students'),
        api.get('/student-profiles/active', { params: { days: 7 } }), // Last 7 days for active
        api.get('/student-profiles/new-students', { params: { days: 1 } }) // Today only
      ]);

      console.log('Total Students Response:', totalStudentsRes.data);
      console.log('Active Students Response:', activeStudentsRes.data);
      console.log('New Students Response:', newStudentsRes.data);

      // Extract total students
      const totalStudents = totalStudentsRes.data.data.total_students || 0;

      // Extract active students (last 7 days)
      const activeUsers = activeStudentsRes.data.data.total_active_students || 0;
      
      // Calculate active percentage
      const activePercentage = totalStudents > 0 
        ? Math.round((activeUsers / totalStudents) * 100) 
        : 0;

      // Extract new students today
      const newToday = newStudentsRes.data.data.total_new_students || 0;

      // Calculate comparison (you can enhance this with historical data later)
      const avgNewPerDay = 5; // This could be fetched from backend later
      const newComparison = newToday > avgNewPerDay 
        ? `+${newToday - avgNewPerDay}` 
        : `${newToday - avgNewPerDay}`;

      // Calculate students growth (you can enhance this with last month's data later)
      const studentsGrowth = '+2%'; // Placeholder - can be calculated with historical data

      // Update metrics state
      setMetrics(prevMetrics => ({
        ...prevMetrics,
        totalStudents: totalStudents,
        studentsGrowth: studentsGrowth,
        activeUsers: activeUsers,
        activePercentage: `${activePercentage}%`,
        newToday: newToday,
        newComparison: newComparison
      }));

    } catch (err) {
      console.error('Error fetching metrics data:', err);
      console.error('Error details:', err.response?.data);
    } finally {
      setMetricsLoading(false);
    }
  };

  // User growth chart data (last 7 days)
  const userGrowthData = [
    { day: 'Mon', users: 145 },
    { day: 'Tue', users: 178 },
    { day: 'Wed', users: 162 },
    { day: 'Thu', users: 195 },
    { day: 'Fri', users: 210 },
    { day: 'Sat', users: 168 },
    { day: 'Sun', users: 152 }
  ];

  // Financial activity chart data
  const financialActivityData = [
    { month: 'Jan', income: 450000, expenses: 380000 },
    { month: 'Feb', income: 520000, expenses: 420000 },
    { month: 'Mar', income: 480000, expenses: 390000 },
    { month: 'Apr', income: 610000, expenses: 480000 },
    { month: 'May', income: 580000, expenses: 450000 },
    { month: 'Jun', income: 650000, expenses: 510000 }
  ];

  // Goal status distribution
  const goalStatusData = [
    { name: 'Completed', value: 1245, color: '#10b981' },
    { name: 'In Progress', value: 2890, color: '#3b82f6' },
    { name: 'Missed', value: 988, color: '#ef4444' }
  ];

  // Top badges
  const topBadges = [
    { name: 'First Budget', count: 234, icon: '🎯' },
    { name: 'Savings Star', count: 189, icon: '⭐' },
    { name: 'Goal Achiever', count: 156, icon: '🏆' },
    { name: 'Expense Tracker', count: 142, icon: '📊' },
    { name: 'Budget Master', count: 98, icon: '👑' }
  ];

  // Recent activities
  const recentActivities = [
    { type: 'registration', user: 'Alice Johnson', time: '2 minutes ago', icon: 'user-plus' },
    { type: 'badge', user: 'Bob Smith', badge: 'Savings Champion', time: '5 minutes ago', icon: 'award' },
    { type: 'goal', user: 'Charlie Brown', goal: 'Emergency Fund', time: '15 minutes ago', icon: 'target' },
    { type: 'transaction', user: 'Diana Prince', amount: 'KES 5,000', time: '23 minutes ago', icon: 'dollar-sign' },
    { type: 'admin', action: 'Updated badge "Budget Master"', time: '1 hour ago', icon: 'settings' }
  ];

  // System alerts
  const systemAlerts = [
    { level: 'warning', message: '5 users with inactive accounts (90+ days)', action: 'Review Users' },
    { level: 'info', message: 'AI recommendation success rate: 68% (target: 75%)', action: 'View Analytics' },
    { level: 'success', message: 'System performance: All services running normally', action: null }
  ];

  // Financial insights
  const financialInsights = {
    totalIncome: 2450000,
    totalExpenses: 1875000,
    avgBalance: 4850,
    totalSavings: 575000,
    topCategories: [
      { name: 'Housing', percentage: 35 },
      { name: 'Food', percentage: 28 },
      { name: 'Transport', percentage: 18 },
      { name: 'Entertainment', percentage: 12 },
      { name: 'Other', percentage: 7 }
    ]
  };

  // Gamification stats
  const gamificationStats = {
    totalBadges: 25,
    totalEarned: 1234,
    totalXP: 45670,
    mostEarned: { name: 'First Budget', count: 234 },
    rarest: { name: 'Master Saver', count: 3 },
    topStudents: [
      { name: 'Alice Johnson', xp: 850, rank: 1 },
      { name: 'Bob Smith', xp: 720, rank: 2 },
      { name: 'Charlie Brown', xp: 680, rank: 3 }
    ]
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', { 
      style: 'currency', 
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getActivityIcon = (type) => {
    switch(type) {
      case 'user-plus':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <line x1="20" y1="8" x2="20" y2="14"></line>
            <line x1="23" y1="11" x2="17" y2="11"></line>
          </svg>
        );
      case 'award':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="7"></circle>
            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
          </svg>
        );
      case 'target':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="6"></circle>
            <circle cx="12" cy="12" r="2"></circle>
          </svg>
        );
      case 'dollar-sign':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        );
      case 'settings':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 6v6m5.2-13.2l-4.2 4.2m0 6l4.2 4.2M1 12h6m6 0h6M6.8 6.8l4.2 4.2m0 6l-4.2 4.2"></path>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="admin-dashboard-page">
      <AdminNavbar activePage="Dashboard" />
      
      <main className="admin-dashboard-main">
        <div className="admin-dashboard-container">
          
          {/* Header Section */}
          <div className="dashboard-header">
            <div className="header-left">
              <h1 className="dashboard-title">Admin Dashboard</h1>
              <p className="dashboard-subtitle">Welcome back, Admin!</p>
            </div>
            <div className="header-right">
              <div className="header-info">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>{formatDate(currentTime)}</span>
              </div>
              <div className="header-info">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>{formatTime(currentTime)}</span>
              </div>
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="metrics-grid">
            {/* Total Students Card */}
            <div className="metric-card">
              <div className="metric-icon students">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <div className="metric-content">
                <p className="metric-label">Total Students</p>
                {metricsLoading ? (
                  <div className="metric-skeleton">
                    <div className="skeleton-value"></div>
                    <div className="skeleton-trend"></div>
                  </div>
                ) : (
                  <>
                    <h3 className="metric-value">{metrics.totalStudents.toLocaleString()}</h3>
                    <p className="metric-trend positive">{metrics.studentsGrowth} from last month</p>
                  </>
                )}
              </div>
            </div>

            {/* Active Users Card */}
            <div className="metric-card">
              <div className="metric-icon active">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
              </div>
              <div className="metric-content">
                <p className="metric-label">Active Users</p>
                {metricsLoading ? (
                  <div className="metric-skeleton">
                    <div className="skeleton-value"></div>
                    <div className="skeleton-trend"></div>
                  </div>
                ) : (
                  <>
                    <h3 className="metric-value">{metrics.activeUsers.toLocaleString()}</h3>
                    <p className="metric-trend neutral">{metrics.activePercentage} of total</p>
                  </>
                )}
              </div>
            </div>

            {/* New Today Card */}
            <div className="metric-card">
              <div className="metric-icon new">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <line x1="20" y1="8" x2="20" y2="14"></line>
                  <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
              </div>
              <div className="metric-content">
                <p className="metric-label">New Today</p>
                {metricsLoading ? (
                  <div className="metric-skeleton">
                    <div className="skeleton-value"></div>
                    <div className="skeleton-trend"></div>
                  </div>
                ) : (
                  <>
                    <h3 className="metric-value">{metrics.newToday}</h3>
                    <p className={`metric-trend ${parseInt(metrics.newComparison) >= 0 ? 'positive' : 'negative'}`}>
                      {metrics.newComparison} vs average
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Financial Entries Card (Not connected yet) */}
            <div className="metric-card">
              <div className="metric-icon entries">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
              <div className="metric-content">
                <p className="metric-label">Financial Data Entries</p>
                <h3 className="metric-value">{metrics.financialEntries.toLocaleString()}</h3>
                <p className="metric-trend neutral">{metrics.entriesToday} entries today</p>
              </div>
            </div>

            {/* Goals Card (Not connected yet) */}
            <div className="metric-card">
              <div className="metric-icon goals">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="6"></circle>
                  <circle cx="12" cy="12" r="2"></circle>
                </svg>
              </div>
              <div className="metric-content">
                <p className="metric-label">Goals Created</p>
                <h3 className="metric-value">{metrics.activeGoals.toLocaleString()}</h3>
                <p className="metric-trend neutral">{metrics.goalsCreated} active now</p>
              </div>
            </div>

            {/* Badges Card (Not connected yet) */}
            <div className="metric-card">
              <div className="metric-icon badges">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                </svg>
              </div>
              <div className="metric-content">
                <p className="metric-label">Badges Earned</p>
                <h3 className="metric-value">{metrics.badgesEarned.toLocaleString()}</h3>
                <p className="metric-trend neutral">{metrics.badgesToday} earned today</p>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="charts-grid">
            {/* User Growth Chart */}
            <div className="chart-card">
              <div className="chart-header">
                <h3 className="chart-title">User Growth (Last 7 Days)</h3>
              </div>
              <div className="chart-content">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={userGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="users" 
                      stroke="#4c6ef5" 
                      strokeWidth={3}
                      dot={{ fill: '#4c6ef5', r: 5 }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Financial Activity Chart */}
            <div className="chart-card">
              <div className="chart-header">
                <h3 className="chart-title">Financial Activity</h3>
              </div>
              <div className="chart-content">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={financialActivityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Legend />
                    <Bar dataKey="income" fill="#10b981" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="expenses" fill="#ef4444" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Goal Status Chart */}
            <div className="chart-card">
              <div className="chart-header">
                <h3 className="chart-title">Goal Completion Status</h3>
              </div>
              <div className="chart-content">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={goalStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {goalStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Badges */}
            <div className="chart-card">
              <div className="chart-header">
                <h3 className="chart-title">Top Earned Badges</h3>
              </div>
              <div className="chart-content">
                <div className="badges-list">
                  {topBadges.map((badge, index) => (
                    <div key={index} className="badge-item">
                      <div className="badge-rank">#{index + 1}</div>
                      <div className="badge-info">
                        <p className="badge-name">{badge.name}</p>
                        <p className="badge-count">{badge.count} students</p>
                      </div>
                      <div className="badge-icon-display">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section - Two Columns */}
          <div className="bottom-grid">
            {/* Left Column */}
            <div className="bottom-left">
              {/* Recent Activity */}
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title">Recent Activity</h3>
                  <button className="view-all-btn">View All</button>
                </div>
                <div className="activity-list">
                  {recentActivities.map((activity, index) => (
                    <div key={index} className="activity-item">
                      <div className="activity-icon">
                        {getActivityIcon(activity.icon)}
                      </div>
                      <div className="activity-content">
                        {activity.type === 'registration' && (
                          <p><strong>{activity.user}</strong> registered</p>
                        )}
                        {activity.type === 'badge' && (
                          <p><strong>{activity.user}</strong> earned "{activity.badge}" badge</p>
                        )}
                        {activity.type === 'goal' && (
                          <p><strong>{activity.user}</strong> completed goal "{activity.goal}"</p>
                        )}
                        {activity.type === 'transaction' && (
                          <p><strong>{activity.user}</strong> added {activity.amount} income</p>
                        )}
                        {activity.type === 'admin' && (
                          <p>Admin {activity.action}</p>
                        )}
                        <span className="activity-time">{activity.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Insights */}
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title">Financial Insights</h3>
                </div>
                <div className="insights-content">
                  <div className="insight-row">
                    <span className="insight-label">Total Income (All Students):</span>
                    <span className="insight-value">{formatCurrency(financialInsights.totalIncome)}</span>
                  </div>
                  <div className="insight-row">
                    <span className="insight-label">Total Expenses (All Students):</span>
                    <span className="insight-value">{formatCurrency(financialInsights.totalExpenses)}</span>
                  </div>
                  <div className="insight-row">
                    <span className="insight-label">Average Balance per Student:</span>
                    <span className="insight-value">{formatCurrency(financialInsights.avgBalance)}</span>
                  </div>
                  <div className="insight-row">
                    <span className="insight-label">Total Savings:</span>
                    <span className="insight-value success">{formatCurrency(financialInsights.totalSavings)}</span>
                  </div>
                  
                  <div className="categories-section">
                    <h4 className="categories-title">Top Expense Categories:</h4>
                    {financialInsights.topCategories.map((category, index) => (
                      <div key={index} className="category-item">
                        <div className="category-info">
                          <span className="category-number">{index + 1}.</span>
                          <span className="category-name">{category.name}</span>
                        </div>
                        <span className="category-percentage">{category.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="bottom-right">
              {/* System Alerts */}
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title">System Alerts</h3>
                </div>
                <div className="alerts-list">
                  {systemAlerts.map((alert, index) => (
                    <div key={index} className={`alert-item ${alert.level}`}>
                      <div className="alert-icon">
                        {alert.level === 'warning' && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                          </svg>
                        )}
                        {alert.level === 'info' && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                          </svg>
                        )}
                        {alert.level === 'success' && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                          </svg>
                        )}
                      </div>
                      <div className="alert-content">
                        <p className="alert-message">{alert.message}</p>
                        {alert.action && (
                          <button className="alert-action">{alert.action} →</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title">Quick Actions</h3>
                </div>
                <div className="quick-actions-grid">
                  <button className="quick-action-btn" onClick={() => navigate('/admin/badges')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                    </svg>
                    <span>Create New Badge</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => navigate('/admin/analytics')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="20" x2="12" y2="10"></line>
                      <line x1="18" y1="20" x2="18" y2="4"></line>
                      <line x1="6" y1="20" x2="6" y2="16"></line>
                    </svg>
                    <span>Generate Report</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => navigate('/admin/users')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span>View All Users</span>
                  </button>
                  <button className="quick-action-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                    <span>Send Announcement</span>
                  </button>
                </div>
              </div>

              {/* Gamification Stats */}
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title">Gamification Overview</h3>
                </div>
                <div className="gamification-content">
                  <div className="gamification-stats">
                    <div className="stat-item">
                      <p className="stat-label">Total Badges Available</p>
                      <p className="stat-value">{gamificationStats.totalBadges}</p>
                    </div>
                    <div className="stat-item">
                      <p className="stat-label">Total Badges Earned</p>
                      <p className="stat-value">{gamificationStats.totalEarned.toLocaleString()}</p>
                    </div>
                    <div className="stat-item">
                      <p className="stat-label">Total XP Awarded</p>
                      <p className="stat-value">{gamificationStats.totalXP.toLocaleString()} XP</p>
                    </div>
                  </div>

                  <div className="badge-highlights">
                    <div className="highlight-item">
                      <p className="highlight-label">Most Earned Badge:</p>
                      <p className="highlight-value">
                        "{gamificationStats.mostEarned.name}" ({gamificationStats.mostEarned.count} earners)
                      </p>
                    </div>
                    <div className="highlight-item">
                      <p className="highlight-label">Rarest Badge:</p>
                      <p className="highlight-value">
                        "{gamificationStats.rarest.name}" ({gamificationStats.rarest.count} earners)
                      </p>
                    </div>
                  </div>

                  <div className="top-students">
                    <h4 className="top-students-title">Top 3 Students by XP:</h4>
                    {gamificationStats.topStudents.map((student, index) => (
                      <div key={index} className="student-item">
                        <div className="student-rank">
                          {student.rank === 1 && '🥇'}
                          {student.rank === 2 && '🥈'}
                          {student.rank === 3 && '🥉'}
                        </div>
                        <p className="student-name">{student.name}</p>
                        <p className="student-xp">{student.xp} XP</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;