import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import api from '../api/axios';
import Simulations from './Simulations';
import types from '../fixtures/types.json';
import mmf from '../fixtures/mmf_preview.json';
import stock from '../fixtures/stock_preview.json';

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
let routerState = null;
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useLocation: () => ({ state: routerState }) }));
vi.mock('recharts', () => {
  const Box = ({ children }) => <div data-testid="chart">{children}</div>;
  const Nil = () => null;
  return {
    ResponsiveContainer: Box, LineChart: Box, BarChart: Box, PieChart: Box,
    Line: Nil, Bar: Nil, Pie: Nil, Cell: Nil, XAxis: Nil, YAxis: Nil, CartesianGrid: Nil, Tooltip: Nil, Legend: Nil,
  };
});

const savedOld = {
  simulation_id: 'SIM_OLD', investment_type: 'mmf', investment_type_name: 'Money Market Fund', risk_level: 'low',
  created_at: '2026-09-01T10:00:00Z', amount_invested: 1000, formatted_duration: '12 months', monthly_topup: 0,
  projected_final_value: 1100, total_growth: 100, roi_percentage: 10, model_parameters: { average_annual_return: 10 },
};
const savedNew = { ...savedOld, simulation_id: 'SIM_NEW', model_parameters: mmf.model_parameters };

const wire = ({ saved = [] } = {}) => api.get.mockImplementation(async (url) => {
  if (url === '/investments/types') return { data: { data: { investment_types: types } } };
  if (url === '/investments') return { data: { data: { data: saved } } };
  if (url === '/investments/my-statistics') return { data: { data: { total_simulations: 0 } } };
  throw new Error(`unexpected GET ${url}`);
});

const text = () => document.body.textContent;
const noJunk = () => { for (const bad of ['NaN', 'undefined', 'null', 'Infinity']) expect(text()).not.toContain(bad); };

beforeEach(() => {
  routerState = null;
  for (const fn of Object.values(api)) fn.mockReset();
  window.scrollTo = vi.fn();
});

describe('Explore tab', () => {
  it('shows the disclaimer, after-tax returns and honest data dates', async () => {
    wire();
    render(<Simulations />);
    expect(await screen.findByText('Money Market Fund')).toBeInTheDocument();

    expect(screen.getByRole('note')).toHaveTextContent('This is a simulation, not advice.');
    const mmfCard = screen.getByText('Money Market Fund').closest('.investment-type-card');
    expect(mmfCard.textContent).toContain('After 15% tax: 8.5%');
    const bondCard = screen.getByText('Government Bond').closest('.investment-type-card');
    expect(bondCard.textContent).toContain('After 10% tax');
    expect(bondCard.textContent).toContain('Treasury bond auctions');
    const tbillCard = screen.getByText('Treasury Bill').closest('.investment-type-card');
    expect(tbillCard.textContent).toContain('28 May 2026');
    noJunk();
  });

  it('marks estimates and does not draw a range that has no data (stocks)', async () => {
    wire();
    render(<Simulations />);
    const stockCard = (await screen.findByText('Stock Market')).closest('.investment-type-card');
    expect(within(stockCard).getByText('Estimate')).toBeInTheDocument();
    expect(stockCard.textContent).toContain('Tax on gains is not included');
    expect(stockCard.querySelector('.type-range')).toBeNull();
    const tbillCard = screen.getByText('Treasury Bill').closest('.investment-type-card');
    expect(within(tbillCard).queryByText('Estimate')).not.toBeInTheDocument();
    expect(tbillCard.querySelector('.type-range')).not.toBeNull();
  });
});

