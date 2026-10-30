import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardNavbar from '../components/DashboardNavbar';
import DashboardFooter from '../components/DashboardFooter';
import api from '../api/axios';
import './Recommendations.css';

const MAX_PDF_MB = 10; // matches the limit on the Laravel side

// Wakes the free statement service while the student fills in the form.
const WAKE_URL = import.meta.env.VITE_STATEMENT_HEALTH_URL;
const wakeStatementService = () => {
  if (!WAKE_URL) return;
  fetch(WAKE_URL, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
};

// Where the Simulation page lives in your router. Change this if your route is different.
const SIMULATOR_PATH = '/simulation';

const STAGE_INFO = {
  not_enough_data: { label: 'We need more data', blurb: 'Add more of your statement so we can say something useful.' },
  short_of_cash: { label: 'Cash is tight', blurb: 'Your wallet often runs low before the next deposit.' },
  stable: { label: 'Stable', blurb: 'Your spending is steady. The next step is a cushion.' },
  building_habit: { label: 'Building a saving habit', blurb: 'You already save. Let it grow.' },
  ready_to_explore: { label: 'Ready to explore', blurb: 'You have a buffer and a saving habit.' },
};

// Short, practical tips for Kenyan students. One is shown per day, so the same tip stays up all day.
// Keep them general and factual: no product recommendations and no promised returns.
const TIPS = [
  'Move part of your money out of your M-Pesa wallet the day it arrives. Money you cannot see is harder to spend.',
  'Fuliza is an overdraft, not extra money. It is taken back from your next deposit, together with its fees.',
  'Many small M-Pesa sends each carry a fee. One planned send is often cheaper than several small ones.',
  'A buffer of a few weeks of spending protects you when money is late. Build it before you think about investing.',
  'Decide your saving amount when money arrives, not at the end of the month. What is left over is usually nothing.',
  'Upload a fresh statement every month or two so your recommendations reflect how you spend now.',
  'Before using any saving product, read its current rates, limits and fees. They change over time.',
];
const tipForToday = (now = new Date()) => {
  const dayNumber = Math.floor(now.getTime() / 86400000);
  return TIPS[dayNumber % TIPS.length];
};

const CONFIDENCE_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

// Turns an axios error into one sentence a student can act on.
const messageFrom = (err, fallback) => {
  const data = err.response?.data;
  if (data?.errors) {
    const first = Object.values(data.errors).flat()[0];
    if (first) return first;
  }
  if (data?.message) return data.message;
  if (err.code === 'ECONNABORTED') return 'This is taking longer than expected. Please try again.';
  if (!err.response) return 'We could not reach the server. Check your connection and try again.';
  return fallback;
};

const formatDay = (iso) => {
  if (!iso) return '';
  const d = new Date(iso); // statement times are Nairobi wall-clock times without a zone; only the date is shown
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

// last_uploaded_at comes from Laravel as a full ISO timestamp with its offset ("2026-10-13T16:52:09+03:00"),
// so it means the same moment whatever timezone the server is set to. Always show it in Nairobi time.
const formatUploaded = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi',
      });
};

const formatKes = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

// updated_at for the savings amount is a full ISO timestamp with its offset; show the day in Nairobi time.
const formatSavedDay = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' });
};

