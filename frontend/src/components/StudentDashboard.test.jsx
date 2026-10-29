import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import api from '../api/axios';
import StudentDashboard from './StudentDashboard';
import DashboardNavbar from './DashboardNavbar';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }));

const card = (rule_id, o = {}) => ({
  recommendation_id: 1, rule_id, category: 'Saving', title: `Title ${rule_id}`, what: `What ${rule_id}`,
  why: `Why ${rule_id}`, first_step: `Step ${rule_id}`, learn: null, impact_kes: null, simulator: null,
  status: 'pending', feedback: null, created_at: '2026-10-13T06:46:09+03:00', ...o,
});

const payload = (over = {}) => ({
  statement: {
    count: 2, period_start: '2025-01-02T16:39:34', period_end: '2026-10-01T20:08:55',
    last_uploaded_at: '2026-10-13T06:46:09+03:00',
  },
  stage: {
    stage: 'building_habit', confidence: 'medium', borrowing: 'none_detected', buffer_days: 8.6,
    reasons: ['Saving activity found (M-Shwari or Ziidi deposits).', 'Second reason that should not show.'],
    notes: ['A note that should not show.'], next_step: { id: 'make_saving_consistent', title: 'Make your saving regular' },
  },
  typical_month: { inflow: 12000, outflow: 9000, leftover: 3000 },
  savings_balance: { amount: null, updated_at: null },
  data_quality: { days_since_last: 12, last_transaction: '2026-10-01T20:08:55' },
  recommendations: [card('make_saving_consistent'), card('build_buffer')],
  ...over,
});

const noStatement = () => Object.assign(new Error('404'), {
  response: { status: 404, data: { status: 'error', code: 'NO_STATEMENT', message: 'Upload an M-Pesa statement first.' } },
});

const badgesOk = (total = 0, level = 1, xp = 0) => ({
  data: { data: [], summary: { total_badges: total, xp_info: { total_xp: xp, level } } },
});
const checkOk = (n = 0) => ({ data: { data: { total_new_badges: n, newly_earned: [] } } });

/** GET routing: statement endpoint -> `rec`, badges -> `badges`, anything else is a test failure. */
const routeGets = (rec, badges = () => Promise.resolve(badgesOk())) => {
  api.post.mockImplementation((url) => (url === '/badges/check-my-badges' ? Promise.resolve(checkOk()) : Promise.reject(new Error(`unexpected POST ${url}`))));
  return api.get.mockImplementation((url) => {
    if (url === '/statements/recommendations') return rec();
    if (url === '/badges/my-badges') return badges();
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
};
const ok = (data) => () => Promise.resolve({ data: { status: 'success', data } });

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  navigateMock.mockReset();
});

describe('what the dashboard no longer has', () => {
  it('has no balance, income/expense, chart, transactions or add-entry button, and never asks for manual entries', async () => {
    routeGets(ok(payload()));
    render(<StudentDashboard />);
    await screen.findByText('Building a saving habit');

    for (const gone of [/Budget Overview/i, /Current Balance/i, /Recent Transactions/i, /Add Income\/Expense/i, /Latest Recommendation/i, /Confidence:/i]) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
    const urls = api.get.mock.calls.map((c) => c[0]).sort();
    expect(urls).toEqual(['/badges/my-badges', '/statements/recommendations']);   // nothing from financial-data, budgets or goals
    await waitFor(() => expect(api.post.mock.calls.map((c) => c[0])).toEqual(['/badges/check-my-badges']));
  });

  it('the navbar has no Finance Hub, Budgets or Goals link', () => {
    render(<DashboardNavbar activePage="Dashboard" />);
    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names).toEqual(expect.arrayContaining(['Dashboard', 'Simulation', 'Recommendations', 'Badges']));
    expect(names).not.toContain('Finance Hub');
    expect(names).not.toContain('Budgets');
    expect(names).not.toContain('Goals & Badges');
  });
});

