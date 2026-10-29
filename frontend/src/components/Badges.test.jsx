import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import api from '../api/axios';
import Badges from './Badges';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../services/authService', () => ({ default: { getCurrentUser: () => ({ id: 5, name: 'Me' }) } }));

const prog = (id, name, o = {}) => ({
  badge_id: id, badge_name: name, description: `${name} description`, criteria_type: 'statement_count',
  criteria_value: 3, current_value: 1, progress_percentage: 33.33, xp_reward: 50, has_earned: false,
  image_url: null, criteria_description: 'Upload 3 M-Pesa statements', ...o,
});

const setup = ({ progress, mine = [], xp = {}, leaderboard = [], check = 0, fail = {} } = {}) => {
  api.post.mockImplementation(() => (fail.check ? Promise.reject(new Error('x')) : Promise.resolve({ data: { data: { total_new_badges: check } } })));
  api.get.mockImplementation((url) => {
    if (fail[url]) return Promise.reject(new Error('x'));
    if (url === '/badges/my-badges') return Promise.resolve({ data: { data: mine, summary: { xp_info: { total_xp: 0, level: 1, xp_progress: 0, xp_needed: 100, ...xp } } } });
    if (url === '/badges/my-progress') return Promise.resolve({ data: { data: progress ?? [] } });
    if (url === '/badges/leaderboard') return Promise.resolve({ data: { data: leaderboard } });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
};

beforeEach(() => { api.get.mockReset(); api.post.mockReset(); });

describe('Badges page', () => {
  it('splits earned from still-to-earn, with progress and earned date', async () => {
    setup({
      progress: [prog(1, 'First Statement', { has_earned: true, current_value: 1, criteria_value: 1, xp_reward: 20 }), prog(2, 'Statement Regular')],
      mine: [{ badge_id: 1, earned_at: '2026-10-10T09:00:00Z' }],
    });
    render(<Badges />);
    const earned = (await screen.findByRole('heading', { name: 'Earned' })).closest('section');
    expect(within(earned).getByText('First Statement')).toBeInTheDocument();
    expect(within(earned).getByText('+20 XP')).toBeInTheDocument();
    expect(within(earned).getByText(/Earned 10 Oct 2026/)).toBeInTheDocument();
    const todo = screen.getByRole('heading', { name: 'Still to earn' }).closest('section');
    expect(within(todo).getByText('Statement Regular')).toBeInTheDocument();
    expect(within(todo).getByText('Upload 3 M-Pesa statements')).toBeInTheDocument();
    expect(within(todo).getByText('1 / 3')).toBeInTheDocument();
    expect(within(todo).queryByText('First Statement')).not.toBeInTheDocument();
  });

  it('the progress bar is as wide as the progress, and never wider than the bar', async () => {
    setup({ progress: [prog(1, 'Half', { progress_percentage: 50 }), prog(2, 'Over', { progress_percentage: 140 })] });
    render(<Badges />);
    await screen.findByText('Half');
    const width = (name) => screen.getByText(name).closest('.badge-card').querySelector('.badge-progress-fill').style.width;
    expect(width('Half')).toBe('50%');
    expect(width('Over')).toBe('100%');
  });

  it('shows level, XP and progress to next level', async () => {
    setup({ progress: [], xp: { total_xp: 130, level: 2, xp_progress: 30, xp_needed: 100 } });
    render(<Badges />);
    expect(await screen.findByText('Level 2')).toBeInTheDocument();
    expect(screen.getByText('130 XP')).toBeInTheDocument();
    expect(screen.getByText('30 / 100 XP to the next level')).toBeInTheDocument();
  });

  it('checks for new badges before reading, and announces them', async () => {
    const order = [];
    setup({ progress: [], check: 2 });
    api.post.mockImplementation(() => { order.push('post'); return Promise.resolve({ data: { data: { total_new_badges: 2 } } }); });
    const get = api.get.getMockImplementation();
    api.get.mockImplementation((u) => { order.push(u); return get(u); });
    render(<Badges />);
    expect(await screen.findByText('You just earned 2 new badges!')).toBeInTheDocument();
    expect(order[0]).toBe('post');
  });

  it('empty states: nothing earned, everything earned', async () => {
    setup({ progress: [prog(1, 'A')] });
    const { unmount } = render(<Badges />);
    expect(await screen.findByText(/No badges earned yet/)).toBeInTheDocument();
    unmount();
    setup({ progress: [prog(1, 'A', { has_earned: true })] });
    render(<Badges />);
    expect(await screen.findByText(/You have earned every badge/)).toBeInTheDocument();
  });

  it('a failed badge check still shows the badges; a failed load shows a plain message', async () => {
    setup({ progress: [prog(1, 'A')], fail: { check: true } });
    const { unmount } = render(<Badges />);
    expect(await screen.findByText('A')).toBeInTheDocument();
    unmount();
    setup({ progress: [], fail: { '/badges/my-progress': true } });
    render(<Badges />);
    expect(await screen.findByText('We could not load your badges right now.')).toBeInTheDocument();
  });

  it('leaderboard marks you; a leaderboard failure does not hide the badges', async () => {
    setup({ progress: [prog(1, 'A')], leaderboard: [{ id: 9, name: 'Zed', badge_count: 3, xp_total: 200 }, { id: 5, name: 'Me', badge_count: 1, xp_total: 20 }] });
    const { unmount } = render(<Badges />);
    const lb = (await screen.findByRole('heading', { name: 'Top badge earners' })).closest('section');
    await waitFor(() => expect(within(lb).getByText('Zed')).toBeInTheDocument());
    expect(within(lb).getByText('You')).toBeInTheDocument();
    unmount();
    setup({ progress: [prog(1, 'A')], fail: { '/badges/leaderboard': true } });
    render(<Badges />);
    expect(await screen.findByText('A')).toBeInTheDocument();
    expect(await screen.findByText(/No leaderboard data/)).toBeInTheDocument();
  });

  it('never mentions goals, budgets or spending', async () => {
    setup({ progress: [prog(1, 'A')] });
    render(<Badges />);
    await screen.findByText('A');
    expect(document.body.textContent).not.toMatch(/goal|budget|invest(or)?\b.*buy/i);
  });
});