describe('Create a simulation', () => {
  const fill = async (user, { type = 'mmf', amount = '10000', duration = '12', topup = '500', target = '50000' } = {}) => {
    await user.click(within((await screen.findByText(types.find((t) => t.type === type).name)).closest('.investment-type-card')).getByRole('button', { name: /Start Simulation/ }));
    await user.type(screen.getByLabelText(/Initial Investment/), amount);
    await user.type(screen.getByLabelText(/^Duration/), duration);
    if (topup) await user.type(screen.getByLabelText(/Monthly Contribution/), topup);
    if (target) await user.type(screen.getByLabelText(/Target Goal/), target);
    await user.click(screen.getByRole('button', { name: /Preview Simulation/ }));
  };

  it('shows the real engine output: after-tax values, tax taken, yearly return and the goal', async () => {
    wire();
    api.post.mockResolvedValue({ data: { data: mmf } });
    const user = userEvent.setup();
    render(<Simulations />);
    await fill(user);

    expect(await screen.findByText('Final Value (after tax)')).toBeInTheDocument();
    expect(screen.getByText('Total Growth (after tax)')).toBeInTheDocument();
    expect(screen.getByText('Tax taken out').nextSibling.textContent).toContain('206.65');
    expect(screen.getByText('Average growth per year (after tax)').nextSibling.textContent).toBe('8.84%');
    expect(document.querySelector('.assumption-note > p').textContent).toContain('grows about 10% a year before tax');
    expect(screen.getByText(/spread between funds, not a measured/)).toBeInTheDocument();   // source text is shown
    expect(screen.getByText(/still being reviewed/)).toBeInTheDocument();

    expect(screen.getByText(/Bad luck/)).toBeInTheDocument();
    expect(screen.getByText(/Good luck/)).toBeInTheDocument();
    expect(screen.getByText(/In 19 out of 20 futures, you end between/)).toBeInTheDocument();
    expect(screen.getByText(/In almost none of the 5,000 futures/)).toBeInTheDocument();
    expect(screen.getByText('Low risk: small ups and downs.')).toBeInTheDocument();
    expect(screen.queryByText(/Confidence Interval/)).not.toBeInTheDocument();

    // 58 months needed vs 12 chosen: must not say "Goal Achievable!"
    expect(screen.getByText('Reachable, but later than your period')).toBeInTheDocument();
    expect(screen.getByText(/longer than the period you chose/)).toBeInTheDocument();
    noJunk();

    const [url, body] = api.post.mock.calls[0];
    expect(url).toBe('/investments/preview');
    expect(body).toMatchObject({ amount_invested: 10000, duration_value: 12, investment_type: 'mmf', monthly_topup: 500, target_amount: 50000 });
  });

  it('shows a high chance of loss for shares', async () => {
    wire();
    api.post.mockResolvedValue({ data: { data: stock } });
    const user = userEvent.setup();
    render(<Simulations />);
    await fill(user, { type: 'stock', duration: '60', target: '' });
    expect(await screen.findByText(/out of every 100/)).toBeInTheDocument();
    expect(screen.getByText('High risk: the value can drop a lot.')).toBeInTheDocument();
    expect(screen.queryByText('Tax taken out')).not.toBeInTheDocument();      // no tax modelled for shares
    expect(screen.getByText(/PLACEHOLDER/)).toBeInTheDocument();             // the source says plainly it is a stand-in
    noJunk();
  });

  it('copes with an annualised return the engine could not compute', async () => {
    wire();
    const odd = { ...mmf, projections: { ...mmf.projections, annualized_return: null }, goal_analysis: null };
    api.post.mockResolvedValue({ data: { data: odd } });
    const user = userEvent.setup();
    render(<Simulations />);
    await fill(user, { target: '' });
    await screen.findByText('Final Value (after tax)');
    expect(screen.queryByText('Average growth per year (after tax)')).not.toBeInTheDocument();
    noJunk();
  });

  it('shows the server message when the engine rejects the input', async () => {
    wire();
    api.post.mockRejectedValue({ response: { data: { message: 'Failed to preview simulation' } } });
    const user = userEvent.setup();
    render(<Simulations />);
    await fill(user);
    expect(await screen.findByText('Failed to preview simulation')).toBeInTheDocument();
  });
});

describe('Plain language', () => {
  it('explore cards show a short line and keep the long text behind More details', async () => {
    wire();
    render(<Simulations />);
    const card = (await screen.findByText('Money Market Fund')).closest('.investment-type-card');
    expect(card.querySelector('.type-description').textContent).toBe('Easy-access savings that earn steady interest. Good for emergency money.');
    const more = card.querySelector('details.type-more');
    expect(more).not.toBeNull();
    expect(more.open).toBe(false);
    expect(more.querySelector('summary').textContent).toBe('More details');
    expect(more.textContent).toContain('Ideal for emergency funds');          // long description lives inside
    expect(more.textContent).toContain('Where this comes from');
    expect(card.querySelector('.type-description').textContent).not.toContain('Ideal for emergency funds');
    noJunk();
  });

  it('explains the result in one sentence a student can read', async () => {
    wire();
    api.post.mockResolvedValue({ data: { data: mmf } });
    const user = userEvent.setup();
    render(<Simulations />);
    await user.click(within((await screen.findByText('Money Market Fund')).closest('.investment-type-card')).getByRole('button', { name: /Start Simulation/ }));
    await user.type(screen.getByLabelText(/Initial Investment/), '10000');
    await user.type(screen.getByLabelText(/^Duration/), '12');
    await user.type(screen.getByLabelText(/Monthly Contribution/), '500');
    await user.click(screen.getByRole('button', { name: /Preview Simulation/ }));
    const line = (await screen.findByText(/If you put in/)).closest('.plain-summary').textContent;
    expect(line).toContain('KES 10,000 now');
    expect(line).toContain('KES 500 every month');
    expect(line).toContain('for 1 year');
    expect(line).toMatch(/could grow to about KES [\d,]+ after tax, which is KES [\d,]+ more than you put in\./);
    expect(line).not.toMatch(/\.\d\d/);                       // whole shillings, no .00 noise
    noJunk();
  });
});

