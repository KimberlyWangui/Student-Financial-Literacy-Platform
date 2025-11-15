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
    const transactionId = transaction.id || transaction.entry_id;
    
    if (!transactionId) {
      setError('Transaction ID not found');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    try {
      await api.delete(`/financial-data/${transactionId}`);
      setMessage('Transaction deleted successfully!');
      
      setTimeout(() => {
        setMessage('');
        fetchTransactions();
      }, 1500);
    } catch (err) {
      console.error('Error deleting transaction:', err);
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
    const iconMap = {
      'Food & Drinks': (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
          <line x1="6" y1="1" x2="6" y2="4"></line>
          <line x1="10" y1="1" x2="10" y2="4"></line>
          <line x1="14" y1="1" x2="14" y2="4"></line>
        </svg>
      ),
      'Transportation': (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path>
          <circle cx="7" cy="17" r="2"></circle>
          <path d="M9 17h6"></path>
          <circle cx="17" cy="17" r="2"></circle>
        </svg>
      ),
      'Entertainment': (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
          <polyline points="17 2 12 7 7 2"></polyline>
        </svg>
      ),
      'Education': (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
      ),
      'Housing': (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      ),
      'Utilities': (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      ),
      'Healthcare': (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
        </svg>
      ),
      'Shopping': (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
      ),
      'Salary': (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23"></line>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
      ),
      'Other': (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      )
    };
    
    return iconMap[category] || iconMap['Other'];
  };

  return (
    <div className="finance-hub-page">
      <DashboardNavbar activePage="Finance Hub" />
      
      <main className="finance-hub-main">
        <div className="finance-hub-container">
          {/* Page Header */}
          <div className="page-header">
            <div className="page-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
            </div>
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
                  {activeView === 'add-income' && (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="1" x2="12" y2="23"></line>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                      </svg>
                      Add New Income
                    </>
                  )}
                  {activeView === 'add-expense' && (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                        <line x1="1" y1="10" x2="23" y2="10"></line>
                      </svg>
                      Add New Expense
                    </>
                  )}
                  {activeView === 'set-budget' && (
                    <>
                      {editingBudget ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
                          <path d="M12 18V6"></path>
                        </svg>
                      )}
                      {editingBudget ? 'Edit Budget' : 'Set New Budget'}
                    </>
                  )}
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
                          <option key={index} value={cat}>{cat}</option>
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
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                      </svg>
                      {loading ? 'Saving...' : editingBudget ? 'Update Budget' : 'Create Budget'}
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
                <h2 className="card-title">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                  </svg>
                  Spending Breakdown
                </h2>
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
            <h2 className="card-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              Recent Transactions
            </h2>
            
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