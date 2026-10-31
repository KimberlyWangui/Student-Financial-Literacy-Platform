import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import DashboardNavbar from '../components/DashboardNavbar';
import DashboardFooter from '../components/DashboardFooter';
import api from '../api/axios';
import './Simulations.css';
import { wakeSimulator } from '../api/wake';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const Simulations = () => {
  const location = useLocation();

  // The Recommendations page can open this page with a suggested investment type and monthly amount.
  const prefill = location?.state?.prefill || null;

  // Investment types state
  const [investmentTypes, setInvestmentTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // Form state - matching new API requirements
  const [formData, setFormData] = useState({
    duration_value: prefill?.duration_value ? String(prefill.duration_value) : '',
    duration_unit: prefill?.duration_unit === 'years' ? 'years' : 'months',
    amount_invested: prefill?.initial_amount ? String(prefill.initial_amount) : '',
    investment_type: prefill?.investment_type || '',
    monthly_topup: prefill?.monthly_amount ? String(prefill.monthly_amount) : '',
    target_amount: '',
    reinvestment_frequency: 'monthly'
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState(prefill?.investment_type ? 'simulate' : 'explore'); // 'explore', 'simulate', 'history'
  const [prefillNote, setPrefillNote] = useState(
    prefill?.source === 'quick'
      ? { quick: true }
      : prefill?.monthly_amount ? { quick: false, monthly: Number(prefill.monthly_amount) } : null
  );
  
  // Simulation results
  const [previewResult, setPreviewResult] = useState(null);
  const [savedSimulations, setSavedSimulations] = useState([]);
  const [simulationsLoading, setSimulationsLoading] = useState(true);
  
  // Statistics
  const [statistics, setStatistics] = useState(null);
  const [selectedSimulation, setSelectedSimulation] = useState(null);

  useEffect(() => {
    wakeSimulator();
    fetchInvestmentTypes();
    fetchSimulations();
    fetchStatistics();
  }, []);

  const fetchInvestmentTypes = async () => {
    setLoadingTypes(true);
    try {
      const response = await api.get('/investments/types');
      
      if (response.data && response.data.data) {
        setInvestmentTypes(response.data.data.investment_types || []);
      }
    } catch (err) {
      console.error('Error fetching investment types:', err);
      setError('Failed to load investment options. Please refresh the page.');
    } finally {
      setLoadingTypes(false);
    }
  };

  const fetchSimulations = async () => {
    setSimulationsLoading(true);
    try {
      const response = await api.get('/investments', {
        params: { per_page: 20 }
      });
      
      if (response.data && response.data.data) {
        const simData = response.data.data;
        if (simData.data && Array.isArray(simData.data)) {
          setSavedSimulations(simData.data);
        } else if (Array.isArray(simData)) {
          setSavedSimulations(simData);
        } else {
          setSavedSimulations([]);
        }
      }
    } catch (err) {
      console.error('Error fetching simulations:', err);
      setSavedSimulations([]);
    } finally {
      setSimulationsLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await api.get('/investments/my-statistics');
      
      if (response.data && response.data.data) {
        setStatistics(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
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

  const handleSelectInvestmentType = (type) => {
    setFormData(prev => ({
      ...prev,
      investment_type: type
    }));
    setActiveView('simulate');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePreview = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();

    // Validation
    if (parseFloat(formData.amount_invested) <= 0) {
      setError('Initial investment must be greater than 0');
      setLoading(false);
      return;
    }

    if (parseInt(formData.duration_value) <= 0) {
      setError('Duration must be greater than 0');
      setLoading(false);
      return;
    }

    if (!formData.investment_type) {
      setError('Please select an investment type');
      setLoading(false);
      return;
    }

    const submissionData = {
      amount_invested: parseFloat(formData.amount_invested),
      duration_value: parseInt(formData.duration_value),
      duration_unit: formData.duration_unit,
      investment_type: formData.investment_type,
      monthly_topup: parseFloat(formData.monthly_topup) || 0,
      target_amount: parseFloat(formData.target_amount) || null,
      reinvestment_frequency: formData.reinvestment_frequency
    };

    try {
      const response = await api.post('/investments/preview', submissionData);
      
      if (response.data && response.data.data) {
        setPreviewResult(response.data.data);
        setMessage('Simulation preview calculated successfully!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      console.error('Error previewing simulation:', err);
      if (err.response?.data?.errors) {
        const errors = Object.values(err.response.data.errors).flat();
        setError(errors.join(', '));
      } else {
        setError(err.response?.data?.message || 'Failed to calculate preview.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!previewResult) {
      setError('Please preview a simulation first before saving.');
      return;
    }

    setLoading(true);
    clearMessages();

    const submissionData = {
      amount_invested: parseFloat(formData.amount_invested),
      duration_value: parseInt(formData.duration_value),
      duration_unit: formData.duration_unit,
      investment_type: formData.investment_type,
      monthly_topup: parseFloat(formData.monthly_topup) || 0,
      target_amount: parseFloat(formData.target_amount) || null,
      reinvestment_frequency: formData.reinvestment_frequency
    };

    try {
      await api.post('/investments', submissionData);
      setMessage('Investment simulation saved successfully!');

      setFormData({
        amount_invested: '',
        duration_value: '',
        duration_unit: 'months',
        investment_type: '',
        monthly_topup: '',
        target_amount: '',
        reinvestment_frequency: 'monthly'
      });
      setPreviewResult(null);
      
      setTimeout(() => {
        setMessage('');
        fetchSimulations();
        fetchStatistics();
        setActiveView('history');
      }, 2000);
    } catch (err) {
      console.error('Error saving simulation:', err);
      if (err.response?.data?.errors) {
        const errors = Object.values(err.response.data.errors).flat();
        setError(errors.join(', '));
      } else {
        setError(err.response?.data?.message || 'Failed to save simulation.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewSimulation = (simulation) => {
    setSelectedSimulation(simulation);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (simulationId) => {
    if (!window.confirm('Are you sure you want to delete this simulation?')) {
      return;
    }

    try {
      await api.delete(`/investments/${simulationId}`);
      setMessage('Simulation deleted successfully!');
      
      setTimeout(() => {
        setMessage('');
        fetchSimulations();
        fetchStatistics();
      }, 1500);
    } catch (err) {
      console.error('Error deleting simulation:', err);
      setError('Failed to delete simulation.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleReset = () => {
    setFormData({
      amount_invested: '',
      duration_value: '',
      duration_unit: 'months',
      investment_type: '',
      monthly_topup: '',
      target_amount: '',
      reinvestment_frequency: 'monthly'
    });
    setPreviewResult(null);
    setSelectedSimulation(null);
    clearMessages();
  };

  const formatCurrency = (amount) => {
    const numAmount = typeof amount === 'string' 
      ? parseFloat(amount.replace(/,/g, ''))
      : parseFloat(amount);
    
    return numAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const generateChartData = (timeline) => {
    if (!timeline || timeline.length === 0) return [];
    
    return timeline.map(item => ({
      month: `Month ${item.month}`,
      value: item.value,
      contributions: item.contributions_to_date,
      growth: item.growth
    }));
  };

  // Simulations saved before tax was modelled have no after_tax_annual_return, so they are not labelled.
  const whole = (amount) => Math.round(parseFloat(String(amount).replace(/,/g, ''))).toLocaleString('en-US');

  const SHORT_INTRO = {
    mmf: 'Easy-access savings that earn steady interest. Good for emergency money.',
    tbill: 'Lend to the government for 3 to 12 months. The return is fixed when you buy.',
    stock: 'Own a small piece of companies. It can grow, but it can also fall for years.',
    bond: 'Lend to the government for several years. Pays interest twice a year.',
  };
  const shortIntro = (type) => SHORT_INTRO[type.type] || (type.description || '').split('. ')[0].replace(/\.$/, '') + '.';

  const RISK_PLAIN = {
    very_low: 'Very low risk: your money should hardly move.',
    low: 'Low risk: small ups and downs.',
    medium: 'Medium risk: expect some ups and downs.',
    high: 'High risk: the value can drop a lot.',
  };
  const riskPlain = (level) => RISK_PLAIN[level] || '';

  const plainPeriod = (months, fallbackValue, fallbackUnit) => {
    const m = Number(months);
    if (!m) return `${fallbackValue} ${fallbackUnit}`;
    if (m % 12 === 0) return `${m / 12} year${m === 12 ? '' : 's'}`;
    return `${m} month${m === 1 ? '' : 's'}`;
  };

  const taxLabel = (sim) => (sim?.model_parameters?.after_tax_annual_return != null ? ' (after tax)' : '');

  const getRiskColor = (riskLevel) => {
    const colors = {
      'very_low': '#10b981',
      'low': '#3b82f6',
      'medium': '#f59e0b',
      'high': '#ef4444'
    };
    return colors[riskLevel] || '#6b7280';
  };

  const getInvestmentTypeIcon = (type) => {
    const icons = {
      mmf: (
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
      ),
      tbill: (
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      ),
      stock: (
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      ),
      bond: (
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23"></line>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
      )
    };
    return icons[type] || icons.mmf;
  };

  return (
    <div className="simulations-page">
      <DashboardNavbar activePage="Simulation" />
      
      <main className="simulations-main">
        <div className="simulations-container">
          {/* Page Header */}
          <div className="page-header">
            <div className="page-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <h1>Investment Simulator</h1>
            <p>Explore investment options and see how they could grow. Nothing here is a prediction.</p>
          </div>

          {/* Navigation Tabs */}
          <div className="view-tabs">
            <button 
              className={`tab-btn ${activeView === 'explore' ? 'active' : ''}`}
              onClick={() => setActiveView('explore')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              Explore Options
            </button>
            <button 
              className={`tab-btn ${activeView === 'simulate' ? 'active' : ''}`}
              onClick={() => setActiveView('simulate')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              Create Simulation
            </button>
            <button 
              className={`tab-btn ${activeView === 'history' ? 'active' : ''}`}
              onClick={() => setActiveView('history')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              My Simulations
              {savedSimulations.length > 0 && (
                <span className="badge">{savedSimulations.length}</span>
              )}
            </button>
          </div>

          <div className="sim-disclaimer" role="note">
            <strong>This is a simulation, not advice.</strong> It uses average rates and stated assumptions.
            Real returns change and you can lose money. Check current rates and tax rules before you invest.
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

          {/* EXPLORE VIEW - Investment Types */}
          {activeView === 'explore' && (
            <div className="explore-section">
              <div className="section-intro">
                <h2>Choose Your Investment Path</h2>
                <p>Select an investment type to learn more and start your simulation</p>
              </div>

              {loadingTypes ? (
                <div className="loading-state">
                  <div className="loader"></div>
                  <p>Loading investment options...</p>
                </div>
              ) : (
                <div className="investment-types-grid">
                  {investmentTypes.map((type) => (
                    <div key={type.type} className="investment-type-card">
                      <div className="type-card-header">
                        <div className="type-icon" style={{ color: getRiskColor(type.risk_level) }}>
                          {getInvestmentTypeIcon(type.type)}
                        </div>
                        <span className={`risk-badge risk-${type.risk_level.replace('_', '-')}`}>
                          {type.risk_level.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>

                      <h3 className="type-name">{type.name}</h3>
                      <p className="type-description">{shortIntro(type)}</p>

                      <div className="type-stats">
                        <div className="stat-item">
                          <span className="stat-label">Yearly return</span>
                          <span className="stat-value return">{type.average_return}%</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label" title="How much the value usually moves up and down in a year">Ups &amp; downs</span>
                          <span className="stat-value">&plusmn;{type.volatility}%</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Best for</span>
                          <span className="stat-value">{type.recommended_duration}</span>
                        </div>
                      </div>

                      <p className="type-note">
                        {type.tax_rate > 0 ? (
                          <>After {Math.round(type.tax_rate * 100)}% tax: <strong>{type.after_tax_return}%</strong></>
                        ) : (
                          'Tax on gains is not included'
                        )}
                        {type.needs_review && <span className="estimate-chip">Estimate</span>}
                      </p>

                      <details className="type-more">
                        <summary>More details</summary>
                        <p className="type-more-text">{type.description}</p>
                        {type.min_expected_return != null && type.max_expected_return != null && (
                        <div className="type-range">
                          <span className="range-label">Range {type.range_label}:</span>
                          <div className="range-bar">
                            <span className="range-min">{type.min_expected_return}%</span>
                            <div className="range-fill" style={{ 
                              background: `linear-gradient(to right, ${getRiskColor(type.risk_level)}, ${getRiskColor(type.risk_level)}dd)`,
                              width: '100%'
                            }}></div>
                            <span className="range-max">{type.max_expected_return}%</span>
                          </div>
                        </div>
                      )}
                      <p className="type-note type-asof">Based on data as of {type.as_of}</p>
                        {type.notes && type.notes.length > 0 && (
                          <ul className="type-more-notes">
                            {type.notes.map((n) => <li key={n}>{n}</li>)}
                          </ul>
                        )}
                        <p className="type-note type-asof">Where this comes from: {type.source}</p>
                      </details>

                      <button 
                        className="select-type-btn"
                        onClick={() => handleSelectInvestmentType(type.type)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                        Start Simulation
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Statistics Overview */}
              {statistics && statistics.total_simulations > 0 && (
                <div className="statistics-overview">
                  <h3>Your Investment Journey</h3>
                  <div className="overview-stats">
                    <div className="overview-stat">
                      <div className="overview-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                      </div>
                      <div className="overview-content">
                        <span className="overview-label">Total Simulations</span>
                        <span className="overview-value">{statistics.total_simulations}</span>
                      </div>
                    </div>
                    <div className="overview-stat">
                      <div className="overview-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="1" x2="12" y2="23"></line>
                          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                        </svg>
                      </div>
                      <div className="overview-content">
                        <span className="overview-label">Total Invested</span>
                        <span className="overview-value">KES {statistics.total_invested}</span>
                      </div>
                    </div>
                    <div className="overview-stat">
                      <div className="overview-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                          <polyline points="17 6 23 6 23 12"></polyline>
                        </svg>
                      </div>
                      <div className="overview-content">
                        <span className="overview-label">Projected Growth</span>
                        <span className="overview-value growth">KES {statistics.total_projected_growth}</span>
                      </div>
                    </div>
                    <div className="overview-stat">
                      <div className="overview-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                      </div>
                      <div className="overview-content">
                        <span className="overview-label">Avg. Return</span>
                        <span className="overview-value">{statistics.average_return}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SIMULATE VIEW - Create New Simulation */}
          {activeView === 'simulate' && (
            <div className="simulate-section">
              <div className="simulation-layout">
                {/* Left: Form */}
                <div className="simulation-form-container">
                  <div className="simulation-card">
                    <h2 className="card-title">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      Investment Details
                    </h2>

                    {prefillNote && (
                      <p className="prefill-note" role="note">
                        {prefillNote.quick ? (
                          <>
                            We filled in what you told us. We have not seen your statement, so we cannot check your buffer:
                            keep about two weeks of spending in reserve before you put money anywhere.
                          </>
                        ) : (
                          <>
                            We filled in <strong>KES {whole(prefillNote.monthly)} a month</strong> from your statement. It is about a fifth of what
                            a typical month leaves you. Enter how much you would start with and for how long, then press Preview.
                          </>
                        )}
                        {' '}
                        <button type="button" className="link-btn" onClick={() => setPrefillNote(null)}>Dismiss</button>
                      </p>
                    )}

                    <form onSubmit={handlePreview} className="simulation-form">
                      <div className="form-group">
                        <label htmlFor="investment_type">Investment Type *</label>
                        <select
                          id="investment_type"
                          name="investment_type"
                          value={formData.investment_type}
                          onChange={handleChange}
                          required
                          disabled={loading}
                        >
                          <option value="">Select Investment Type</option>
                          {investmentTypes.map((type) => (
                            <option key={type.type} value={type.type}>
                              {type.name} - {type.average_return}% avg return
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor="amount_invested">Initial Investment (KES) *</label>
                        <div className="input-with-icon">
                          <span className="input-icon">KES</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            id="amount_invested"
                            name="amount_invested"
                            value={formData.amount_invested}
                            onChange={handleChange}
                            placeholder="10000"
                            required
                            disabled={loading}
                            onKeyDown={(e) => {
                              if (!/[0-9.]/.test(e.key)) {
                                e.preventDefault();
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="duration_value">Duration *</label>
                          <input
                            type="number"
                            id="duration_value"
                            name="duration_value"
                            value={formData.duration_value}
                            onChange={handleChange}
                            placeholder="12"
                            min="1"
                            max="600"
                            required
                            disabled={loading}
                          />
                        </div>

                        <div className="form-group">
                          <label htmlFor="duration_unit">Unit</label>
                          <select
                            id="duration_unit"
                            name="duration_unit"
                            value={formData.duration_unit}
                            onChange={handleChange}
                            required
                            disabled={loading}
                          >
                            <option value="months">Months</option>
                            <option value="years">Years</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label htmlFor="monthly_topup">Monthly Contribution (Optional)</label>
                        <div className="input-with-icon">
                          <span className="input-icon">KES</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            id="monthly_topup"
                            name="monthly_topup"
                            value={formData.monthly_topup}
                            onChange={handleChange}
                            placeholder="0"
                            disabled={loading}
                            onKeyDown={(e) => { 
                              if (!/[0-9.]/.test(e.key)) {
                                e.preventDefault();
                              }
                            }}
                          />
                        </div>
                        <small className="form-hint">Add regular monthly contributions to boost growth</small>
                      </div>

                      <div className="form-group">
                        <label htmlFor="target_amount">Target Goal (Optional)</label>
                        <div className="input-with-icon">
                          <span className="input-icon">KES</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            id="target_amount"
                            name="target_amount"
                            value={formData.target_amount}
                            onChange={handleChange}
                            placeholder="50000"
                            disabled={loading}
                            onKeyDown={(e) => { 
                              if (!/[0-9.]/.test(e.key)) {
                                e.preventDefault();
                              }
                            }}
                          />
                        </div>
                        <small className="form-hint">We'll calculate when you'll reach this goal</small>
                      </div>

                      <div className="form-group">
                        <label htmlFor="reinvestment_frequency">Compounding Frequency</label>
                        <select
                          id="reinvestment_frequency"
                          name="reinvestment_frequency"
                          value={formData.reinvestment_frequency}
                          onChange={handleChange}
                          required
                          disabled={loading}
                        >
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="annually">Annually</option>
                        </select>
                      </div>

                      <div className="form-actions">
                        <button type="submit" className="preview-btn" disabled={loading}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                          </svg>
                          {loading ? 'Calculating...' : 'Preview Simulation'}
                        </button>
                        
                        {previewResult && (
                          <button 
                            type="button" 
                            className="save-btn" 
                            onClick={handleSave}
                            disabled={loading}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                              <polyline points="17 21 17 13 7 13 7 21"></polyline>
                              <polyline points="7 3 7 8 15 8"></polyline>
                            </svg>
                            Save Simulation
                          </button>
                        )}

                        <button 
                          type="button" 
                          className="reset-btn"
                          onClick={handleReset}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="1 4 1 10 7 10"></polyline>
                            <polyline points="23 20 23 14 17 14"></polyline>
                            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                          </svg>
                          Reset
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Right: Results */}
                <div className="simulation-results-container">
                  {previewResult ? (
                    <>
                      {/* Summary Card */}
                      <div className="simulation-card">
                        <h2 className="card-title">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                          </svg>
                          Projection Summary
                        </h2>

                        <p className="plain-summary">
                          {(() => {
                            const pr = previewResult.projections;
                            const d = previewResult.investment_details;
                            const topup = Number(formData.monthly_topup || 0);
                            const gain = Number(pr.total_growth);
                            return (
                              <>
                                If you put in <strong>KES {whole(formData.amount_invested)}</strong> now
                                {topup > 0 && <> and <strong>KES {whole(topup)}</strong> every month</>}
                                {' '}for {plainPeriod(d.duration_months, d.duration_value, d.duration_unit)}, you will have paid in{' '}
                                <strong>KES {whole(pr.total_invested)}</strong>. Your money could grow to about{' '}
                                <strong>KES {whole(pr.projected_final_value)}</strong> after tax
                                {gain >= 0
                                  ? <>, which is <strong>KES {whole(gain)}</strong> more than you put in.</>
                                  : <>, which is <strong>KES {whole(Math.abs(gain))}</strong> less than you put in.</>}
                              </>
                            );
                          })()}
                        </p>

                        <div className="results-summary">
                          <div className="result-item highlight">
                            <span className="result-label">Investment Type</span>
                            <span className="result-value">
                              {investmentTypes.find(t => t.type === previewResult.investment_details.investment_type)?.name}
                            </span>
                          </div>

                          <div className="result-item">
                            <span className="result-label">Initial Investment</span>
                            <span className="result-value">KES {formatCurrency(formData.amount_invested)}</span>
                          </div>

                          <div className="result-item">
                            <span className="result-label">Monthly Contribution</span>
                            <span className="result-value">KES {formatCurrency(formData.monthly_topup || 0)}</span>
                          </div>

                          <div className="result-item">
                            <span className="result-label">Total Invested</span>
                            <span className="result-value">KES {formatCurrency(previewResult.projections.total_invested)}</span>
                          </div>

                          <div className="result-item highlight">
                            <span className="result-label">Final Value (after tax)</span>
                            <span className="result-value final">KES {formatCurrency(previewResult.projections.projected_final_value)}</span>
                          </div>

                          <div className="result-item highlight">
                            <span className="result-label">Total Growth (after tax)</span>
                            <span className="result-value earned">KES {formatCurrency(previewResult.projections.total_growth)}</span>
                          </div>

                          {previewResult.projections.tax_paid > 0 && (
                            <div className="result-item">
                              <span className="result-label">Tax taken out</span>
                              <span className="result-value">KES {formatCurrency(previewResult.projections.tax_paid)}</span>
                            </div>
                          )}

                          <div className="result-item highlight">
                            <span className="result-label">Total gain</span>
                            <span className="result-value roi">{previewResult.projections.percentage_return}%</span>
                          </div>

                          {previewResult.projections.annualized_return != null && (
                            <div className="result-item">
                              <span className="result-label">Average growth per year (after tax)</span>
                              <span className="result-value">{previewResult.projections.annualized_return}%</span>
                            </div>
                          )}
                        </div>

                        {previewResult.model_parameters && (
                          <div className="assumption-note">
                            <p>
                              We assumed this investment grows about <strong>{previewResult.model_parameters.average_annual_return}% a year</strong> before tax.
                              {previewResult.model_parameters.needs_review && <span className="estimate-chip">Estimate</span>}
                            </p>
                            <details className="type-more">
                              <summary>Where this number comes from</summary>
                              <p className="type-more-text">{previewResult.model_parameters.data_period}. {previewResult.model_parameters.source}</p>
                              {previewResult.model_parameters.needs_review && (
                                <p className="type-more-text">This figure is an estimate that is still being reviewed.</p>
                              )}
                              <p className="type-more-text">Real returns change from year to year. This is a simulation, not a promise.</p>
                            </details>
                          </div>
                        )}
                      </div>

                      {/* Risk Analysis Card */}
                      <div className="simulation-card">
                        <h2 className="card-title">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                          </svg>
                          Risk Analysis
                        </h2>

                        <div className="risk-overview">
                          <div className="risk-level-display">
                            <span className={`risk-badge-large risk-${previewResult.risk_analysis.risk_level.replace('_', '-')}`}>
                              {previewResult.risk_analysis.risk_level.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className="volatility-text">{riskPlain(previewResult.risk_analysis.risk_level)}</span>
                          </div>

                          <p className="risk-intro">
                            Nobody knows what will happen, so we tried 5,000 possible futures. Here is how your KES {whole(previewResult.projections.total_invested)} could end up:
                          </p>

                          <div className="scenario-range">
                            <div className="scenario-item worst">
                              <span className="scenario-label">Bad luck <small>(1 in 20 end up lower)</small></span>
                              <span className="scenario-value">KES {whole(previewResult.risk_analysis.worst_case_scenario)}</span>
                            </div>
                            <div className="scenario-item median">
                              <span className="scenario-label">Typical <small>(half end up higher, half lower)</small></span>
                              <span className="scenario-value">KES {whole(previewResult.risk_analysis.median_scenario)}</span>
                            </div>
                            <div className="scenario-item best">
                              <span className="scenario-label">Good luck <small>(1 in 20 end up higher)</small></span>
                              <span className="scenario-value">KES {whole(previewResult.risk_analysis.best_case_scenario)}</span>
                            </div>
                          </div>

                          {previewResult.risk_analysis.probability_of_loss != null && (
                            <div className="confidence-interval">
                              <p className="confidence-text">
                                {Number(previewResult.risk_analysis.probability_of_loss) < 1
                                  ? 'In almost none of the 5,000 futures did you end with less than you put in.'
                                  : <>In about <strong>{Math.round(previewResult.risk_analysis.probability_of_loss)} out of every 100</strong> futures, you end with less than you put in.</>}
                              </p>
                            </div>
                          )}

                          <details className="type-more">
                            <summary>How to read this</summary>
                            <p className="type-more-text">
                              In 19 out of 20 futures, you end between KES {whole(previewResult.risk_analysis.confidence_95_lower)} and
                              KES {whole(previewResult.risk_analysis.confidence_95_upper)}.
                              The "ups and downs" of this investment is about &plusmn;{previewResult.risk_analysis.volatility}% a year:
                              the higher it is, the wider the gap between bad luck and good luck.
                            </p>
                          </details>
                        </div>
                      </div>

                      {/* Goal Analysis Card */}
                      {previewResult.goal_analysis && (
                        <div className="simulation-card goal-card">
                          <h2 className="card-title">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"></circle>
                              <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            Goal Analysis
                          </h2>

                          {previewResult.goal_analysis.achievable ? (
                            <div className="goal-success">
                              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                              </svg>
                              <h3>
                                {previewResult.goal_analysis.reached_within_duration === false
                                  ? 'Reachable, but later than your period'
                                  : 'Goal Achievable!'}
                              </h3>
                              <p className="goal-message">{previewResult.goal_analysis.message}</p>
                              <div className="goal-timeline">
                                <div className="goal-time-item">
                                  <span className="time-value">{previewResult.goal_analysis.years}</span>
                                  <span className="time-label">Years</span>
                                </div>
                                <div className="goal-time-item">
                                  <span className="time-value">{previewResult.goal_analysis.remaining_months}</span>
                                  <span className="time-label">Months</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="goal-warning">
                              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                              </svg>
                              <p className="goal-message">{previewResult.goal_analysis.message}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Growth Chart */}
                      <div className="simulation-card">
                        <h2 className="card-title">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                            <polyline points="17 6 23 6 23 12"></polyline>
                          </svg>
                          Growth Projection
                        </h2>
                        
                        <div className="chart-container">
                          <ResponsiveContainer width="100%" height={350}>
                            <LineChart 
                              data={generateChartData(previewResult.timeline)} 
                              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis 
                                dataKey="month" 
                                tick={{ fill: '#666', fontSize: 11 }}
                                interval="preserveStartEnd"
                              />
                              <YAxis 
                                tick={{ fill: '#666', fontSize: 11 }}
                                tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                              />
                              <Tooltip 
                                formatter={(value, name) => {
                                  const labels = {
                                    value: 'Portfolio Value',
                                    contributions: 'Total Contributions',
                                    growth: 'Growth'
                                  };
                                  return [`KES ${formatCurrency(value)}`, labels[name]];
                                }}
                                contentStyle={{
                                  backgroundColor: 'white',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  padding: '12px'
                                }}
                              />
                              <Legend />
                              <Line 
                                type="monotone" 
                                dataKey="value" 
                                stroke="#4c6ef5" 
                                strokeWidth={3}
                                dot={false}
                                name="Portfolio Value"
                              />
                              <Line 
                                type="monotone" 
                                dataKey="contributions" 
                                stroke="#9ca3af" 
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={false}
                                name="Contributions"
                              />
                              <Line 
                                type="monotone" 
                                dataKey="growth" 
                                stroke="#10b981" 
                                strokeWidth={2}
                                dot={false}
                                name="Growth"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="simulation-card empty-state-card">
                      <div className="empty-state">
                        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="11" cy="11" r="8"></circle>
                          <path d="m21 21-4.35-4.35"></path>
                        </svg>
                        <h3>No Preview Yet</h3>
                        <p>Fill in the investment details and click "Preview Simulation" to see your projected growth and risk analysis.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* HISTORY VIEW - Saved Simulations */}
          {activeView === 'history' && (
            <div className="history-section">
              {selectedSimulation ? (
                // Detailed View
                <div className="simulation-detail-view">
                  <div className="detail-header">
                    <button className="back-btn" onClick={() => setSelectedSimulation(null)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                      </svg>
                      Back to List
                    </button>
                    <h2>Simulation Details</h2>
                  </div>

                  <div className="detail-grid">
                    {/* Summary Card */}
                    <div className="simulation-card">
                      <h3 className="card-title">Investment Summary</h3>
                      <div className="detail-info-grid">
                        <div className="info-item">
                          <span className="info-label">Type</span>
                          <span className="info-value">{selectedSimulation.investment_type_name}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Created</span>
                          <span className="info-value">
                            {new Date(selectedSimulation.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Duration</span>
                          <span className="info-value">{selectedSimulation.formatted_duration}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Risk Level</span>
                          <span className={`risk-badge risk-${selectedSimulation.risk_level.replace('_', '-')}`}>
                            {selectedSimulation.risk_level.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="results-summary">
                        <div className="result-item">
                          <span className="result-label">Initial Investment</span>
                          <span className="result-value">KES {formatCurrency(selectedSimulation.amount_invested)}</span>
                        </div>
                        <div className="result-item">
                          <span className="result-label">Monthly Contribution</span>
                          <span className="result-value">KES {formatCurrency(selectedSimulation.monthly_topup)}</span>
                        </div>
                        <div className="result-item">
                          <span className="result-label">Total Invested</span>
                          <span className="result-value">KES {formatCurrency(selectedSimulation.total_invested)}</span>
                        </div>
                        <div className="result-item highlight">
                          <span className="result-label">Final Value{taxLabel(selectedSimulation)}</span>
                          <span className="result-value final">KES {formatCurrency(selectedSimulation.projected_final_value)}</span>
                        </div>
                        <div className="result-item highlight">
                          <span className="result-label">Total Growth</span>
                          <span className="result-value earned">KES {formatCurrency(selectedSimulation.total_growth)}</span>
                        </div>
                        <div className="result-item highlight">
                          <span className="result-label">ROI</span>
                          <span className="result-value roi">{selectedSimulation.roi_percentage}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Growth Chart */}
                    <div className="simulation-card">
                      <h3 className="card-title">Growth Timeline</h3>
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart 
                            data={generateChartData(selectedSimulation.timeline)} 
                            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis 
                              dataKey="month" 
                              tick={{ fill: '#666', fontSize: 11 }}
                              interval="preserveStartEnd"
                            />
                            <YAxis 
                              tick={{ fill: '#666', fontSize: 11 }}
                              tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                            />
                            <Tooltip 
                              formatter={(value) => [`KES ${formatCurrency(value)}`, 'Portfolio Value']}
                              contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px'
                              }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="value" 
                              stroke="#4c6ef5" 
                              strokeWidth={3}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Risk Scenarios */}
                    <div className="simulation-card">
                      <h3 className="card-title">Risk Scenarios</h3>
                      <div className="scenario-chart">
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart 
                            data={[
                              { name: 'Worst Case', value: selectedSimulation.worst_case_scenario },
                              { name: 'Lower 95%', value: selectedSimulation.confidence_95_lower },
                              { name: 'Projected', value: selectedSimulation.projected_final_value },
                              { name: 'Upper 95%', value: selectedSimulation.confidence_95_upper },
                              { name: 'Best Case', value: selectedSimulation.best_case_scenario }
                            ]}
                            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 11 }} />
                            <YAxis 
                              tick={{ fill: '#666', fontSize: 11 }}
                              tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                            />
                            <Tooltip 
                              formatter={(value) => [`KES ${formatCurrency(value)}`, 'Value']}
                              contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px'
                              }}
                            />
                            <Bar dataKey="value" fill="#4c6ef5" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Goal Analysis */}
                    {selectedSimulation.goal_analysis && selectedSimulation.goal_analysis.achievable && (
                      <div className="simulation-card goal-card">
                        <h3 className="card-title">Goal Analysis</h3>
                        <div className="goal-success">
                          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                          </svg>
                          <p className="goal-message">{selectedSimulation.goal_analysis.message}</p>
                          <div className="goal-timeline">
                            <div className="goal-time-item">
                              <span className="time-value">{selectedSimulation.goal_analysis.years}</span>
                              <span className="time-label">Years</span>
                            </div>
                            <div className="goal-time-item">
                              <span className="time-value">{selectedSimulation.goal_analysis.remaining_months}</span>
                              <span className="time-label">Months</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // List View
                <>
                  <div className="section-intro">
                    <h2>Your Investment Simulations</h2>
                    <p>Review and analyze your saved investment scenarios</p>
                  </div>

                  {simulationsLoading ? (
                    <div className="loading-state">
                      <div className="loader"></div>
                      <p>Loading your simulations...</p>
                    </div>
                  ) : savedSimulations.length === 0 ? (
                    <div className="empty-state-large">
                      <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                      </svg>
                      <h3>No Simulations Yet</h3>
                      <p>Start by exploring investment options and creating your first simulation</p>
                      <button className="primary-btn" onClick={() => setActiveView('explore')}>
                        Explore Investment Options
                      </button>
                    </div>
                  ) : (
                    <div className="simulations-grid-list">
                      {savedSimulations.map((simulation) => (
                        <div key={simulation.simulation_id} className="simulation-item">
                          <div className="simulation-item-header">
                            <div className="header-left">
                              <div className="type-icon-small" style={{ color: getRiskColor(simulation.risk_level) }}>
                                {getInvestmentTypeIcon(simulation.investment_type)}
                              </div>
                              <div>
                                <h3 className="simulation-title">{simulation.investment_type_name}</h3>
                                <span className="simulation-date">
                                  {new Date(simulation.created_at).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </span>
                              </div>
                            </div>
                            <span className={`risk-badge risk-${simulation.risk_level.replace('_', '-')}`}>
                              {simulation.risk_level.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          
                          <div className="simulation-details">
                            <div className="detail-row">
                              <span className="detail-label">Initial Investment</span>
                              <span className="detail-value">KES {formatCurrency(simulation.amount_invested)}</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label">Duration</span>
                              <span className="detail-value">{simulation.formatted_duration}</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label">Monthly Contribution</span>
                              <span className="detail-value">KES {formatCurrency(simulation.monthly_topup)}</span>
                            </div>
                            <div className="detail-row highlight">
                              <span className="detail-label">Final Value{taxLabel(simulation)}</span>
                              <span className="detail-value final">KES {formatCurrency(simulation.projected_final_value)}</span>
                            </div>
                            <div className="detail-row highlight">
                              <span className="detail-label">Growth</span>
                              <span className="detail-value earned">KES {formatCurrency(simulation.total_growth)}</span>
                            </div>
                            <div className="detail-row highlight">
                              <span className="detail-label">ROI</span>
                              <span className="detail-value roi">{simulation.roi_percentage}%</span>
                            </div>
                          </div>

                          <div className="simulation-actions">
                            <button 
                              className="action-btn view-btn"
                              onClick={() => handleViewSimulation(simulation)}
                              title="View details"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                              </svg>
                              View Details
                            </button>
                            <button 
                              className="action-btn delete-btn"
                              onClick={() => handleDelete(simulation.simulation_id)}
                              title="Delete simulation"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>

      <DashboardFooter />
    </div>
  );
};

export default Simulations;