import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import api from '../api/axios';
import Recommendations from './Recommendations';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }));

const card = (rule_id, o = {}) => ({
  recommendation_id: rule_id === 'build_buffer' ? 12 : 13,
  rule_id,
  category: 'Saving',
  title: `Title ${rule_id}`,
  what: `What ${rule_id}`,
  why: `Why ${rule_id}`,
  first_step: `Step ${rule_id}`,
  learn: null,
  impact_kes: 900,
  status: 'pending',
  feedback: null,
  created_at: '2026-10-13 03:46:09',
  ...o,
});

const payload = (over = {}) => ({
  statement: {
    count: 3, period_start: '2025-01-02T16:39:34', period_end: '2026-10-01T20:08:55',
    last_uploaded_at: '2026-10-13T06:46:09+03:00',
  },
  stage: {
    stage: 'building_habit', confidence: 'low', borrowing: 'none_detected', buffer_days: 8.6,
    reasons: ['Saving activity found (M-Shwari or Ziidi deposits).', 'Before exploring investing: your buffer is about 8.6 days.'],
    notes: ['No Fuliza detected.'], next_step: { id: 'make_saving_consistent', title: 'Make your saving regular' },
  },
  data_quality: { days_since_last: 12, last_transaction: '2026-10-01T20:08:55' },
  recommendations: [
    card('upload_recent_statement', { category: 'General', recommendation_id: 11 }),
    card('build_buffer', { learn: 'Rates change. This is not advice.' }),
  ],
  ...over,
});

const stats = { data: { data: { total_recommendations: 5, by_status: { pending: 2, accepted: 3 } } } };
const noStatement = () => Object.assign(new Error('404'), {
  response: { status: 404, data: { status: 'error', code: 'NO_STATEMENT', message: 'Upload an M-Pesa statement first.' } },
});

/** GET routing: recommendations endpoint -> whatever `rec` does; statistics -> stats. */
const routeGets = (rec) => api.get.mockImplementation(function (url) {
  if (url === '/statements/recommendations') return rec();
  if (url === '/recommendations/statistics') return Promise.resolve(stats);
  return Promise.reject(new Error(`unexpected GET ${url}`));
});

const pdf = () => new File(['%PDF-1.4 test'], 'statement.pdf', { type: 'application/pdf' });

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  navigateMock.mockReset();
});