const Recommendations = () => {
  const navigate = useNavigate();
  // Page data
  const [data, setData] = useState(null);
  const [needsStatement, setNeedsStatement] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [statistics, setStatistics] = useState(null);

  // Messages
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Upload form
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [file, setFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [slowUpload, setSlowUpload] = useState(false);

  // Savings held outside the wallet (M-Shwari, Ziidi, SACCO, bank)
  const [savingsInput, setSavingsInput] = useState('');
  const [editingSavings, setEditingSavings] = useState(false);
  const [savingsBusy, setSavingsBusy] = useState(false);
  const [savingsError, setSavingsError] = useState('');

  // Quick mode: students with no statement answer three questions and go straight to the simulator
  const [quick, setQuick] = useState({ monthly: '', initial: '', duration: '12', unit: 'months' });
  const [quickError, setQuickError] = useState('');

  // Modal states
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ status: 'viewed', feedback: '' });

  useEffect(() => {
    wakeStatementService();
    loadRecommendations();
    fetchStatistics();
  }, []);

  const clearMessages = () => {
    setMessage('');
    setError('');
  };

  const loadRecommendations = async () => {
    setPageLoading(true);
    try {
      const response = await api.get('/statements/recommendations');
      setData(response.data.data);
      setNeedsStatement(false);
      setError('');
    } catch (err) {
      if (err.response?.status === 404 && err.response?.data?.code === 'NO_STATEMENT') {
        setData(null);
        setNeedsStatement(true);
      } else {
        setError(messageFrom(err, 'We could not load your recommendations. Please try again.'));
      }
    } finally {
      setPageLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await api.get('/recommendations/statistics');
      if (response.data && response.data.data) {
        setStatistics(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
  };

  const validateUpload = () => {
    if (!file) return 'Choose your statement PDF.';
    if (!/\.pdf$/i.test(file.name)) return 'The statement must be a PDF file.';
    if (file.size > MAX_PDF_MB * 1024 * 1024) return `That file is larger than ${MAX_PDF_MB} MB.`;
    if (!password) return 'Enter the statement password.';
    if (!consent) return 'Please tick the box to confirm you agree before uploading.';
    return '';
  };

  // Refresh the cards without blanking the page, so the confirmation message stays on screen.
  const reloadCardsQuietly = async () => {
    try {
      const response = await api.get('/statements/recommendations');
      setData(response.data.data);
    } catch {
      /* the amount is saved; the page picks it up the next time it loads */
    }
  };

  const saveSavings = async (value) => {
    setSavingsBusy(true);
    setSavingsError('');
    clearMessages();
    try {
      const response = await api.put('/statements/savings-balance', { savings_balance: value });
      if (response.data.cards_refreshed) {
        await reloadCardsQuietly();
        setMessage(value === null ? 'Savings amount removed. Your advice no longer counts it.' : 'Savings amount saved. Your advice now counts it.');
      } else {
        setData((prev) => (prev ? { ...prev, savings_balance: response.data.data } : prev));
        setMessage(value === null
          ? 'Savings amount removed.'
          : 'Savings amount saved. We could not update your advice just now, but it will use this amount the next time you open the page.');
      }
      setEditingSavings(false);
      setSavingsInput('');
    } catch (err) {
      setSavingsError(messageFrom(err, 'We could not save that. Please try again.'));
    } finally {
      setSavingsBusy(false);
    }
  };

  const handleSaveSavings = (e) => {
    e.preventDefault();
    const text = String(savingsInput).trim();
    const n = Number(text);
    if (text === '' || !Number.isFinite(n)) {
      setSavingsError('Enter your savings as a number, for example 2500.');
      return;
    }
    if (n < 0) {
      setSavingsError('Your savings cannot be a negative amount.');
      return;
    }
    saveSavings(n);
  };

  const handleQuickStart = (e) => {
    e.preventDefault();
    const num = (v) => (String(v).trim() === '' ? 0 : Number(v));
    const monthly = num(quick.monthly);
    const initial = num(quick.initial);
    const duration = Number(quick.duration);
    if (![monthly, initial].every((n) => Number.isFinite(n) && n >= 0)) {
      setQuickError('Enter amounts as numbers, for example 500. They cannot be negative.');
      return;
    }
    if (initial === 0) {
      setQuickError('Enter how much you have to start with. The simulator needs a starting amount, even a small one.');
      return;
    }
    if (!Number.isInteger(duration) || duration < 1) {
      setQuickError('Enter how long as a whole number, for example 12.');
      return;
    }
    if (quick.unit === 'years' ? duration > 50 : duration > 600) {
      setQuickError('That is longer than we can simulate. Try 50 years or less.');
      return;
    }
    setQuickError('');
    navigate(SIMULATOR_PATH, {
      state: {
        prefill: {
          source: 'quick',
          investment_type: 'mmf',
          monthly_amount: monthly || null,
          initial_amount: initial || null,
          duration_value: duration,
          duration_unit: quick.unit,
        },
      },
    });
  };

  const openSimulator = (hint) => {
    navigate(SIMULATOR_PATH, {
      state: { prefill: { investment_type: hint.investment_type, monthly_amount: hint.monthly_amount ?? null } },
    });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    clearMessages();
    setUploadError('');

    const problem = validateUpload();
    if (problem) {
      setUploadError(problem);
      return;
    }

    const form = new FormData();
    form.append('file', file);
    form.append('password', password);
    form.append('consent', '1');

    setUploading(true);
    setSlowUpload(false);
    wakeStatementService();
    const slowTimer = setTimeout(() => setSlowUpload(true), 8000);
    try {
      const response = await api.post('/statements', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000, // reading a year of transactions can take 10+ seconds
      });

      const s = response.data.statement;
      setMessage(
        s.rows_new === 0
          ? 'That statement was already added, so nothing changed.'
          : `Statement added: ${s.rows_new} new transactions.`
      );
      setPassword('');
      setConsent(false);
      setFile(null);
      setFileInputKey((k) => k + 1);
      setShowUploadForm(false);
      await loadRecommendations();
      fetchStatistics();
    } catch (err) {
      setUploadError(messageFrom(err, 'We could not process that statement. Please try again.'));
    } finally {
      clearTimeout(slowTimer);
      setUploading(false);
      setSlowUpload(false);
    }
  };

  const handleDeleteData = async () => {
    const ok = window.confirm(
      'Delete all the statement data we hold for you? The recommendations made from it will be removed too. ' +
        'You can upload a statement again at any time.'
    );
    if (!ok) return;

    clearMessages();
    setDeleting(true);
    try {
      await api.delete('/statements/data');
      setData(null);
      setNeedsStatement(true);
      setShowUploadForm(false);
      setMessage('Your statement data has been deleted.');
      fetchStatistics();
    } catch (err) {
      setError(messageFrom(err, 'We could not delete your data. Please try again.'));
    } finally {
      setDeleting(false);
    }
  };

  const handleViewDetails = (recommendation) => {
    setSelectedRecommendation(recommendation);
    setShowDetailModal(true);
  };

  const handleOpenFeedback = (recommendation) => {
    setSelectedRecommendation(recommendation);
    setFeedbackForm({
      status: recommendation.status === 'pending' ? 'viewed' : recommendation.status || 'viewed',
      feedback: recommendation.feedback || '',
    });
    setShowFeedbackModal(true);
  };

  const handleFeedbackChange = (e) => {
    const { name, value } = e.target;
    setFeedbackForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    setSaving(true);
    clearMessages();

    try {
      await api.patch(`/recommendations/${selectedRecommendation.recommendation_id}/status`, feedbackForm);

      // Update the card on screen; no need to recompute everything.
      setData((prev) => ({
        ...prev,
        recommendations: prev.recommendations.map((r) =>
          r.recommendation_id === selectedRecommendation.recommendation_id
            ? { ...r, status: feedbackForm.status, feedback: feedbackForm.feedback }
            : r
        ),
      }));
      setMessage('Feedback submitted successfully!');
      setShowFeedbackModal(false);
      fetchStatistics();
    } catch (err) {
      setError(messageFrom(err, 'Failed to submit feedback.'));
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
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
      Budget: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
          <path d="M12 18V6"></path>
        </svg>
      ),
      Goal: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="6"></circle>
          <circle cx="12" cy="12" r="2"></circle>
        </svg>
      ),
      Saving: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23"></line>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
      ),
      Spending: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
          <line x1="1" y1="10" x2="23" y2="10"></line>
        </svg>
      ),
      Income: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      ),
      General: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      ),
    };

    return iconMap[category] || iconMap.General;
  };

  // The upload form is used both for the first upload and for adding a newer statement.
  const renderUploadForm = () => (
    <form className="upload-form" onSubmit={handleUpload} noValidate>
      <div className="form-group">
        <label htmlFor="statement-file">M-Pesa statement (PDF)</label>
        <input
          key={fileInputKey}
          id="statement-file"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          disabled={uploading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="statement-password">Statement password</label>
        <div className="password-row">
          <input
            id="statement-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={uploading}
          />
          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {uploadError && <p className="upload-error" role="alert">{uploadError}</p>}

      <details className="privacy-details">
        <summary>What we collect and how we use it</summary>

        <h4>What we keep from your statement</h4>
        <ul>
          <li>For each transaction: the date and time, the amount, the type (for example sent, received, withdrawal,
            payment, fee, M-Shwari or Ziidi transfer, Fuliza), whether money went in or out, and your balance afterwards.</li>
          <li>For who you paid: only a scrambled code that is different for every student, plus the public till or
            paybill number when there is one. The code cannot be turned back into a name or a phone number.</li>
        </ul>

        <h4>What we do not keep</h4>
        <ul>
          <li>The PDF itself. It is read once and then discarded.</li>
          <li>Your statement password. It is used once to open the file and is never saved.</li>
          <li>Your name or phone number as printed on the statement.</li>
          <li>The names and phone numbers of the people you sent money to or received money from.</li>
          <li>Receipt numbers and paybill account numbers.</li>
        </ul>

        <h4>How it is used</h4>
        <ul>
          <li>Only to work out where your money comes from and where it goes, and to show you suggestions here.</li>
          <li>The suggestions come from fixed rules applied to your statement, not from a prediction model.</li>
          <li>Your statement is read by PennyWise's own service. It is not sent to other companies.</li>
        </ul>

        <h4>Your choices</h4>
        <ul>
          <li>You can delete everything we hold from your statements at any time with &ldquo;Delete my statement
            data&rdquo; on this page. The recommendations made from it are removed too.</li>
          <li>You can use the rest of PennyWise without uploading a statement.</li>
        </ul>
      </details>

      <div className="consent-row">
        <input
          id="statement-consent"
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={uploading}
        />
        <label htmlFor="statement-consent">
          I agree that PennyWise may read this statement and keep the transaction details described above to give me
          recommendations. I understand I can delete them at any time.
        </label>
      </div>

      <div className="upload-actions">
        <button type="submit" className="btn-primary" disabled={uploading}>
          {uploading 
          ? (slowUpload ? 'Waking up the server, this can take a minute…' : 'Reading your statement…')
            : 'Get my recommendations'}
        </button>
        {showUploadForm && !uploading && (
          <button type="button" className="btn-secondary" onClick={() => { setShowUploadForm(false); setUploadError(''); }}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );

  const stage = data?.stage;
  const stageInfo = stage ? STAGE_INFO[stage.stage] || { label: stage.stage, blurb: '' } : null;
  const cards = data?.recommendations || [];

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
              <p>Personalized advice from your M-Pesa statement, to guide your financial journey.</p>
            </div>
          </div>

          {/* Success/Error Messages */}
          {message && (
            <div className="alert alert-success" role="status">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              {message}
            </div>
          )}

          {error && (
            <div className="alert alert-error" role="alert">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {error}
            </div>
          )}

          {pageLoading && <div className="loading-state">Loading your recommendations...</div>}

          {/* First visit: no statement yet */}
          {!pageLoading && needsStatement && (
            <div className="statement-panel statement-panel-start">
              <h2>Start with your M-Pesa statement</h2>
              <p>
                Upload a statement covering the last 6 to 12 months. We look at how money moves in and out of your
                wallet, including M-Shwari, Ziidi and Fuliza, and turn it into a few clear next steps.
              </p>
              {renderUploadForm()}
            </div>
          )}

          {/* No statement yet: a short way into the simulator */}
          {!pageLoading && needsStatement && (
            <div className="quick-card">
              <h2>No statement yet? Try the simulator</h2>
              <p className="quick-help">
                Answer three quick questions and see what saving could look like. Nothing is saved, and without your
                statement we cannot check whether you are ready, so this is for learning only.
              </p>
              <form className="quick-form" onSubmit={handleQuickStart} noValidate>
                <div className="quick-field">
                  <label htmlFor="quick-monthly">How much could you add each month? (KES, optional)</label>
                  <input id="quick-monthly" type="number" min="0" step="any" inputMode="decimal" placeholder="For example 500"
                    value={quick.monthly} onChange={(e) => { setQuick({ ...quick, monthly: e.target.value }); setQuickError(''); }} />
                </div>
                <div className="quick-field">
                  <label htmlFor="quick-initial">How much do you have to start with? (KES)</label>
                  <input id="quick-initial" type="number" min="0" step="any" inputMode="decimal" placeholder="For example 2000"
                    value={quick.initial} onChange={(e) => { setQuick({ ...quick, initial: e.target.value }); setQuickError(''); }} />
                </div>
                <div className="quick-field">
                  <label htmlFor="quick-duration">For how long?</label>
                  <div className="quick-row">
                    <input id="quick-duration" type="number" min="1" step="1" inputMode="numeric"
                      value={quick.duration} onChange={(e) => { setQuick({ ...quick, duration: e.target.value }); setQuickError(''); }} />
                    <select aria-label="Unit" value={quick.unit} onChange={(e) => setQuick({ ...quick, unit: e.target.value })}>
                      <option value="months">months</option>
                      <option value="years">years</option>
                    </select>
                  </div>
                </div>
                {quickError && <p className="quick-error" role="alert">{quickError}</p>}
                <button type="submit" className="btn-primary">Open the simulator</button>
              </form>
            </div>
          )}

          {/* Statement summary and actions */}
          {!pageLoading && data && (
            <>
              <div className="statement-panel">
                <div className="statement-summary">
                  <h2>Your statement</h2>
                  <p>
                    {formatDay(data.statement.period_start)} to {formatDay(data.statement.period_end)}
                    {' · '}
                    {data.statement.count} {data.statement.count === 1 ? 'upload' : 'uploads'}
                    {data.statement.last_uploaded_at && <> · updated {formatUploaded(data.statement.last_uploaded_at)}</>}
                  </p>
                </div>
                <div className="statement-actions">
                  {!showUploadForm && (
                    <button type="button" className="btn-secondary" onClick={() => { setShowUploadForm(true); clearMessages(); }}>
                      Add or update statement
                    </button>
                  )}
                  <button type="button" className="btn-danger-link" onClick={handleDeleteData} disabled={deleting}>
                    {deleting ? 'Deleting...' : 'Delete my statement data'}
                  </button>
                </div>
                {showUploadForm && renderUploadForm()}
              </div>

              {/* Where you are */}
              <div className="stage-banner">
                <div className="stage-heading">
                  <div>
                    <p className="stage-kicker">Where you are right now</p>
                    <h2>{stageInfo.label}</h2>
                    {stageInfo.blurb && <p className="stage-blurb">{stageInfo.blurb}</p>}
                  </div>
                  <span className={`confidence-chip confidence-${stage.confidence}`}>
                    Data confidence: {CONFIDENCE_LABEL[stage.confidence] || stage.confidence}
                  </span>
                </div>

                {stage.reasons?.length > 0 && (
                  <>
                    <h3>Why we say this</h3>
                    <ul className="stage-list">
                      {stage.reasons.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  </>
                )}

                {stage.notes?.length > 0 && (
                  <>
                    <h3>Good to know</h3>
                    <ul className="stage-list stage-notes">
                      {stage.notes.map((n) => <li key={n}>{n}</li>)}
                    </ul>
                  </>
                )}
              </div>

              {/* Savings held outside the wallet */}
              <div className="savings-card">
                <h2>Savings outside M-Pesa</h2>
                <p className="savings-help">
                  A statement cannot show money kept in M-Shwari, Ziidi, a SACCO or a bank. Add the total so your advice
                  counts it. We store this one number only, never account details.
                </p>
                {data.savings_balance?.amount != null && !editingSavings ? (
                  <div className="savings-current">
                    <p>
                      <strong>KES {formatKes(data.savings_balance.amount)}</strong>
                      {data.savings_balance.updated_at && <span className="savings-updated"> · updated {formatSavedDay(data.savings_balance.updated_at)}</span>}
                    </p>
                    <div className="savings-actions">
                      <button type="button" className="btn-secondary" onClick={() => { setEditingSavings(true); setSavingsInput(String(data.savings_balance.amount)); setSavingsError(''); }}>
                        Change
                      </button>
                      <button type="button" className="btn-danger-link" onClick={() => saveSavings(null)} disabled={savingsBusy}>
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <form className="savings-form" onSubmit={handleSaveSavings} noValidate>
                    <label htmlFor="savings-amount">Total savings (KES)</label>
                    <div className="savings-row">
                      <input
                        id="savings-amount"
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        placeholder="For example 2500"
                        value={savingsInput}
                        onChange={(e) => { setSavingsInput(e.target.value); setSavingsError(''); }}
                      />
                      <button type="submit" className="btn-primary" disabled={savingsBusy}>
                        {savingsBusy ? 'Saving...' : 'Save'}
                      </button>
                      {editingSavings && (
                        <button type="button" className="btn-secondary" onClick={() => { setEditingSavings(false); setSavingsError(''); }}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                )}
                {savingsError && <p className="savings-error" role="alert">{savingsError}</p>}
              </div>

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
                  <p>{tipForToday()}</p>
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

                {cards.length === 0 ? (
                  <div className="empty-state-large">
                    <h3>Nothing to suggest right now</h3>
                    <p>Add more of your statement and we will look again.</p>
                  </div>
                ) : (
                  <div className="recommendations-grid">
                    {cards.map((recommendation) => (
                      <div key={recommendation.rule_id} className="recommendation-card">
                        <div className="recommendation-icon">{getCategoryIcon(recommendation.category)}</div>
                        <h3 className="recommendation-title">{recommendation.title}</h3>
                        <p className="recommendation-preview">{recommendation.what}</p>
                        <p className="recommendation-step"><strong>First step:</strong> {recommendation.first_step}</p>
                        <div className="recommendation-meta">
                          <span className={`status-badge ${getStatusBadgeClass(recommendation.status)}`}>
                            {recommendation.status}
                          </span>
                          <span className="category-chip">{recommendation.category}</span>
                        </div>
                        {recommendation.simulator && (
                          <button type="button" className="simulator-btn" onClick={() => openSimulator(recommendation.simulator)}>
                            {recommendation.simulator.monthly_amount
                              ? `Try the simulator with KES ${formatKes(recommendation.simulator.monthly_amount)} a month`
                              : 'Try the simulator'}
                          </button>
                        )}
                        <button className="learn-more-btn" onClick={() => handleViewDetails(recommendation)}>
                          Learn More
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14"></path>
                            <path d="M12 5l7 7-7 7"></path>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

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
                    <p className="stat-label">Total</p>
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
          <div className="modal-content" role="dialog" aria-label={selectedRecommendation.title} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedRecommendation.title}</h2>
              <button className="modal-close" aria-label="Close" onClick={() => setShowDetailModal(false)}>
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
                  <span className="category-chip">{selectedRecommendation.category}</span>
                </div>

                <div className="detail-content">
                  <h3>What to do</h3>
                  <p>{selectedRecommendation.what}</p>
                </div>

                <div className="detail-content">
                  <h3>Your first step</h3>
                  <p>{selectedRecommendation.first_step}</p>
                </div>

                <div className="detail-content">
                  <h3>Why we are suggesting this</h3>
                  <p>{selectedRecommendation.why}</p>
                </div>

                {selectedRecommendation.learn && (
                  <div className="detail-content">
                    <h3>Worth knowing</h3>
                    <p>{selectedRecommendation.learn}</p>
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
              <button className="btn-secondary" onClick={() => setShowDetailModal(false)}>
                Close
              </button>
              <button
                className="btn-primary"
                disabled={!selectedRecommendation.recommendation_id}
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
          <div className="modal-content" role="dialog" aria-label="Update recommendation status" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Update Recommendation Status</h2>
              <button className="modal-close" aria-label="Close" onClick={() => setShowFeedbackModal(false)}>
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
                    disabled={saving}
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
                    disabled={saving}
                  />
                  <small className="char-count">{feedbackForm.feedback.length}/500</small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowFeedbackModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Submitting...' : 'Submit Feedback'}
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
