import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import DashboardNavbar from '../components/DashboardNavbar';
import DashboardFooter from '../components/DashboardFooter';
import authService from '../services/authService';
import api from '../api/axios';
import './FinanceHub.css';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const FinanceHub = () => {
  const navigate = useNavigate();
  const location = useLocation();
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

  const [budgetMetadata, setBudgetMetadata] = useState({
    categories: [],
    statuses: []
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

  // Budget form data
  const [editingBudget, setEditingBudget] = useState(null);
  const [budgetFormData, setBudgetFormData] = useState({
    category: '',
    amount: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    actual_spent: 0,
    status: 'active'
  });

  // Transactions list
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  // Spending breakdown by category
  const [categoryBreakdown, setCategoryBreakdown] = useState({});

  // Handle navigation from Budgets page
  useEffect(() => {
    if (location.state?.openBudgetForm) {
      setActiveView('set-budget');
      
      if (location.state?.editBudget) {
        const budgetToEdit = location.state.editBudget;
        setEditingBudget(budgetToEdit);
        setBudgetFormData({
          category: budgetToEdit.category,
          amount: budgetToEdit.amount,
          start_date: budgetToEdit.start_date,
          end_date: budgetToEdit.end_date,
          actual_spent: budgetToEdit.actual_spent || 0,
          status: budgetToEdit.status
        });
      }
      
      // Clear the navigation state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Fetch data on component mount
  useEffect(() => {
    fetchMetadata();
    fetchBudgetMetadata();
    fetchTransactions();
  }, []);

  const fetchMetadata = async () => {
    try {
      const response = await api.get('/financial-data/metadata');
      
      if (response.data && response.data.data) {
        setMetadata(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching metadata:', err);
      setMetadata({
        entry_types: ['income', 'expense'],
        categories: ['Food & Drinks', 'Transportation', 'Entertainment', 'Education', 'Housing', 'Utilities', 'Healthcare', 'Shopping', 'Salary', 'Other'],
        payment_methods: ['cash', 'card', 'bank_transfer', 'mobile_money', 'other']
      });
    }
  };

  const fetchBudgetMetadata = async () => {
    try {
      const response = await api.get('/budgets/metadata');
      
      if (response.data && response.data.data) {
        setBudgetMetadata(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching budget metadata:', err);
      setBudgetMetadata({
        categories: ['Food & Drinks', 'Transportation', 'Entertainment', 'Education', 'Housing', 'Utilities', 'Healthcare', 'Shopping', 'Other'],
        statuses: ['active', 'completed', 'over', 'under']
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

  const handleBudgetChange = (e) => {
    const { name, value } = e.target;
    setBudgetFormData(prev => ({
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

  const handleBudgetSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();

    if (parseFloat(budgetFormData.amount) <= 0) {
      setError('Budget amount must be greater than 0');
      setLoading(false);
      return;
    }

    const submissionData = {
      category: budgetFormData.category,
      amount: parseFloat(budgetFormData.amount),
      start_date: budgetFormData.start_date,
      end_date: budgetFormData.end_date,
      actual_spent: parseFloat(budgetFormData.actual_spent) || 0,
      status: budgetFormData.status || 'active'
    };

    try {
      if (editingBudget) {
        await api.put(`/budgets/${editingBudget.id}`, submissionData);
        setMessage('Budget updated successfully!');
      } else {
        await api.post('/budgets', submissionData);
        setMessage('Budget created successfully!');
      }
      
      setBudgetFormData({
        category: '',
        amount: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        actual_spent: 0,
        status: 'active'
      });

      setEditingBudget(null);

      setTimeout(() => {
        setMessage('');
      }, 2000);

    } catch (err) {
      console.error('Error saving budget:', err);
      if (err.response?.data?.errors) {
        const errors = Object.values(err.response.data.errors).flat();
        setError(errors.join(', '));
      } else {
        setError(err.response?.data?.message || 'Failed to save budget. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (transaction) => {
  // Debug logging
  console.log('Transaction object:', transaction);
  console.log('Transaction ID:', transaction.id);
  console.log('Transaction entry_id:', transaction.entry_id);
  
  // Get the correct ID (either id or entry_id)
  const transactionId = transaction.id || transaction.entry_id;
  
  console.log('Using ID:', transactionId);
  
  if (!transactionId) {
    setError('Transaction ID not found');
    setTimeout(() => setError(''), 3000);
    return;
  }
  
  if (!window.confirm('Are you sure you want to delete this transaction?')) {
    return;
  }

  try {
    console.log('Deleting transaction with ID:', transactionId);
    const response = await api.delete(`/financial-data/${transactionId}`);
    console.log('Delete response:', response);
    
    setMessage('Transaction deleted successfully!');
    
    setTimeout(() => {
      setMessage('');
      fetchTransactions();
    }, 1500);
  } catch (err) {
    console.error('Error deleting transaction:', err);
    console.error('Error response:', err.response);
    console.error('Error details:', err.response?.data);
    setError(err.response?.data?.message || 'Failed to delete transaction.');
    setTimeout(() => setError(''), 3000);
  }
};

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  const getCategoryColor = (index) => {
    const colors = ['#4c6ef5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    return colors[index % colors.length];
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Food & Drinks': '🍔',
      'Transportation': '🚗',
      'Entertainment': '🎬',
      'Education': '📚',
      'Housing': '🏠',
      'Utilities': '💡',
      'Healthcare': '🏥',
      'Shopping': '🛍️',
      'Salary': '💵',
      'Other': '📦'
    };
    return icons[category] || '💰';
  };

  return (
    <div className="finance-hub-page">
      <DashboardNavbar activePage="Finance Hub" />
      
      <main className="finance-hub-main">
        <div className="finance-hub-container">
          {/* Page Header */}
          <div className="page-header">
            <h1>Finance Hub</h1>
            <p>Manage your income, expenses, and budgets all in one place</p>
          </div>

          {/* Action Tabs */}
          <div className="action-tabs">
            <button
              className={`tab-button ${activeView === 'add-income' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('add-income');
                setEditingBudget(null);
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
                setEditingBudget(null);
                clearMessages();
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
              Add Expense
            </button>
            <button 
              className={`tab-button ${activeView === 'set-budget' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('set-budget');
                clearMessages();
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
                <path d="M12 18V6"></path>
              </svg>
              Set Budget
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

          <div className="finance-content-grid">
            {/* Left Column - Forms */}
            <div className="finance-left">
              <div className="finance-card">
                <h2 className="card-title">
                  {activeView === 'add-income' && '💵 Add New Income'}
                  {activeView === 'add-expense' && '💳 Add New Expense'}
                  {activeView === 'set-budget' && (editingBudget ? '✏️ Edit Budget' : '🎯 Set New Budget')}
                </h2>

                {/* Income/Expense Form */}
                {(activeView === 'add-income' || activeView === 'add-expense') && (
                  <form onSubmit={handleSubmit} className="finance-form">
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
                )}

                {/* Budget Form */}
                {activeView === 'set-budget' && (
                  <form onSubmit={handleBudgetSubmit} className="finance-form">
                    <div className="form-group">
                      <label htmlFor="budget_category">Category</label>
                      <select
                        id="budget_category"
                        name="category"
                        value={budgetFormData.category}
                        onChange={handleBudgetChange}
                        required
                        disabled={loading}
                      >
                        <option value="">Select a category</option>
                        {budgetMetadata.categories.map((cat, index) => (
                          <option key={index} value={cat}>
                            {getCategoryIcon(cat)} {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="budget_amount">Budget Amount (KES)</label>
                      <div className="amount-input">
                        <span className="currency-symbol">KES</span>
                        <input
                          type="number"
                          id="budget_amount"
                          name="amount"
                          value={budgetFormData.amount}
                          onChange={handleBudgetChange}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="start_date">Start Date</label>
                      <input
                        type="date"
                        id="start_date"
                        name="start_date"
                        value={budgetFormData.start_date}
                        onChange={handleBudgetChange}
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="end_date">End Date</label>
                      <input
                        type="date"
                        id="end_date"
                        name="end_date"
                        value={budgetFormData.end_date}
                        onChange={handleBudgetChange}
                        required
                        disabled={loading}
                      />
                    </div>

                    <button type="submit" className="submit-btn" disabled={loading}>
                      {loading ? 'Saving...' : editingBudget ? '💾 Update Budget' : ' Create Budget'}
                    </button>

                    {editingBudget && (
                      <button 
                        type="button" 
                        className="cancel-btn"
                        onClick={() => {
                          setEditingBudget(null);
                          setBudgetFormData({
                            category: '',
                            amount: '',
                            start_date: new Date().toISOString().split('T')[0],
                            end_date: '',
                            actual_spent: 0,
                            status: 'active'
                          });
                        }}
                        style={{ marginTop: '12px' }}
                      >
                        Cancel Edit
                      </button>
                    )}

                    <Link to="/budgets" className="view-all-link">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                      View All Budgets
                    </Link>
                  </form>
                )}
              </div>
            </div>

            {/* Right Column - Spending Breakdown */}
            <div className="finance-right">
              <div className="finance-card">
                <h2 className="card-title">📊 Spending Breakdown</h2>
                {Object.keys(categoryBreakdown).length > 0 ? (
                  <div className="breakdown-container">
                    <div className="spending-chart">
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
                                strokeWidth={2}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => `KES ${value.toFixed(2)}`}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="category-legend">
                      {Object.keys(categoryBreakdown).map((category, index) => (
                        <div key={index} className="legend-item">
                          <span 
                            className="legend-color" 
                            style={{ backgroundColor: getCategoryColor(index) }}
                          ></span>
                          <span className="legend-label">{category}</span>
                          <span className="legend-value">
                            KES {categoryBreakdown[category].amount.toFixed(2)} ({categoryBreakdown[category].percentage}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="empty-chart">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <p>No expense data yet. Add your first expense to see the breakdown!</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="finance-card transactions-card">
            <h2 className="card-title">📝 Recent Transactions</h2>
            
            {transactionsLoading ? (
              <div className="loading-state">Loading transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                  <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
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
                         onClick={() => handleDeleteTransaction(transaction)}
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
      </main>

      <DashboardFooter />
    </div>
  );
};

export default FinanceHub;