import React, { useState, useEffect } from 'react';
import DashboardNavbar from '../components/DashboardNavbar';
import DashboardFooter from '../components/DashboardFooter';
import authService from '../services/authService';
import api from '../api/axios';
import './Badges.css';

const list = (res) => {
  const d = res?.data;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d)) return d;
  return [];
};

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const Badges = () => {
  const user = authService.getCurrentUser();

  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
  const [progress, setProgress] = useState([]);     // every badge, with the student's progress
  const [earned, setEarned] = useState([]);         // earned badges, with earned_at
  const [xp, setXp] = useState({ total_xp: 0, level: 1, xp_progress: 0, xp_needed: 100 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    load(true);
  }, []);

  const load = async (checkFirst = false) => {
    if (checkFirst) {
      try {
        const check = await api.post('/badges/check-my-badges');
        const n = check.data?.data?.total_new_badges || 0;
        if (n > 0) setMessage(`You just earned ${n} new ${n === 1 ? 'badge' : 'badges'}!`);
      } catch (err) {
        // the check is a bonus; carry on and show what is already earned
      }
    }
    try {
      const [mine, prog] = await Promise.all([api.get('/badges/my-badges'), api.get('/badges/my-progress')]);
      setEarned(list(mine));
      setProgress(list(prog));
      if (mine.data?.summary?.xp_info) setXp((x) => ({ ...x, ...mine.data.summary.xp_info }));
      setStatus('ok');
    } catch (err) {
      setStatus('error');
      return;
    }
    try {
      const lb = await api.get('/badges/leaderboard', { params: { limit: 10 } });
      setLeaderboard(list(lb));
    } catch (err) {
      setLeaderboard([]);
    }
  };

  const earnedAt = (id) => earned.find((b) => b.badge_id === id)?.earned_at;
  const done = progress.filter((b) => b.has_earned);
  const todo = progress.filter((b) => !b.has_earned);
  const levelPct = xp.xp_needed > 0 ? Math.min(100, (xp.xp_progress / xp.xp_needed) * 100) : 0;

  const image = (b) => b.image_url ? <img src={b.image_url_full || b.image_url} alt="" /> : <span aria-hidden="true">★</span>;

  return (
    <div className="badges-page">
      <DashboardNavbar activePage="Badges" />

      <main className="badges-main">
        <div className="badges-container">
          <h1>Badges</h1>
          <p className="badges-intro">
            Badges are earned by uploading your M-Pesa statements and trying the investment simulator. They are for learning, not for spending.
          </p>

          {message && <p className="badges-banner" role="status">{message}</p>}

          {status === 'loading' && <div className="loading-state">Loading badges...</div>}
          {status === 'error' && <div className="empty-state-small"><p>We could not load your badges right now.</p></div>}

          {status === 'ok' && (
            <>
              <section className="level-card" aria-label="Your level">
                <div className="level-number">Level {xp.level}</div>
                <div className="level-xp">{xp.total_xp} XP</div>
                <div className="badge-progress-bar" aria-hidden="true">
                  <div className="badge-progress-fill" style={{ width: `${levelPct}%` }} />
                </div>
                <div className="level-next">{xp.xp_progress} / {xp.xp_needed} XP to the next level</div>
              </section>

              <section className="badges-section">
                <h2>Earned</h2>
                {done.length === 0 ? (
                  <div className="empty-state-small"><p>No badges earned yet. Upload a statement or save a simulation to earn your first one.</p></div>
                ) : (
                  <div className="badges-grid">
                    {done.map((b) => (
                      <div key={b.badge_id} className="badge-card earned">
                        <div className="badge-icon">{image(b)}</div>
                        <h3 className="badge-name">{b.badge_name}</h3>
                        <p className="badge-description">{b.description}</p>
                        <div className="badge-xp">+{b.xp_reward} XP</div>
                        {earnedAt(b.badge_id) && <div className="badge-earned-date">Earned {formatDate(earnedAt(b.badge_id))}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="badges-section">
                <h2>Still to earn</h2>
                {todo.length === 0 ? (
                  <div className="empty-state-small"><p>You have earned every badge. Well done!</p></div>
                ) : (
                  <div className="badges-grid">
                    {todo.map((b) => (
                      <div key={b.badge_id} className="badge-card locked">
                        <div className="badge-icon">{image(b)}</div>
                        <h3 className="badge-name">{b.badge_name}</h3>
                        <p className="badge-criteria">{b.criteria_description}</p>
                        <div className="badge-progress">
                          <div className="badge-progress-bar" aria-hidden="true">
                            <div className="badge-progress-fill" style={{ width: `${Math.min(100, b.progress_percentage || 0)}%` }} />
                          </div>
                          <span className="badge-progress-text">{b.current_value} / {b.criteria_value}</span>
                        </div>
                        <div className="badge-xp">+{b.xp_reward} XP</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="leaderboard-section">
                <h2>Top badge earners</h2>
                {leaderboard.length === 0 ? (
                  <div className="empty-state-small"><p>No leaderboard data available yet.</p></div>
                ) : (
                  <div className="leaderboard-table">
                    <div className="leaderboard-header"><span>Rank</span><span>Student</span><span>Badges</span><span>Total XP</span></div>
                    {leaderboard.map((e, i) => (
                      <div key={e.id ?? i} className={`leaderboard-row ${e.id === user?.id ? 'current-user' : ''}`}>
                        <span className="rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                        <span className="student-name">
                          {e.name || 'Unknown student'}
                          {e.id === user?.id && <span className="you-badge">You</span>}
                        </span>
                        <span className="badge-count">{e.badge_count || 0}</span>
                        <span className="xp-total">{e.xp_total || 0} XP</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      <DashboardFooter />
    </div>
  );
};

export default Badges;