describe('Opened from a recommendation', () => {
  it('opens the form with the suggested type and monthly amount filled in', async () => {
    routerState = { prefill: { investment_type: 'mmf', monthly_amount: 600 } };
    wire();
    render(<Simulations />);
    expect(await screen.findByLabelText(/Monthly Contribution/)).toHaveValue('600');
    expect(screen.getByLabelText(/Investment Type/)).toHaveValue('mmf');
    expect(screen.getByLabelText(/Initial Investment/)).toHaveValue('');            // the student chooses this
    expect(screen.getByText(/We filled in/).textContent).toContain('KES 600 a month');
    noJunk();
  });

  it('can dismiss the note, and a missing amount fills in only the type', async () => {
    routerState = { prefill: { investment_type: 'tbill', monthly_amount: null } };
    wire();
    render(<Simulations />);
    expect(await screen.findByLabelText(/Investment Type/)).toHaveValue('tbill');
    expect(screen.getByLabelText(/Monthly Contribution/)).toHaveValue('');
    expect(screen.queryByText(/We filled in/)).not.toBeInTheDocument();

  });

  it('dismisses the note on request', async () => {
    routerState = { prefill: { investment_type: 'mmf', monthly_amount: 600 } };
    wire();
    const user = userEvent.setup();
    render(<Simulations />);
    await screen.findByText(/We filled in/);
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/We filled in/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Monthly Contribution/)).toHaveValue('600');         // the value stays
  });

  it('from the quick form: fills in every answer and explains that the buffer could not be checked', async () => {
    routerState = { prefill: { source: 'quick', investment_type: 'mmf', monthly_amount: 500, initial_amount: 2000, duration_value: 3, duration_unit: 'years' } };
    wire();
    render(<Simulations />);
    expect(await screen.findByLabelText(/Initial Investment/)).toHaveValue('2000');
    expect(screen.getByLabelText(/Monthly Contribution/)).toHaveValue('500');
    expect(screen.getByLabelText(/^Duration/)).toHaveValue(3);
    expect(screen.getByLabelText('Unit')).toHaveValue('years');
    expect(screen.getByLabelText(/Investment Type/)).toHaveValue('mmf');
    const note = screen.getByText(/We filled in what you told us/);
    expect(note.textContent).toContain('We have not seen your statement');
    expect(note.textContent).toContain('two weeks of spending');
    expect(note.textContent).not.toContain('from your statement');
    noJunk();
  });

  it('from the quick form with no starting amount, the field stays empty for the student', async () => {
    routerState = { prefill: { source: 'quick', investment_type: 'mmf', monthly_amount: 300, initial_amount: null, duration_value: 12, duration_unit: 'months' } };
    wire();
    render(<Simulations />);
    expect(await screen.findByLabelText(/Initial Investment/)).toHaveValue('');
    expect(screen.getByLabelText(/^Duration/)).toHaveValue(12);
    expect(screen.getByLabelText('Unit')).toHaveValue('months');
  });

  it('opens on the explore tab as before when nothing was passed', async () => {
    wire();
    render(<Simulations />);
    expect(await screen.findByText('Choose Your Investment Path')).toBeInTheDocument();
    expect(screen.queryByText(/We filled in/)).not.toBeInTheDocument();
  });
});

describe('My simulations', () => {
  it('labels only the simulations saved after tax was added', async () => {
    wire({ saved: [savedOld, savedNew] });
    const user = userEvent.setup();
    render(<Simulations />);
    await screen.findByText('Money Market Fund');
    await user.click(screen.getByRole('button', { name: /My Simulations/ }));
    const cards = await screen.findAllByText(/^Final Value/);
    expect(cards.map((c) => c.textContent)).toEqual(['Final Value', 'Final Value (after tax)']);
    noJunk();
  });
});
