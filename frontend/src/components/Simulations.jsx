import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardNavbar from '../components/DashboardNavbar';
import DashboardFooter from '../components/DashboardFooter';
import authService from '../services/authService';
import api from '../api/axios';
import './Simulations.css';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import InvestmentImage from '../assets/Investment.jpeg';

const Simulations = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  // Form state - matching API requirements
  const [formData, setFormData] = useState({
    principal: '',
    interest_rate: '',
    time_period: '', // In months as per API (max 600)
    calculation_type: 'simple'
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  // Simulation results
  const [previewResult, setPreviewResult] = useState(null);
  const [savedSimulations, setSavedSimulations] = useState([]);
  const [simulationsLoading, setSimulationsLoading] = useState(true);
  const [showSimulationsList, setShowSimulationsList] = useState(true);
  
  // Statistics
  const [statistics, setStatistics] = useState(null);
  const [editingSimulation, setEditingSimulation] = useState(null);

  useEffect(() => {
    fetchSimulations();
    fetchStatistics();
  }, []);

  const fetchSimulations = async () => {
    setSimulationsLoading(true);
    try {
      const response = await api.get('/simulations', {
        params: { per_page: 20 }
      });
      
      if (response.data && response.data.data) {
        const simData = response.data.data;
        // Handle both paginated and non-paginated responses
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
      const response = await api.get('/simulations/my-statistics');
      
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

  const handlePreview = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();

    if (parseFloat(formData.principal) <= 0) {
      setError('Initial amount must be greater than 0');
      setLoading(false);
      return;
    }

    if (parseFloat(formData.interest_rate) < 0 || parseFloat(formData.interest_rate) > 100) {
      setError('Interest rate must be between 0 and 100');
      setLoading(false);
      return;
    }

    if (parseInt(formData.time_period) <= 0 || parseInt(formData.time_period) > 600) {
      setError('Duration must be between 1 and 600 months (50 years)');
      setLoading(false);
      return;
    }

    const submissionData = {
      principal: parseFloat(formData.principal),
      interest_rate: parseFloat(formData.interest_rate),
      time_period: parseInt(formData.time_period),
      calculation_type: formData.calculation_type
    };

    try {
      const response = await api.post('/simulations/preview', submissionData);
      
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
      principal: parseFloat(formData.principal),
      interest_rate: parseFloat(formData.interest_rate),
      time_period: parseInt(formData.time_period),
      calculation_type: formData.calculation_type
    };

    try {
      if (editingSimulation) {
        await api.put(`/simulations/${editingSimulation.simulation_id}`, submissionData);
        setMessage('Simulation updated successfully!');
      } else {
        await api.post('/simulations', submissionData);
        setMessage('Simulation saved successfully!');
      }

      setFormData({
        principal: '',
        interest_rate: '',
        time_period: '',
        calculation_type: 'simple'
      });
      setPreviewResult(null);
      setEditingSimulation(null);
      
      setTimeout(() => {
        setMessage('');
        fetchSimulations();
        fetchStatistics();
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

  const handleEdit = (simulation) => {
    setEditingSimulation(simulation);
    setFormData({
      principal: simulation.principal,
      interest_rate: simulation.interest_rate,
      time_period: simulation.time_period,
      calculation_type: simulation.calculation_type || 'simple'
    });
    
    // Set preview result from saved simulation data
    setPreviewResult({
      principal: simulation.principal,
      interest_rate: simulation.interest_rate,
      time_period: simulation.time_period,
      time_period_years: simulation.time_period_years || (simulation.time_period / 12).toFixed(2),
      result: simulation.result,
      interest_earned: simulation.interest_earned,
      roi_percentage: simulation.roi_percentage,
      calculation_type: simulation.calculation_type || 'simple'
    });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (simulationId) => {
    if (!window.confirm('Are you sure you want to delete this simulation?')) {
      return;
    }

    try {
      await api.delete(`/simulations/${simulationId}`);
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

  const handleCancelEdit = () => {
    setEditingSimulation(null);
    setFormData({
      principal: '',
      interest_rate: '',
      time_period: '',
      calculation_type: 'simple'
    });
    setPreviewResult(null);
    clearMessages();
  };

  // Generate chart data for projected growth
  const generateChartData = () => {
    if (!previewResult) return [];
    
    const data = [];
    const principal = parseFloat(String(previewResult.principal).replace(/,/g, ''));
    const rate = parseFloat(previewResult.interest_rate) / 100;
    const months = parseInt(previewResult.time_period);
    const years = Math.ceil(months / 12);
    const isCompound = previewResult.calculation_type === 'compound';
    
    for (let year = 0; year <= years; year++) {
      let value;
      if (isCompound) {
        value = principal * Math.pow(1 + rate, year);
      } else {
        value = principal + (principal * rate * year);
      }
      
      data.push({
        year: `Year ${year}`,
        value: parseFloat(value.toFixed(2))
      });
    }
    
    return data;
  };

  const formatCurrency = (amount) => {
    // Remove commas if present and convert to number
    const numAmount = typeof amount === 'string' 
      ? parseFloat(amount.replace(/,/g, ''))
      : parseFloat(amount);
    
    return numAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const chartData = generateChartData();

  return (
    <div className="simulations-page">
      <DashboardNavbar activePage="Simulation" />
      
      <main className="simulations-main">
        <div className="simulations-container">
          <div className="page-header">
            <div className="page-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <h1>Investment Simulation</h1>
            <p>Calculate and visualize your investment growth over time</p>
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

          <div className="simulations-grid">
            {/* Left Column - Form & Image */}
            <div className="simulations-left">
              <div className="simulation-card">
                <div className="investment-image-container">
                  <img src={InvestmentImage} alt="Investment" className="investment-image" />
                </div>
                
                <h2 className="card-title">
                  {editingSimulation ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      Edit Investment Simulation
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <polyline points="5 12 12 19 19 12"></polyline>
                      </svg>
                      Investment Simulation
                    </>
                  )}
                </h2>

                <form onSubmit={handlePreview} className="simulation-form">
                  <div className="form-group">
                    <label htmlFor="principal">Initial Amount (KES)</label>
                    <div className="input-with-icon">
                      <span className="input-icon">KES</span>
                      <input
                        type="number"
                        id="principal"
                        name="principal"
                        value={formData.principal}
                        onChange={handleChange}
                        placeholder="10000"
                        step="0.01"
                        min="0.01"
                        max="999999999.99"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="calculation_type">Type of Investment</label>
                    <select
                      id="calculation_type"
                      name="calculation_type"
                      value={formData.calculation_type}
                      onChange={handleChange}
                      required
                      disabled={loading}
                    >
                      <option value="simple">Simple Interest (Stocks)</option>
                      <option value="compound">Compound Interest (Bonds)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="interest_rate">Annual Interest Rate (%)</label>
                    <div className="input-with-icon">
                      <span className="input-icon">%</span>
                      <input
                        type="number"
                        id="interest_rate"
                        name="interest_rate"
                        value={formData.interest_rate}
                        onChange={handleChange}
                        placeholder="7.5"
                        step="0.01"
                        min="0"
                        max="100"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="time_period">Duration (Months)</label>
                    <input
                      type="number"
                      id="time_period"
                      name="time_period"
                      value={formData.time_period}
                      onChange={handleChange}
                      placeholder="120 (10 years)"
                      min="1"
                      max="600"
                      required
                      disabled={loading}
                    />
                    <small className="form-hint">Enter duration in months (1-600 months / 0-50 years)</small>
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
                        {editingSimulation ? 'Update Simulation' : 'Save Simulation'}
                      </button>
                    )}
                    
                    {editingSimulation && (
                      <button 
                        type="button" 
                        className="cancel-btn"
                        onClick={handleCancelEdit}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* Right Column - Results & Chart */}
            <div className="simulations-right">
              {previewResult ? (
                <div className="simulation-card">
                  <h2 className="card-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                    Projected Growth
                  </h2>
                  
                  <div className="results-summary">
                    <div className="result-item">
                      <span className="result-label">Initial Investment</span>
                      <span className="result-value">KES {formatCurrency(previewResult.principal)}</span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">Final Value</span>
                      <span className="result-value final">KES {formatCurrency(previewResult.result)}</span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">Interest Earned</span>
                      <span className="result-value earned">KES {formatCurrency(previewResult.interest_earned)}</span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">ROI</span>
                      <span className="result-value roi">{parseFloat(previewResult.roi_percentage).toFixed(2)}%</span>
                    </div>
                  </div>

                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="year" 
                          tick={{ fill: '#666', fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis 
                          tick={{ fill: '#666', fontSize: 12 }}
                          tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                        />
                        <Tooltip 
                          formatter={(value) => [`KES ${formatCurrency(value)}`, 'Projected Value']}
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '10px'
                          }}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#4c6ef5" 
                          strokeWidth={3}
                          dot={{ fill: '#4c6ef5', r: 4 }}
                          activeDot={{ r: 6 }}
                          name="Investment Value"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="simulation-card empty-state-card">
                  <div className="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <line x1="12" y1="1" x2="12" y2="23"></line>
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                    <h3>No Simulation Yet</h3>
                    <p>Fill in the investment details and click "Preview Simulation" to see your projected growth!</p>
                  </div>
                </div>
              )}

              {/* Smart Investment Tips */}
              <div className="simulation-card tips-card">
                <h2 className="card-title">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  Smart Investment Tips
                </h2>
                <ul className="tips-list">
                  <li>
                    <strong>Start Early:</strong> Compounding interest works best over longer periods. Even small, consistent contributions can grow significantly.
                  </li>
                  <li>
                    <strong>Diversify Your Portfolio:</strong> Don't put all your eggs in one basket. Spread your investments across different asset classes (stocks, bonds, real estate).
                  </li>
                  <li>
                    <strong>Understand Risk Tolerance:</strong> Assess how much risk you're comfortable with. Higher returns often come with higher risk, so choose investments that align with your goals.
                  </li>
                  <li>
                    <strong>Regularly Review:</strong> Periodically check your investments and adjust your strategy as your financial goals and market conditions change.
                  </li>
                  <li>
                    <strong>Avoid Emotional Decisions:</strong> Stick to your long-term plan and avoid making impulsive decisions based on short-term market fluctuations.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Saved Simulations Section */}
          <div className="saved-simulations-section">
            <div className="section-header">
              <h2 className="section-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                Your Saved Simulations
              </h2>
              <button 
                className="toggle-btn"
                onClick={() => setShowSimulationsList(!showSimulationsList)}
              >
                {showSimulationsList ? '▼ Hide' : '▶ Show'}
              </button>
            </div>

            {showSimulationsList && (
              <div className="simulations-list">
                {simulationsLoading ? (
                  <div className="loading-state">Loading simulations...</div>
                ) : savedSimulations.length === 0 ? (
                  <div className="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M9 11l3 3L22 4"></path>
                      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
                    </svg>
                    <p>No saved simulations yet. Create your first simulation above!</p>
                  </div>
                ) : (
                  <div className="simulations-grid-list">
                    {savedSimulations.map((simulation) => (
                      <div key={simulation.simulation_id} className="simulation-item">
                        <div className="simulation-item-header">
                          <h3 className="simulation-title">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                            </svg>
                            {simulation.calculation_type === 'simple' ? 'Stocks' : 'Bonds'} Investment
                          </h3>
                          <span className="simulation-date">
                            {new Date(simulation.created_at).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </span>
                        </div>
                        
                        <div className="simulation-details">
                          <div className="detail-row">
                            <span className="detail-label">Initial:</span>
                            <span className="detail-value">KES {formatCurrency(simulation.principal)}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Rate:</span>
                            <span className="detail-value">{simulation.interest_rate}%</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Duration:</span>
                            <span className="detail-value">{simulation.time_period} months</span>
                          </div>
                          <div className="detail-row highlight">
                            <span className="detail-label">Final Value:</span>
                            <span className="detail-value final">KES {formatCurrency(simulation.result)}</span>
                          </div>
                          <div className="detail-row highlight">
                            <span className="detail-label">Interest Earned:</span>
                            <span className="detail-value earned">KES {formatCurrency(simulation.interest_earned)}</span>
                          </div>
                          <div className="detail-row highlight">
                            <span className="detail-label">ROI:</span>
                            <span className="detail-value roi">{parseFloat(simulation.roi_percentage).toFixed(2)}%</span>
                          </div>
                        </div>

                        <div className="simulation-actions">
                          <button 
                            className="action-btn edit-btn"
                            onClick={() => handleEdit(simulation)}
                            title="Edit simulation"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Edit
                          </button>
                          <button 
                            className="action-btn delete-btn"
                            onClick={() => handleDelete(simulation.simulation_id)}
                            title="Delete simulation"
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
            )}
          </div>

          {/* Statistics Section */}
          {statistics && statistics.total_simulations > 0 && (
            <div className="statistics-section">
              <h2 className="section-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                Your Investment Statistics
              </h2>
              <div className="statistics-grid">
                <div className="stat-card">
                  <div className="stat-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                  </div>
                  <div className="stat-content">
                    <p className="stat-label">Total Simulations</p>
                    <p className="stat-value">{statistics.total_simulations || 0}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="1" x2="12" y2="23"></line>
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                  </div>
                  <div className="stat-content">
                    <p className="stat-label">Average Principal</p>
                    <p className="stat-value">KES {statistics.average_principal ? formatCurrency(statistics.average_principal) : '0.00'}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  <div className="stat-content">
                    <p className="stat-label">Average Result</p>
                    <p className="stat-value">KES {statistics.average_result ? formatCurrency(statistics.average_result) : '0.00'}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                  </div>
                  <div className="stat-content">
                    <p className="stat-label">Highest Result</p>
                    <p className="stat-value">KES {statistics.highest_result ? formatCurrency(statistics.highest_result) : '0.00'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <DashboardFooter />
    </div>
  );
};

export default Simulations;