describe('with a statement', () => {
  beforeEach(() => { routeGets(ok(payload())); });

  it('shows the stage in plain words and only the first reason', async () => {
    render(<StudentDashboard />);
    expect(await screen.findByText('Building a saving habit')).toBeInTheDocument();
    expect(screen.getByText('You already save. Let it grow.')).toBeInTheDocument();
    expect(screen.getByText('Saving activity found (M-Shwari or Ziidi deposits).')).toBeInTheDocument();
    expect(screen.queryByText(/Second reason/)).not.toBeInTheDocument();
    expect(screen.queryByText(/A note that should not show/)).not.toBeInTheDocument();
  });

  it('says what a typical month leaves you', async () => {
    render(<StudentDashboard />);
    expect(await screen.findByText(
      'In a typical month about KES 12,000 comes in and KES 9,000 goes out, which leaves you about KES 3,000.',
    )).toBeInTheDocument();
  });

  it.each([
    ['nothing left over', { inflow: 5000, outflow: 5000, leftover: 0 }],
    ['more going out than coming in', { inflow: 5000, outflow: 6500, leftover: -1500 }],
  ])('does not promise money when the month leaves %s', async (_name, t) => {
    routeGets(ok(payload({ typical_month: t })));
    render(<StudentDashboard />);
    const line = await screen.findByText(/In a typical month/);
    expect(line).toHaveTextContent('so a typical month leaves you nothing extra.');
    expect(line).not.toHaveTextContent('which leaves you about');
    expect(line).not.toHaveTextContent('-');                    // no negative amount is shown
  });

  it.each([
    ['money in is missing', { inflow: null, outflow: 5000, leftover: null }],
    ['money out is missing', { inflow: 5000, outflow: null, leftover: null }],
  ])('leaves the line out when %s', async (_n, t) => {
    routeGets(ok(payload({ typical_month: t })));
    render(<StudentDashboard />);
    await screen.findByText('Building a saving habit');
    expect(screen.queryByText(/In a typical month/)).not.toBeInTheDocument();
  });

  it('leaves the line out when the engine could not work out a typical month', async () => {
    routeGets(ok(payload({ typical_month: null })));
    render(<StudentDashboard />);
    await screen.findByText('Building a saving habit');
    expect(screen.queryByText(/In a typical month/)).not.toBeInTheDocument();
  });

  it('shows the top card as the next step, and "See all steps" goes to the recommendations page', async () => {
    const user = userEvent.setup();
    render(<StudentDashboard />);
    const heading = await screen.findByRole('heading', { name: 'Your next step' });
    const box = heading.closest('.dashboard-card');
    expect(within(box).getByText('Title make_saving_consistent')).toBeInTheDocument();
    expect(within(box).getByText('What make_saving_consistent')).toBeInTheDocument();
    expect(box).toHaveTextContent('Start here: Step make_saving_consistent');
    expect(within(box).queryByText(/build_buffer/)).not.toBeInTheDocument();   // only the top card

    await user.click(within(box).getByRole('button', { name: 'See all steps' }));
    expect(navigateMock).toHaveBeenCalledWith('/recommendations');
  });

  it('has no next-step card when there are no cards', async () => {
    routeGets(ok(payload({ recommendations: [] })));
    render(<StudentDashboard />);
    await screen.findByText('Building a saving habit');
    expect(screen.queryByRole('heading', { name: 'Your next step' })).not.toBeInTheDocument();
  });

  it('shows when the statement covers and when it was uploaded, in Nairobi time', async () => {
    routeGets(ok(payload({ statement: { ...payload().statement, last_uploaded_at: '2026-10-13T01:30:00+03:00' } })));
    render(<StudentDashboard />);
    const box = (await screen.findByRole('heading', { name: 'Your statement' })).closest('.dashboard-card');
    expect(box).toHaveTextContent('2 Jan 2025 to 1 Oct 2026');
    expect(box).toHaveTextContent('13 Oct 2026');
    expect(within(box).queryByText(/getting old/)).not.toBeInTheDocument();
  });

  it('nudges for a fresh statement only when the engine says the statement is stale', async () => {
    routeGets(ok(payload({ recommendations: [card('upload_recent_statement', { priority: 0 }), card('build_buffer')] })));
    render(<StudentDashboard />);
    expect(await screen.findByText(/This statement is getting old/)).toBeInTheDocument();
  });

  it('reports the stored savings balance with its day, and offers the simulator', async () => {
    const user = userEvent.setup();
    routeGets(ok(payload({ savings_balance: { amount: 2500.5, updated_at: '2026-10-13T01:30:00+03:00' } })));
    render(<StudentDashboard />);
    const box = (await screen.findByRole('heading', { name: 'Savings and simulator' })).closest('.dashboard-card');
    expect(box).toHaveTextContent('KES 2,501');
    expect(box).toHaveTextContent('as of 13 Oct 2026');                 // 01:30 in Nairobi is still the 12th in UTC
    await user.click(within(box).getByRole('button', { name: 'Try the simulator' }));
    expect(navigateMock).toHaveBeenCalledWith('/simulation');           // no suggested amount, so nothing is prefilled
  });

  it('asks the student to add savings when there is no balance yet', async () => {
    render(<StudentDashboard />);
    const box = (await screen.findByRole('heading', { name: 'Savings and simulator' })).closest('.dashboard-card');
    expect(box).toHaveTextContent('Add any savings you keep outside M-Pesa');
    expect(box).not.toHaveTextContent('You told us');
  });

  it('opens the simulator with the suggested monthly amount when the engine gave one', async () => {
    const user = userEvent.setup();
    routeGets(ok(payload({
      recommendations: [card('learn_investing_basics', { simulator: { investment_type: 'mmf', monthly_amount: 600 } })],
    })));
    render(<StudentDashboard />);
    const box = (await screen.findByRole('heading', { name: 'Savings and simulator' })).closest('.dashboard-card');
    expect(box).toHaveTextContent('A fifth of what a typical month leaves you is about KES 600 a month');
    await user.click(within(box).getByRole('button', { name: 'Try the simulator' }));
    expect(navigateMock).toHaveBeenCalledWith('/simulation', {
      state: { prefill: { investment_type: 'mmf', monthly_amount: 600 } },
    });
  });

  it('does not mention a suggested amount when the simulator hint has none', async () => {
    routeGets(ok(payload({
      recommendations: [card('learn_investing_basics', { simulator: { investment_type: 'mmf', monthly_amount: null } })],
    })));
    render(<StudentDashboard />);
    const box = (await screen.findByRole('heading', { name: 'Savings and simulator' })).closest('.dashboard-card');
    expect(box).not.toHaveTextContent('fifth');
  });

  it('shows the stage name for an unknown stage rather than nothing', async () => {
    routeGets(ok(payload({ stage: { ...payload().stage, stage: 'brand_new_stage' } })));
    render(<StudentDashboard />);
    expect(await screen.findByText('brand_new_stage')).toBeInTheDocument();
  });
});