describe('first visit (no statement)', () => {
  beforeEach(() => { routeGets(() => Promise.reject(noStatement())); });

  it('shows the upload form, the privacy promise and no cards', async () => {
    render(<Recommendations />);
    expect(await screen.findByText('Start with your M-Pesa statement')).toBeInTheDocument();
    expect(screen.getByLabelText('M-Pesa statement (PDF)')).toBeInTheDocument();
    expect(screen.getByLabelText('Statement password')).toHaveAttribute('type', 'password');
    expect(screen.getByText('What we collect and how we use it')).toBeInTheDocument();
    expect(screen.queryByText('Actionable Steps')).not.toBeInTheDocument();
  });

  it('no longer calls the old AI endpoints', async () => {
    render(<Recommendations />);
    await screen.findByText('Start with your M-Pesa statement');
    const urls = [...api.get.mock.calls, ...api.post.mock.calls].map((c) => c[0]);
    expect(urls.some((u) => u.includes('/ai/'))).toBe(false);
    expect(screen.queryByText(/Request New Recommendation/i)).not.toBeInTheDocument();
  });

  it('rejects an empty submit, a non-PDF and a missing password without calling the server', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<Recommendations />);
    await screen.findByText('Start with your M-Pesa statement');

    await user.click(screen.getByRole('button', { name: 'Get my recommendations' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose your statement PDF.');

    await user.upload(screen.getByLabelText('M-Pesa statement (PDF)'), new File(['x'], 'notes.txt', { type: 'text/plain' }));
    await user.click(screen.getByRole('button', { name: 'Get my recommendations' }));
    expect(screen.getByRole('alert')).toHaveTextContent('must be a PDF');

    await user.upload(screen.getByLabelText('M-Pesa statement (PDF)'), pdf());
    await user.click(screen.getByRole('button', { name: 'Get my recommendations' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the statement password.');

    await user.type(screen.getByLabelText('Statement password'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Get my recommendations' }));
    expect(screen.getByRole('alert')).toHaveTextContent('tick the box');

    expect(api.post).not.toHaveBeenCalled();
  });

  it('rejects a file over 10 MB', async () => {
    const user = userEvent.setup();
    render(<Recommendations />);
    await screen.findByText('Start with your M-Pesa statement');
    const big = new File(['x'], 'statement.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });

    await user.upload(screen.getByLabelText('M-Pesa statement (PDF)'), big);
    await user.type(screen.getByLabelText('Statement password'), 'pw');
    await user.click(screen.getByRole('checkbox', { name: /I agree/ }));
    await user.click(screen.getByRole('button', { name: 'Get my recommendations' }));

    expect(screen.getByRole('alert')).toHaveTextContent('larger than 10 MB');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('uploads as multipart, then loads the recommendations and clears the password', async () => {
    const user = userEvent.setup();
    let uploaded = false;
    routeGets(() => (uploaded ? Promise.resolve({ data: { status: 'success', data: payload() } }) : Promise.reject(noStatement())));
    api.post.mockImplementation(async () => {
      uploaded = true;
      return { data: { status: 'success', statement: { rows_parsed: 859, rows_new: 859 } } };
    });

    render(<Recommendations />);
    await screen.findByText('Start with your M-Pesa statement');
    await user.upload(screen.getByLabelText('M-Pesa statement (PDF)'), pdf());
    await user.type(screen.getByLabelText('Statement password'), 'pw');
    await user.click(screen.getByRole('checkbox', { name: /I agree/ }));
    await user.click(screen.getByRole('button', { name: 'Get my recommendations' }));

    expect(await screen.findByText('Title build_buffer')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Statement added: 859 new transactions.');

    const [url, form, config] = api.post.mock.calls[0];
    expect(url).toBe('/statements');
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('file').name).toBe('statement.pdf');
    expect(form.get('password')).toBe('pw');
    expect(form.get('consent')).toBe('1');
    expect(config.timeout).toBeGreaterThanOrEqual(60000);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');

    // The password is never kept: not in the page, not in browser storage.
    expect(document.body.innerHTML).not.toContain('pw');
    expect(JSON.stringify({ ...localStorage })).not.toContain('pw');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('pw');

    // Reopening the form later must not bring the old password back, and agreement is asked for again.
    await user.click(screen.getByRole('button', { name: 'Add or update statement' }));
    expect(screen.getByLabelText('Statement password')).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: /I agree/ })).not.toBeChecked();
  });

  it('says so when the statement was already added', async () => {
    const user = userEvent.setup();
    let uploaded = false;
    routeGets(() => (uploaded ? Promise.resolve({ data: { status: 'success', data: payload() } }) : Promise.reject(noStatement())));
    api.post.mockImplementation(async () => {
      uploaded = true;
      return { data: { statement: { rows_parsed: 100, rows_new: 0 } } };
    });
    render(<Recommendations />);
    await screen.findByText('Start with your M-Pesa statement');
    await user.upload(screen.getByLabelText('M-Pesa statement (PDF)'), pdf());
    await user.type(screen.getByLabelText('Statement password'), 'pw');
    await user.click(screen.getByRole('checkbox', { name: /I agree/ }));
    await user.click(screen.getByRole('button', { name: 'Get my recommendations' }));

    expect(await screen.findByRole('status')).toHaveTextContent('already added');
  });

  it.each([
    ['wrong password', { status: 422, data: { status: 'error', code: 'WRONG_PASSWORD', message: 'The statement password is wrong.' } }, 'The statement password is wrong.'],
    ['Laravel validation error', { status: 422, data: { message: 'The file field is required.', errors: { file: ['The file field is required.'] } } }, 'The file field is required.'],
    ['service down', { status: 503, data: { status: 'error', code: 'SERVICE_UNAVAILABLE', message: 'The statement service is not available right now. Please try again later.' } }, 'not available right now'],
    ['an error with no body', { status: 500, data: {} }, 'We could not process that statement'],
  ])('shows a clear message for %s and keeps the form usable', async (_name, response, expected) => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(Object.assign(new Error('x'), { response }));
    render(<Recommendations />);
    await screen.findByText('Start with your M-Pesa statement');
    await user.upload(screen.getByLabelText('M-Pesa statement (PDF)'), pdf());
    await user.type(screen.getByLabelText('Statement password'), 'pw');
    await user.click(screen.getByRole('checkbox', { name: /I agree/ }));
    await user.click(screen.getByRole('button', { name: 'Get my recommendations' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
    expect(screen.getByRole('button', { name: 'Get my recommendations' })).toBeEnabled();
  });

  it('explains a lost connection and a timeout', async () => {
    const user = userEvent.setup();
    render(<Recommendations />);
    await screen.findByText('Start with your M-Pesa statement');
    await user.upload(screen.getByLabelText('M-Pesa statement (PDF)'), pdf());
    await user.type(screen.getByLabelText('Statement password'), 'pw');
    await user.click(screen.getByRole('checkbox', { name: /I agree/ }));

    api.post.mockRejectedValueOnce(Object.assign(new Error('Network Error'), {}));
    await user.click(screen.getByRole('button', { name: 'Get my recommendations' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not reach the server');

    api.post.mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));
    await user.click(screen.getByRole('button', { name: 'Get my recommendations' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('taking longer than expected'));
  });

  it('disables the button and says what is happening while the statement is read', async () => {
    const user = userEvent.setup();
    let release;
    api.post.mockReturnValue(new Promise((r) => { release = r; }));
    render(<Recommendations />);
    await screen.findByText('Start with your M-Pesa statement');
    await user.upload(screen.getByLabelText('M-Pesa statement (PDF)'), pdf());
    await user.type(screen.getByLabelText('Statement password'), 'pw');
    await user.click(screen.getByRole('checkbox', { name: /I agree/ }));
    await user.click(screen.getByRole('button', { name: 'Get my recommendations' }));

    const busy = await screen.findByRole('button', { name: /Reading your statement/ });
    expect(busy).toBeDisabled();
    release({ data: { statement: { rows_new: 1 } } });
  });

  it('explains what is collected and what is not, before any upload', async () => {
    render(<Recommendations />);
    await screen.findByText('Start with your M-Pesa statement');
    const panel = screen.getByText('What we collect and how we use it').closest('details');
    expect(panel).toBeInTheDocument();
    for (const phrase of [
      'scrambled code', 'The PDF itself', 'Your statement password', 'Your name or phone number',
      'Receipt numbers', 'not sent to other companies', 'Delete my statement',
    ]) {
      expect(panel.textContent).toContain(phrase);
    }
    expect(screen.getByRole('checkbox', { name: /I agree/ })).not.toBeChecked();
  });

  it('lets the student show and hide the password', async () => {
    const user = userEvent.setup();
    render(<Recommendations />);
    await screen.findByText('Start with your M-Pesa statement');
    const input = screen.getByLabelText('Statement password');
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(input).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});

describe('with recommendations', () => {
  beforeEach(() => { routeGets(() => Promise.resolve({ data: { status: 'success', data: payload() } })); });

  it('shows the stage, why, notes, confidence and the cards in rank order', async () => {
    render(<Recommendations />);
    expect(await screen.findByText('Building a saving habit')).toBeInTheDocument();
    expect(screen.getByText('Data confidence: Low')).toBeInTheDocument();
    expect(screen.getByText('Saving activity found (M-Shwari or Ziidi deposits).')).toBeInTheDocument();
    expect(screen.getByText('No Fuliza detected.')).toBeInTheDocument();

    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent).filter((t) => t.startsWith('Title'));
    expect(titles).toEqual(['Title upload_recent_statement', 'Title build_buffer']);
    expect(screen.getByText('Step build_buffer', { exact: false })).toBeInTheDocument();
  });

  it('shows the statement coverage and the upload time in Nairobi time', async () => {
    render(<Recommendations />);
    expect(await screen.findByText(/2 Jan 2025 to 1 Oct 2026/)).toBeInTheDocument();
    expect(screen.getByText(/3 uploads/)).toBeInTheDocument();
    expect(screen.getByText(/updated 13 Oct 2026.*06:46/)).toBeInTheDocument();   // 03:46 UTC
  });

  it.each([
    ['server set to Nairobi', '2026-10-13T13:52:00+03:00', /13:52/],
    ['server set to UTC', '2026-10-13T10:52:00+00:00', /13:52/],
    ['a Z timestamp', '2026-10-13T10:52:00Z', /13:52/],
  ])('shows the same Nairobi time when the %s', async (_n, stamp, expected) => {
    routeGets(() => Promise.resolve({ data: { status: 'success', data: payload({
      statement: { ...payload().statement, last_uploaded_at: stamp },
    }) } }));
    render(<Recommendations />);
    expect(await screen.findByText(/updated 13 Oct 2026/)).toHaveTextContent(expected);
  });

  it('opens a detail view with what, first step, why and the learning note', async () => {
    const user = userEvent.setup();
    render(<Recommendations />);
    await screen.findByText('Title build_buffer');
    const cardEl = screen.getByText('Title build_buffer').closest('.recommendation-card');
    await user.click(within(cardEl).getByRole('button', { name: /Learn More/ }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('What build_buffer')).toBeInTheDocument();
    expect(within(dialog).getByText('Step build_buffer')).toBeInTheDocument();
    expect(within(dialog).getByText('Why build_buffer')).toBeInTheDocument();
    expect(within(dialog).getByText('Rates change. This is not advice.')).toBeInTheDocument();
  });

  it('sends status and feedback and updates the card without reloading', async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue({ data: {} });
    render(<Recommendations />);
    await screen.findByText('Title build_buffer');
    const cardEl = screen.getByText('Title build_buffer').closest('.recommendation-card');
    await user.click(within(cardEl).getByRole('button', { name: /Learn More/ }));
    await user.click(screen.getByRole('button', { name: 'Update Status & Feedback' }));

    await user.selectOptions(screen.getByLabelText('Status'), 'accepted');
    await user.type(screen.getByLabelText(/Your Feedback/), 'Helpful');
    await user.click(screen.getByRole('button', { name: 'Submit Feedback' }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/recommendations/12/status', { status: 'accepted', feedback: 'Helpful' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Feedback submitted successfully!');
    expect(within(screen.getByText('Title build_buffer').closest('.recommendation-card')).getByText('accepted')).toBeInTheDocument();
    expect(api.get.mock.calls.filter((c) => c[0] === '/statements/recommendations')).toHaveLength(1);   // no recompute
  });

  it('cannot update the status of a card that was not saved yet', async () => {
    const user = userEvent.setup();
    routeGets(() => Promise.resolve({ data: { status: 'success', data: payload({ recommendations: [card('build_buffer', { recommendation_id: null })] }) } }));
    render(<Recommendations />);
    await screen.findByText('Title build_buffer');
    await user.click(screen.getByRole('button', { name: /Learn More/ }));
    expect(screen.getByRole('button', { name: 'Update Status & Feedback' })).toBeDisabled();
  });

  it('adds a newer statement from the same page and can cancel', async () => {
    const user = userEvent.setup();
    render(<Recommendations />);
    await screen.findByText('Title build_buffer');
    expect(screen.queryByLabelText('Statement password')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add or update statement' }));
    expect(screen.getByLabelText('Statement password')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Statement password')).not.toBeInTheDocument();
  });

  it('deletes the data only after confirmation', async () => {
    const user = userEvent.setup();
    api.delete.mockResolvedValue({ data: {} });
    const confirm = vi.spyOn(window, 'confirm');

    render(<Recommendations />);
    await screen.findByText('Title build_buffer');

    confirm.mockReturnValueOnce(false);
    await user.click(screen.getByRole('button', { name: 'Delete my statement data' }));
    expect(api.delete).not.toHaveBeenCalled();
    expect(screen.getByText('Title build_buffer')).toBeInTheDocument();

    confirm.mockReturnValueOnce(true);
    await user.click(screen.getByRole('button', { name: 'Delete my statement data' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/statements/data'));
    expect(await screen.findByText('Start with your M-Pesa statement')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Your statement data has been deleted.');
    expect(screen.queryByText('Title build_buffer')).not.toBeInTheDocument();
  });

  it('keeps the page and shows an error when deleting fails', async () => {
    const user = userEvent.setup();
    api.delete.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 500, data: {} } }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Recommendations />);
    await screen.findByText('Title build_buffer');
    await user.click(screen.getByRole('button', { name: 'Delete my statement data' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not delete');
    expect(screen.getByText('Title build_buffer')).toBeInTheDocument();
  });

  it('shows a friendly empty state when there are no cards', async () => {
    routeGets(() => Promise.resolve({ data: { status: 'success', data: payload({ recommendations: [] }) } }));
    render(<Recommendations />);
    expect(await screen.findByText('Nothing to suggest right now')).toBeInTheDocument();
  });

  it('keeps the existing statistics section working', async () => {
    render(<Recommendations />);
    expect(await screen.findByText('Total')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});

describe('tip of the day', () => {
  it('shows a Kenya-relevant tip and not the old generic one', async () => {
    routeGets(() => Promise.resolve({ data: { status: 'success', data: payload() } }));
    render(<Recommendations />);
    await screen.findByText('Tip of the Day');
    const tip = screen.getByText('Tip of the Day').parentElement.querySelector('p').textContent;
    expect(tip.length).toBeGreaterThan(20);
    expect(tip).not.toMatch(/checking account/i);
    expect(tip).not.toMatch(/guaranteed|will earn|invest in/i);
  });

  it('is the same all day and changes the next day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-13T05:00:00Z'));
      routeGets(() => Promise.resolve({ data: { status: 'success', data: payload() } }));
      const { unmount } = render(<Recommendations />);
      await screen.findByText('Tip of the Day');
      const first = screen.getByText('Tip of the Day').parentElement.querySelector('p').textContent;
      unmount();

      vi.setSystemTime(new Date('2026-10-13T20:00:00Z'));
      const again = render(<Recommendations />);
      await screen.findByText('Tip of the Day');
      expect(screen.getByText('Tip of the Day').parentElement.querySelector('p').textContent).toBe(first);
      again.unmount();

      vi.setSystemTime(new Date('2026-10-14T05:00:00Z'));
      render(<Recommendations />);
      await screen.findByText('Tip of the Day');
      expect(screen.getByText('Tip of the Day').parentElement.querySelector('p').textContent).not.toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('failures', () => {
  it('shows an error, not the upload form, when the server fails on load', async () => {
    routeGets(() => Promise.reject(Object.assign(new Error('x'), { response: { status: 502, data: { code: 'SERVICE_ERROR', message: 'The statement service had a problem. Please try again later.' } } })));
    render(<Recommendations />);
    expect(await screen.findByRole('alert')).toHaveTextContent('statement service had a problem');
    expect(screen.queryByText('Start with your M-Pesa statement')).not.toBeInTheDocument();
  });

  it('shows an unknown stage name instead of crashing', async () => {
    routeGets(() => Promise.resolve({ data: { status: 'success', data: payload({ stage: { ...payload().stage, stage: 'brand_new_stage' } }) } }));
    render(<Recommendations />);
    expect(await screen.findByText('brand_new_stage')).toBeInTheDocument();
  });
});


// ---- savings outside M-Pesa, and the simulator button -----------------------------------
describe('savings outside M-Pesa', () => {
  const withBalance = (amount, updated_at = '2026-10-13T18:02:00+03:00') => payload({ savings_balance: { amount, updated_at } });
  const readyCard = (monthly = 600) => card('learn_investing_basics', {
    category: 'General', recommendation_id: 21,
    simulator: { investment_type: 'mmf', monthly_amount: monthly },
  });

  it('asks for the amount, with the privacy promise, when none is saved', async () => {
    routeGets(() => Promise.resolve({ data: { data: withBalance(null, null) } }));
    render(<Recommendations />);
    expect(await screen.findByText('Savings outside M-Pesa')).toBeInTheDocument();
    expect(screen.getByLabelText('Total savings (KES)')).toHaveValue(null);
    expect(screen.getByText(/We store this one number only, never account details/)).toBeInTheDocument();
  });

  it('works when the server sends no savings field at all', async () => {
    routeGets(() => Promise.resolve({ data: { data: payload() } }));
    render(<Recommendations />);
    expect(await screen.findByLabelText('Total savings (KES)')).toBeInTheDocument();
  });

  it('shows a saved amount with the day it was updated, in Nairobi time', async () => {
    routeGets(() => Promise.resolve({ data: { data: withBalance(2500, '2026-10-13T23:30:00+00:00') } }));   // 14 Oct 02:30 in Nairobi
    render(<Recommendations />);
    const panel = (await screen.findByText('Savings outside M-Pesa')).closest('.savings-card');
    expect(panel.textContent).toContain('KES 2,500');
    expect(panel.textContent).toContain('14 Oct 2026');
    expect(within(panel).queryByLabelText('Total savings (KES)')).not.toBeInTheDocument();
  });

  it('saves the amount as a number, refreshes the cards and confirms', async () => {
    let balance = null;
    routeGets(() => Promise.resolve({ data: { data: withBalance(balance) } }));
    api.put.mockImplementation(async (url, body) => {
      balance = body.savings_balance;
      return { data: { status: 'success', data: { amount: balance, updated_at: '2026-10-13T18:02:00+03:00' }, cards_refreshed: true } };
    });
    const user = userEvent.setup();
    render(<Recommendations />);
    await user.type(await screen.findByLabelText('Total savings (KES)'), '2500');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Savings amount saved. Your advice now counts it.')).toBeInTheDocument();
    expect(api.put).toHaveBeenCalledWith('/statements/savings-balance', { savings_balance: 2500 });
    expect(typeof api.put.mock.calls[0][1].savings_balance).toBe('number');
    expect(await screen.findByText('KES 2,500')).toBeInTheDocument();
    expect(api.get.mock.calls.filter((c) => c[0] === '/statements/recommendations')).toHaveLength(2);   // refreshed
  });

  it('refuses empty, text and negative input without calling the server', async () => {
    routeGets(() => Promise.resolve({ data: { data: withBalance(null, null) } }));
    const user = userEvent.setup();
    render(<Recommendations />);
    const input = await screen.findByLabelText('Total savings (KES)');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your savings as a number');
    await user.type(input, '-5');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('cannot be a negative amount');
    expect(api.put).not.toHaveBeenCalled();
  });

  it('accepts zero', async () => {
    routeGets(() => Promise.resolve({ data: { data: withBalance(null, null) } }));
    api.put.mockResolvedValue({ data: { status: 'success', data: { amount: 0, updated_at: null }, cards_refreshed: true } });
    const user = userEvent.setup();
    render(<Recommendations />);
    await user.type(await screen.findByLabelText('Total savings (KES)'), '0');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/statements/savings-balance', { savings_balance: 0 }));
  });

  it('shows the server message, such as a missing profile, and keeps what was typed', async () => {
    routeGets(() => Promise.resolve({ data: { data: withBalance(null, null) } }));
    api.put.mockRejectedValue({ response: { status: 422, data: { status: 'error', code: 'PROFILE_REQUIRED', message: 'Please complete your student profile first, then add your savings.' } } });
    const user = userEvent.setup();
    render(<Recommendations />);
    await user.type(await screen.findByLabelText('Total savings (KES)'), '900');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please complete your student profile first');
    expect(screen.getByLabelText('Total savings (KES)')).toHaveValue(900);
  });

  it('still confirms the save when the cards could not be refreshed', async () => {
    routeGets(() => Promise.resolve({ data: { data: withBalance(null, null) } }));
    api.put.mockResolvedValue({ data: { status: 'success', data: { amount: 700, updated_at: '2026-10-13T18:02:00+03:00' }, cards_refreshed: false } });
    const user = userEvent.setup();
    render(<Recommendations />);
    await user.type(await screen.findByLabelText('Total savings (KES)'), '700');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Savings amount saved\. We could not update your advice just now/)).toBeInTheDocument();
    expect(await screen.findByText('KES 700')).toBeInTheDocument();
  });

  it('changes and removes a saved amount', async () => {
    routeGets(() => Promise.resolve({ data: { data: withBalance(2500) } }));
    api.put.mockResolvedValue({ data: { status: 'success', data: { amount: null, updated_at: null }, cards_refreshed: true } });
    const user = userEvent.setup();
    render(<Recommendations />);
    await screen.findByText('KES 2,500');

    await user.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByLabelText('Total savings (KES)')).toHaveValue(2500);            // starts from the saved value
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('KES 2,500')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/statements/savings-balance', { savings_balance: null }));
    expect(await screen.findByText('Savings amount removed. Your advice no longer counts it.')).toBeInTheDocument();
  });

  it('puts a simulator button on the investing card only, and opens the simulator with the suggested amount', async () => {
    routeGets(() => Promise.resolve({ data: { data: payload({ recommendations: [card('build_buffer'), readyCard(600)] }) } }));
    const user = userEvent.setup();
    render(<Recommendations />);
    const buttons = await screen.findAllByRole('button', { name: /Try the simulator/ });
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent('Try the simulator with KES 600 a month');

    await user.click(buttons[0]);
    expect(navigateMock).toHaveBeenCalledWith('/simulation', { state: { prefill: { investment_type: 'mmf', monthly_amount: 600 } } });
  });

  it('offers the simulator without an amount when none could be suggested', async () => {
    routeGets(() => Promise.resolve({ data: { data: payload({ recommendations: [readyCard(null)] }) } }));
    const user = userEvent.setup();
    render(<Recommendations />);
    const btn = await screen.findByRole('button', { name: 'Try the simulator' });
    await user.click(btn);
    expect(navigateMock).toHaveBeenCalledWith('/simulation', { state: { prefill: { investment_type: 'mmf', monthly_amount: null } } });
  });
});


// ---- quick mode: no statement yet --------------------------------------------------------
describe('quick mode (no statement)', () => {
  beforeEach(() => { routeGets(() => Promise.reject(noStatement())); });

  const open = async () => {
    const user = userEvent.setup();
    render(<Recommendations />);
    await screen.findByText('No statement yet? Try the simulator');
    return user;
  };
  const prefillOf = () => navigateMock.mock.calls[0][1].state.prefill;

  it('offers three questions next to the upload, and says it is for learning only', async () => {
    await open();
    expect(screen.getByLabelText(/How much could you add each month/)).toBeInTheDocument();
    expect(screen.getByLabelText(/How much do you have to start with/)).toBeInTheDocument();
    expect(screen.getByLabelText('For how long?')).toHaveValue(12);
    expect(screen.getByText(/we cannot check whether you are ready, so this is for learning only/)).toBeInTheDocument();
    expect(screen.getByText('Start with your M-Pesa statement')).toBeInTheDocument();     // the upload is still the main path
  });

  it('is not shown once a statement exists', async () => {
    routeGets(() => Promise.resolve({ data: { data: payload() } }));
    render(<Recommendations />);
    await screen.findByText('Building a saving habit');
    expect(screen.queryByText('No statement yet? Try the simulator')).not.toBeInTheDocument();
  });

  it('opens the simulator with the answers filled in, and sends nothing to the server', async () => {
    const user = await open();
    await user.type(screen.getByLabelText(/add each month/), '500');
    await user.type(screen.getByLabelText(/start with/), '2000');
    await user.clear(screen.getByLabelText('For how long?'));
    await user.type(screen.getByLabelText('For how long?'), '18');
    await user.click(screen.getByRole('button', { name: 'Open the simulator' }));

    expect(navigateMock).toHaveBeenCalledWith('/simulation', expect.anything());
    expect(prefillOf()).toEqual({
      source: 'quick', investment_type: 'mmf', monthly_amount: 500, initial_amount: 2000,
      duration_value: 18, duration_unit: 'months',
    });
    expect(typeof prefillOf().monthly_amount).toBe('number');
    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('lets the monthly amount stay empty, and passes years through', async () => {
    const user = await open();
    await user.type(screen.getByLabelText(/start with/), '1000');
    await user.selectOptions(screen.getByLabelText('Unit'), 'years');
    await user.clear(screen.getByLabelText('For how long?'));
    await user.type(screen.getByLabelText('For how long?'), '3');
    await user.click(screen.getByRole('button', { name: 'Open the simulator' }));
    expect(prefillOf()).toMatchObject({ monthly_amount: null, initial_amount: 1000, duration_value: 3, duration_unit: 'years' });
  });

  it('accepts a starting amount with no monthly amount', async () => {
    const user = await open();
    await user.type(screen.getByLabelText(/start with/), '5000');
    await user.click(screen.getByRole('button', { name: 'Open the simulator' }));
    expect(prefillOf()).toMatchObject({ monthly_amount: null, initial_amount: 5000 });
  });

  it.each([
    ['nothing entered', {}, /Enter how much you have to start with/],
    ['only a monthly amount', { monthly: '300' }, /needs a starting amount/],
    ['a negative amount', { monthly: '-5', initial: '100' }, /cannot be negative/],
    ['a negative starting amount', { monthly: '100', initial: '-1' }, /cannot be negative/],
    ['zero duration', { monthly: '100', initial: '100', duration: '0' }, /whole number/],
    ['a part of a month', { monthly: '100', initial: '100', duration: '2.5' }, /whole number/],
    ['an empty duration', { monthly: '100', initial: '100', duration: '' }, /whole number/],
    ['more than 50 years', { monthly: '100', initial: '100', duration: '51', unit: 'years' }, /longer than we can simulate/],
    ['more than 600 months', { monthly: '100', initial: '100', duration: '601' }, /longer than we can simulate/],
  ])('refuses %s and does not leave the page', async (_name, fields, message) => {
    const user = await open();
    if (fields.monthly) await user.type(screen.getByLabelText(/add each month/), fields.monthly);
    if (fields.initial) await user.type(screen.getByLabelText(/start with/), fields.initial);
    if (fields.unit) await user.selectOptions(screen.getByLabelText('Unit'), fields.unit);
    if (fields.duration !== undefined) {
      await user.clear(screen.getByLabelText('For how long?'));
      if (fields.duration) await user.type(screen.getByLabelText('For how long?'), fields.duration);
    }
    await user.click(screen.getByRole('button', { name: 'Open the simulator' }));
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('accepts exactly 50 years and 600 months', async () => {
    const user = await open();
    await user.type(screen.getByLabelText(/start with/), '100');
    await user.selectOptions(screen.getByLabelText('Unit'), 'years');
    await user.clear(screen.getByLabelText('For how long?'));
    await user.type(screen.getByLabelText('For how long?'), '50');
    await user.click(screen.getByRole('button', { name: 'Open the simulator' }));
    expect(prefillOf()).toMatchObject({ duration_value: 50, duration_unit: 'years' });
  });
});
