import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import DashboardNavbar from '../components/DashboardNavbar';
import DashboardFooter from '../components/DashboardFooter';
import api from '../api/axios';
import './StudentDashboard.css';

// Where the pages live in your router (see App.jsx).
const RECOMMENDATIONS_PATH = '/recommendations';
const SIMULATOR_PATH = '/simulation';
const BADGES_PATH = '/badges';

const STAGE_INFO = {
  not_enough_data: { label: 'We need more data', blurb: 'Add more of your statement so we can say something useful.' },
  short_of_cash: { label: 'Cash is tight', blurb: 'Your wallet often runs low before the next deposit.' },
  stable: { label: 'Stable', blurb: 'Your spending is steady. The next step is a cushion.' },
  building_habit: { label: 'Building a saving habit', blurb: 'You already save. Let it grow.' },
  ready_to_explore: { label: 'Ready to explore', blurb: 'You have a buffer and a saving habit.' },
};

const formatKes = (n) => `KES ${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

// Statement times are Nairobi wall-clock times without a zone, so only the date is shown.
const formatDay = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Full ISO timestamps with an offset: always show the day in Nairobi time.
const formatSavedDay = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' });
};

// One sentence about a typical month. Returns null when the engine could not work one out.
const typicalMonthSentence = (t) => {
  if (!t || t.inflow == null || t.outflow == null) return null;
  const base = `In a typical month about ${formatKes(t.inflow)} comes in and ${formatKes(t.outflow)} goes out`;
  return t.leftover > 0
    ? `${base}, which leaves you about ${formatKes(t.leftover)}.`
    : `${base}, so a typical month leaves you nothing extra.`;
};


const StudentDashboard = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  // 'loading' | 'ok' | 'none' (no statement yet) | 'error'
  const [recStatus, setRecStatus] = useState('loading');
  const [rec, setRec] = useState(null);

  // Badges: { status: 'loading'|'ok'|'error', total, level, xp, newly }
  const [badges, setBadges] = useState({ status: 'loading', total: 0, level: 0, xp: 0, newly: 0 });

  useEffect(() => {
    loadRecommendations();
    loadBadges();
  }, []);

  const loadRecommendations = async () => {
    setRecStatus('loading');
    try {
      const response = await api.get('/statements/recommendations');
      setRec(response.data?.data || null);
      setRecStatus(response.data?.data ? 'ok' : 'error');
    } catch (err) {
      if (err.response?.status === 404 && err.response?.data?.code === 'NO_STATEMENT') {
        setRec(null);
        setRecStatus('none');
      } else {
        setRecStatus('error');
      }
    }
  };

  // Award anything newly earned (a failure here is ignored), then read the totals.
  const loadBadges = async () => {
    let newly = 0;
    try {
      const check = await api.post('/badges/check-my-badges');
      newly = check.data?.data?.total_new_badges || 0;
    } catch (err) {
      // the badge check is a bonus; still show what is already earned
    }
    try {
      const response = await api.get('/badges/my-badges');
      const xp = response.data?.summary?.xp_info || {};
      setBadges({
        status: 'ok',
        total: response.data?.summary?.total_badges ?? (response.data?.data || []).length,
        level: xp.level || 0,
        xp: xp.total_xp || 0,
        newly,
      });
    } catch (err) {
      setBadges({ status: 'error', total: 0, level: 0, xp: 0, newly: 0 });
    }
  };

  const stage = rec?.stage;
  const stageInfo = stage ? STAGE_INFO[stage.stage] || { label: stage.stage, blurb: '' } : null;
  const cards = rec?.recommendations || [];
  const topCard = cards[0] || null;
  const isStale = cards.some((c) => c.rule_id === 'upload_recent_statement');
  const simulatorHint = cards.map((c) => c.simulator).find((s) => s && s.monthly_amount) || null;
  const typical = typicalMonthSentence(rec?.typical_month);
  const savings = rec?.savings_balance?.amount;

  const openSimulator = () => {
    if (simulatorHint) {
      navigate(SIMULATOR_PATH, {
        state: { prefill: { investment_type: simulatorHint.investment_type, monthly_amount: simulatorHint.monthly_amount } },
      });
    } else {
      navigate(SIMULATOR_PATH);
    }
  };

  return (
    <div className="student-dashboard-page">
      <DashboardNavbar activePage="Dashboard" />

      <main className="dashboard-main">
        <div className="dashboard-container">
          <div className="welcome-section">
            <div>
              <h1 className="welcome-title">Welcome back, {user?.name || 'Student'}!</h1>
              <p className="welcome-subtitle">Here's a quick overview of your financial journey. Keep up the great work!</p>
            </div>
          </div>

          <div className="dashboard-grid">
            {/* Left column: where you stand, and what to do next */}
            <div className="dashboard-left">
              <div className="dashboard-card stage-card">
                <div className="card-header">
                  <h2 className="card-title">Where you stand</h2>
                  <p className="card-subtitle">Worked out from your M-Pesa statement.</p>
                </div>

                {recStatus === 'loading' && <div className="loading-state">Loading…</div>}

                {recStatus === 'error' && (
                  <div className="empty-state">
                    <p>We could not load this right now.</p>
                    <button type="button" className="action-btn secondary inline-btn" onClick={loadRecommendations}>
                      Try again
                    </button>
                  </div>
                )}

                {recStatus === 'none' && (
                  <div className="empty-state">
                    <p>You have not uploaded a statement yet. Upload one and we will show where you stand and what to do next.</p>
                    <div className="empty-actions">
                      <button type="button" className="action-btn primary inline-btn" onClick={() => navigate(RECOMMENDATIONS_PATH)}>
                        Upload your statement
                      </button>
                      <button type="button" className="action-btn secondary inline-btn" onClick={openSimulator}>
                        Try the simulator
                      </button>
                    </div>
                  </div>
                )}

                {recStatus === 'ok' && stageInfo && (
                  <div className="stage-body">
                    <p className="stage-label">{stageInfo.label}</p>
                    {stageInfo.blurb && <p className="stage-blurb">{stageInfo.blurb}</p>}
                    {stage.reasons?.[0] && <p className="stage-reason">{stage.reasons[0]}</p>}
                    {typical && <p className="typical-month">{typical}</p>}
                  </div>
                )}
              </div>

              {recStatus === 'ok' && topCard && (
                <div className="dashboard-card next-step-card">
                  <div className="card-header">
                    <h2 className="card-title">Your next step</h2>
                    <p className="card-subtitle">{topCard.title}</p>
                  </div>
                  <p className="next-step-what">{topCard.what}</p>
                  {topCard.first_step && (
                    <p className="next-step-first"><strong>Start here:</strong> {topCard.first_step}</p>
                  )}
                  <button type="button" className="action-btn primary inline-btn" onClick={() => navigate(RECOMMENDATIONS_PATH)}>
                    See all steps
                  </button>
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="dashboard-right">
              <div className="dashboard-card quick-actions-card">
                <h2 className="card-title">Quick Actions</h2>
                <div className="quick-actions">
                  <button className="action-btn primary" onClick={() => navigate(RECOMMENDATIONS_PATH)}>
                    Upload statement
                  </button>
                  <button className="action-btn secondary" onClick={() => navigate(SIMULATOR_PATH)}>
                    Start Simulation
                  </button>
                </div>
              </div>

              {recStatus === 'ok' && (
                <div className="dashboard-card statement-card">
                  <h2 className="card-title">Your statement</h2>
                  <dl className="fact-list">
                    {rec.statement?.period_start && rec.statement?.period_end && (
                      <div>
                        <dt>Covers</dt>
                        <dd>{formatDay(rec.statement.period_start)} to {formatDay(rec.statement.period_end)}</dd>
                      </div>
                    )}
                    {rec.statement?.last_uploaded_at && (
                      <div>
                        <dt>Last uploaded</dt>
                        <dd>{formatSavedDay(rec.statement.last_uploaded_at)}</dd>
                      </div>
                    )}
                  </dl>
                  {isStale && (
                    <p className="stale-note">
                      This statement is getting old. Upload a recent one so your advice fits you now.
                    </p>
                  )}
                </div>
              )}

              {recStatus === 'ok' && (
                <div className="dashboard-card savings-card">
                  <h2 className="card-title">Savings and simulator</h2>
                  {savings != null ? (
                    <p className="savings-line">
                      You told us you keep <strong>{formatKes(savings)}</strong> in savings outside your wallet
                      {rec.savings_balance.updated_at ? ` (as of ${formatSavedDay(rec.savings_balance.updated_at)})` : ''}.
                    </p>
                  ) : (
                    <p className="savings-line">
                      Add any savings you keep outside M-Pesa on the Recommendations page for a more accurate picture.
                    </p>
                  )}
                  {simulatorHint && (
                    <p className="savings-line">
                      A fifth of what a typical month leaves you is about <strong>{formatKes(simulatorHint.monthly_amount)}</strong> a month.
                    </p>
                  )}
                  <button type="button" className="action-btn secondary" onClick={openSimulator}>
                    Try the simulator
                  </button>
                </div>
              )}

              <div className="dashboard-card">
                <div className="card-header goals-header">
                  <div>
                    <h2 className="card-title">Badges</h2>
                    <p className="card-subtitle">Earned by uploading statements and trying the simulator.</p>
                  </div>
                  <button className="view-all-btn" onClick={() => navigate(BADGES_PATH)}>See badges</button>
                </div>

                {badges.status === 'loading' ? (
                  <div className="loading-state compact">Loading badges...</div>
                ) : badges.status === 'error' ? (
                  <div className="empty-state compact"><p>We could not load your badges right now.</p></div>
                ) : (
                  <div className="badges-summary">
                    {badges.newly > 0 && (
                      <p className="badges-new">You just earned {badges.newly} new {badges.newly === 1 ? 'badge' : 'badges'}!</p>
                    )}
                    <p className="badges-line">
                      {badges.total === 0
                        ? 'No badges yet. Upload a statement or save a simulation to earn your first one.'
                        : `${badges.total} ${badges.total === 1 ? 'badge' : 'badges'} earned`}
                    </p>
                    <p className="badges-xp">Level {badges.level} · {badges.xp} XP</p>
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