describe('without a statement', () => {
  beforeEach(() => { routeGets(() => Promise.reject(noStatement())); });

  it('invites an upload, offers the simulator, and shows no statement cards', async () => {
    const user = userEvent.setup();
    render(<StudentDashboard />);
    expect(await screen.findByText(/You have not uploaded a statement yet/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your statement' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your next step' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Savings and simulator' })).not.toBeInTheDocument();

    const stage = screen.getByRole('heading', { name: 'Where you stand' }).closest('.dashboard-card');
    await user.click(within(stage).getByRole('button', { name: 'Upload your statement' }));
    expect(navigateMock).toHaveBeenLastCalledWith('/recommendations');
    await user.click(within(stage).getByRole('button', { name: 'Try the simulator' }));
    expect(navigateMock).toHaveBeenLastCalledWith('/simulation');
  });
});

describe('when the statement service fails', () => {
  it('says so, does not claim there is no statement, and can retry', async () => {
    const user = userEvent.setup();
    let calls = 0;
    routeGets(() => {
      calls += 1;
      return calls === 1
        ? Promise.reject(Object.assign(new Error('boom'), { response: { status: 502, data: { code: 'STATEMENT_SERVICE_ERROR' } } }))
        : Promise.resolve({ data: { data: payload() } });
    });
    render(<StudentDashboard />);
    expect(await screen.findByText('We could not load this right now.')).toBeInTheDocument();
    expect(screen.queryByText(/not uploaded a statement/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Building a saving habit')).toBeInTheDocument();
  });

  it('a network error is also a failure, not "no statement"', async () => {
    routeGets(() => Promise.reject(new Error('Network Error')));
    render(<StudentDashboard />);
    expect(await screen.findByText('We could not load this right now.')).toBeInTheDocument();
  });

  it('a 404 that is not NO_STATEMENT is a failure too', async () => {
    routeGets(() => Promise.reject(Object.assign(new Error('x'), { response: { status: 404, data: { code: 'SOMETHING_ELSE' } } })));
    render(<StudentDashboard />);
    expect(await screen.findByText('We could not load this right now.')).toBeInTheDocument();
  });
});

describe('quick actions and badges', () => {
  beforeEach(() => { routeGets(ok(payload())); });

  it('Quick Actions are Upload statement and Start Simulation', async () => {
    const user = userEvent.setup();
    render(<StudentDashboard />);
    const box = screen.getByRole('heading', { name: 'Quick Actions' }).closest('.dashboard-card');
    await user.click(within(box).getByRole('button', { name: 'Upload statement' }));
    expect(navigateMock).toHaveBeenLastCalledWith('/recommendations');
    await user.click(within(box).getByRole('button', { name: 'Start Simulation' }));
    expect(navigateMock).toHaveBeenLastCalledWith('/simulation');
  });

  const badgesCard = () => screen.getByRole('heading', { name: 'Badges' }).closest('.dashboard-card');

  it('shows the earned count, level and XP', async () => {
    routeGets(ok(payload()), () => Promise.resolve(badgesOk(3, 2, 130)));
    render(<StudentDashboard />);
    expect(await screen.findByText('3 badges earned')).toBeInTheDocument();
    expect(within(badgesCard()).getByText('Level 2 · 130 XP')).toBeInTheDocument();
  });

  it('says "1 badge" for one, and invites the first one for none', async () => {
    routeGets(ok(payload()), () => Promise.resolve(badgesOk(1, 1, 20)));
    const { unmount } = render(<StudentDashboard />);
    expect(await screen.findByText('1 badge earned')).toBeInTheDocument();
    unmount();
    routeGets(ok(payload()));
    render(<StudentDashboard />);
    expect(await screen.findByText(/No badges yet\. Upload a statement or save a simulation/)).toBeInTheDocument();
  });

  it('announces newly earned badges, and checks before reading the totals', async () => {
    const order = [];
    routeGets(ok(payload()), () => { order.push('get'); return Promise.resolve(badgesOk(2, 1, 70)); });
    api.post.mockImplementation(() => { order.push('post'); return Promise.resolve(checkOk(2)); });
    render(<StudentDashboard />);
    expect(await screen.findByText('You just earned 2 new badges!')).toBeInTheDocument();
    expect(order).toEqual(['post', 'get']);
  });

  it('one new badge is singular', async () => {
    routeGets(ok(payload()), () => Promise.resolve(badgesOk(1, 1, 20)));
    api.post.mockResolvedValue(checkOk(1));
    render(<StudentDashboard />);
    expect(await screen.findByText('You just earned 1 new badge!')).toBeInTheDocument();
  });

  it('if the badge check fails, the earned badges still show', async () => {
    routeGets(ok(payload()), () => Promise.resolve(badgesOk(2, 1, 70)));
    api.post.mockRejectedValue(new Error('check down'));
    render(<StudentDashboard />);
    expect(await screen.findByText('2 badges earned')).toBeInTheDocument();
    expect(screen.queryByText(/You just earned/)).not.toBeInTheDocument();
  });

  it('a badges failure does not break the statement cards, and "See badges" goes to /badges', async () => {
    const user = userEvent.setup();
    routeGets(ok(payload()), () => Promise.reject(new Error('badges down')));
    render(<StudentDashboard />);
    expect(await screen.findByText('Building a saving habit')).toBeInTheDocument();
    expect(await screen.findByText('We could not load your badges right now.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'See badges' }));
    expect(navigateMock).toHaveBeenLastCalledWith('/badges');
  });

  it('a statement failure does not hide the badges', async () => {
    routeGets(() => Promise.reject(new Error('Network Error')), () => Promise.resolve(badgesOk(4, 2, 150)));
    render(<StudentDashboard />);
    expect(await screen.findByText('4 badges earned')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('We could not load this right now.')).toBeInTheDocument());
  });
});
