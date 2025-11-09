import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardNavbar from '../components/DashboardNavbar';
import DashboardFooter from '../components/DashboardFooter';
import authService from '../services/authService';
import api from '../api/axios';
import './Budgets.css';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';


const Budgets = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  // State management
  const [activeView, setActiveView] = useState('add-expense');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  // Metadata from API
  const [metadata, setMetadata] = useState({
    entry_types: ['income', 'expense'],
    categories: [],
    payment_methods: []
  });

  // Form data for adding income/expense
  const [formData, setFormData] = useState({
    entry_type: 'expense',
    category: '',
    amount: '',
    entry_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    description: ''
  });

  // Transactions list
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  // Financial summary
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0
  });

  // Spending breakdown by category
  const [categoryBreakdown, setCategoryBreakdown] = useState({});

  // Fetch data on component mount
  useEffect(() => {
    fetchMetadata();
    fetchTransactions();
    fetchFinancialSummary();
  }, []);

  const fetchMetadata = async () => {
    try {
      const response = await api.get('/financial-data/metadata');
      
      if (response.data && response.data.data) {
        setMetadata(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching metadata:', err);
      // Set fallback metadata
      setMetadata({
        entry_types: ['income', 'expense'],
        categories: ['Food & Drinks', 'Transportation', 'Entertainment', 'Education', 'Housing', 'Utilities', 'Healthcare', 'Shopping', 'Salary', 'Other'],
        payment_methods: ['cash', 'card', 'bank_transfer', 'mobile_money', 'other']
      });
    }
  };

  const fetchTransactions = async () => {
    setTransactionsLoading(true);
    try {
      const response = await api.get('/financial-data', {
        params: { per_page: 15 }
      });
      
      let transactionData = [];
      
      if (response.data && response.data.data) {
        if (Array.isArray(response.data.data.data)) {
          transactionData = response.data.data.data;
        } else if (Array.isArray(response.data.data)) {
          transactionData = response.data.data;
        }
      }
      
      setTransactions(transactionData);
      calculateCategoryBreakdown(transactionData);
      
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const fetchFinancialSummary = async () => {
    try {
      const response = await api.get('/financial-data/my-summary');
      
      if (response.data && response.data.data && response.data.data.summary) {
        const summaryData = response.data.data.summary;
        setSummary({
          totalIncome: parseFloat(summaryData.total_income) || 0,
          totalExpenses: parseFloat(summaryData.total_expenses) || 0,
          balance: parseFloat(summaryData.balance) || 0
        });
      }
    } catch (err) {
      console.error('Error fetching financial summary:', err);
    }
  };

  const calculateCategoryBreakdown = (data) => {
    if (!Array.isArray(data)) {
      setCategoryBreakdown({});
      return;
    }

    const breakdown = {};
    let totalExpenses = 0;

    data.forEach(transaction => {
      if (transaction.entry_type === 'expense') {
        const amount = parseFloat(transaction.amount);
        totalExpenses += amount;
        
        if (breakdown[transaction.category]) {
          breakdown[transaction.category] += amount;
        } else {
          breakdown[transaction.category] = amount;
        }
      }
    });

    // Calculate percentages
    const breakdownWithPercentages = {};
    Object.keys(breakdown).forEach(category => {
      breakdownWithPercentages[category] = {
        amount: breakdown[category],
        percentage: totalExpenses > 0 ? (breakdown[category] / totalExpenses * 100).toFixed(1) : 0
      };
    });

    setCategoryBreakdown(breakdownWithPercentages);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    clearMessages();
  };

  const clearMessages = () => {
    setMessage('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();

    if (parseFloat(formData.amount) <= 0) {
      setError('Amount must be greater than 0');
      setLoading(false);
      return;
    }

    const submissionData = {
      entry_type: activeView === 'add-income' ? 'income' : 'expense',
      category: formData.category,
      amount: parseFloat(formData.amount),
      entry_date: formData.entry_date,
      payment_method: formData.payment_method || null,
      description: formData.description || null
    };

    try {
      await api.post('/financial-data', submissionData);

      setMessage(`${submissionData.entry_type === 'income' ? 'Income' : 'Expense'} added successfully!`);
      
      setFormData({
        entry_type: 'expense',
        category: '',
        amount: '',
        entry_date: new Date().toISOString().split('T')[0],
        payment_method: '',
        description: ''
      });

      setTimeout(() => {
        setMessage('');
        fetchTransactions();
        fetchFinancialSummary();
      }, 2000);

    } catch (err) {
      console.error('Error adding entry:', err);
      if (err.response?.data?.errors) {
        const errors = Object.values(err.response.data.errors).flat();
        setError(errors.join(', '));
      } else {
        setError(err.response?.data?.message || 'Failed to add entry. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    try {
      await api.delete(`/financial-data/${id}`);
      setMessage('Transaction deleted successfully!');
      
      setTimeout(() => {
        setMessage('');
        fetchTransactions();
        fetchFinancialSummary();
      }, 1500);
    } catch (err) {
      console.error('Error deleting transaction:', err);
      setError('Failed to delete transaction.');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  // Generate colors for pie chart
  const getCategoryColor = (index) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    return colors[index % colors.length];
  };

  // Calculate pie chart segments
  const generatePieChartSegments = () => {
    const categories = Object.keys(categoryBreakdown);
    if (categories.length === 0) return null;

    let cumulativePercentage = 0;
    const segments = categories.map((category, index) => {
      const percentage = parseFloat(categoryBreakdown[category].percentage);
      const startAngle = (cumulativePercentage / 100) * 360;
      const endAngle = ((cumulativePercentage + percentage) / 100) * 360;
      cumulativePercentage += percentage;

      // Calculate SVG path for pie slice
      const radius = 40;
      const centerX = 50;
      const centerY = 50;
      
      const startRad = (startAngle - 90) * Math.PI / 180;
      const endRad = (endAngle - 90) * Math.PI / 180;
      
      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);
      
      const largeArc = percentage > 50 ? 1 : 0;
      
      return {
        category,
        color: getCategoryColor(index),
        path: `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`,
        percentage: percentage.toFixed(1)
      };
    });

    return segments;
  };

  return (
    <div className="budgets-page">
      <DashboardNavbar activePage="Budgets" />
      
      <main className="budgets-main">
        <div className="budgets-container">
          {/* Action Tabs */}
          <div className="action-tabs">
            <button
              className={`tab-button ${activeView === 'add-income' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('add-income');
                clearMessages();
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
              Add Income
            </button>
            <button
              className={`tab-button ${activeView === 'add-expense' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('add-expense');
                clearMessages();
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
              Add Expense
            </button>
            <button className="tab-button" onClick={() => alert('Budget feature coming soon!')}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
                <path d="M12 18V6"></path>
              </svg>
              Set Budget
            </button>
          </div>

          <div className="budgets-content-grid">
            {/* Left Column - Add Form */}
            <div className="budgets-left">
              <div className="budgets-card">
                <h2 className="card-title">
                  {activeView === 'add-income' ? 'Add New Income' : 'Add New Expense'}
                </h2>

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

                <form onSubmit={handleSubmit} className="budgets-form">
                  <div className="form-group">
                    <label htmlFor="amount">Amount (KES)</label>
                    <div className="amount-input">
                      <span className="currency-symbol">KES</span>
                      <input
                        type="number"
                        id="amount"
                        name="amount"
                        value={formData.amount}
                        onChange={handleChange}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="category">Category</label>
                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      required
                      disabled={loading}
                    >
                      <option value="">Select a category</option>
                      {metadata.categories.map((cat, index) => (
                        <option key={index} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="entry_date">Date</label>
                    <input
                      type="date"
                      id="entry_date"
                      name="entry_date"
                      value={formData.entry_date}
                      onChange={handleChange}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="payment_method">Payment Method</label>
                    <select
                      id="payment_method"
                      name="payment_method"
                      value={formData.payment_method}
                      onChange={handleChange}
                      disabled={loading}
                    >
                      <option value="">Select payment method (optional)</option>
                      {metadata.payment_methods.map((method, index) => (
                        <option key={index} value={method}>{method}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Optional notes about this transaction..."
                      rows="3"
                      maxLength="500"
                      disabled={loading}
                    />
                  </div>

                  <button type="submit" className="submit-btn" disabled={loading}>
                    {loading ? 'Adding...' : `Add ${activeView === 'add-income' ? 'Income' : 'Expense'}`}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column - Spending Breakdown & Recent Transactions */}
            <div className="budgets-right" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Spending Breakdown with Recharts */}
                <div className="budgets-card" style={{ marginBottom: 0 }}>
                    <h2 className="card-title">Spending Breakdown</h2>
                    {Object.keys(categoryBreakdown).length > 0 ? (
                        <div className="breakdown-container" style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                            <div className="spending-chart" style={{ flex: '0 0 300px' }}>
                                <ResponsiveContainer width={300} height={300}>
                                    <PieChart>
                                        <Pie
                                            data={Object.keys(categoryBreakdown).map((category, index) => ({
                                                name: category,
                                                value: categoryBreakdown[category].amount,
                                            }))}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={100}
                                            label={({ name, percent }) =>
                                                `${name} ${(percent * 100).toFixed(0)}%`
                                            }
                                        >
                                            {Object.keys(categoryBreakdown).map((category, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={getCategoryColor(index)}
                                                    stroke="white"
                                                    strokeWidth={1}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value, name) => [
                                                `KES ${value.toFixed(2)}`,
                                                name,
                                            ]}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="breakdown-legend" style={{ flex: 1 }}>
                                <Legend
                                    layout="vertical"
                                    align="left"
                                    verticalAlign="middle"
                                    wrapperStyle={{
                                        fontSize: '13px',
                                        paddingLeft: '10px',
                                    }}
                                />
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {Object.keys(categoryBreakdown).map((category, index) => (
                                        <li key={category} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                                            <span
                                                style={{
                                                    display: 'inline-block',
                                                    width: '16px',
                                                    height: '16px',
                                                    backgroundColor: getCategoryColor(index),
                                                    borderRadius: '4px',
                                                    marginRight: '8px',
                                                }}
                                            ></span>
                                            <span style={{ flex: 1 }}>{category}</span>
                                            <span style={{ marginLeft: '8px', fontWeight: 'bold' }}>
                                                KES {categoryBreakdown[category].amount.toFixed(2)}
                                            </span>
                                            <span style={{ marginLeft: '8px', color: '#888' }}>
                                                ({categoryBreakdown[category].percentage}%)
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-chart">
                            <p>No expense data yet. Add your first expense to see the breakdown!</p>
                        </div>
                    )}
                </div>

              {/* Recent Transactions */}
              <div className="budgets-card transactions-card">
                <h2 className="card-title">Recent Transactions</h2>
                
                {transactionsLoading ? (
                  <div className="loading-state">Loading transactions...</div>
                ) : transactions.length === 0 ? (
                  <div className="empty-state">
                    <p>No transactions yet. Add your first income or expense above!</p>
                  </div>
                ) : (
                  <div className="transactions-table">
                    <div className="table-header">
                      <span>Date</span>
                      <span>Description</span>
                      <span>Category</span>
                      <span>Amount</span>
                      <span>Action</span>
                    </div>
                    {transactions.map((transaction) => (
                      <div key={transaction.id} className="table-row">
                        <span className="col-date">{formatDate(transaction.entry_date)}</span>
                        <span className="col-description">{transaction.description || transaction.category}</span>
                        <span className="col-category">
                          <span className="category-badge">{transaction.category}</span>
                        </span>
                        <span className={`col-amount ${transaction.entry_type === 'income' ? 'positive' : 'negative'}`}>
                          {transaction.entry_type === 'income' ? '+' : '-'}KES {parseFloat(transaction.amount).toFixed(2)}
                        </span>
                        <span className="col-action">
                          <button 
                            onClick={() => handleDeleteTransaction(transaction.entry_id)}
                            className="delete-btn"
                            title="Delete transaction"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                        </span>
                      </div>
                    ))}
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

export default Budgets;