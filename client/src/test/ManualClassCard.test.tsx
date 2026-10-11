import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from '@/lib/axios';
import { ManualClassCard } from '@/components/assets/manual-class-card';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), defaults: {} } }));

const holding = { assetClass: 'GOLD', symbol: 'XAU', quantity: 8, unit: 'g', value: 12000000, cost: 10000000, gain: 2000000, gainPct: 20, source: 'manual' };
const lots = [
  { id: 'l1', assetClass: 'GOLD', symbol: 'XAU', date: '2026-01-05T00:00:00.000Z', quantity: 10, totalPaid: 10000000, currency: 'IDR', note: null },
  { id: 'l2', assetClass: 'GOLD', symbol: 'XAU', date: '2026-02-05T00:00:00.000Z', quantity: -2, totalPaid: -2500000, currency: 'IDR', note: null },
];
const setup = (empty = false) => {
  const onChanged = vi.fn();
  render(<ManualClassCard assetClass="GOLD" holding={empty ? undefined : holding} currency="IDR" onChanged={onChanged} />);
  return onChanged;
};

describe('ManualClassCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.get).mockResolvedValue({ data: { data: { lots } } });
    vi.mocked(axios.post).mockResolvedValue({ data: {} });
    vi.mocked(axios.delete).mockResolvedValue({ data: {} });
  });

  it('shows quantity, value, average cost and gain', () => {
    setup();
    const t = document.body.textContent ?? '';
    expect(t).toContain('Gold');
    expect(t).toContain('8 g');
    expect(t).toMatch(/Rp\s?12,000,000/);
    expect(t).toMatch(/Avg Rp\s?1,250,000\/g/);
    expect(t).toMatch(/\+Rp\s?2,000,000/);
  });

  it('shows an empty state without a holding', () => {
    setup(true);
    expect(screen.getByText('No gold yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add purchase/ })).toBeTruthy();
  });

  const fill = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /Add purchase/ }));
    await user.type(screen.getByLabelText('Grams'), '2');
    await user.type(screen.getByLabelText(/Total (paid|received)/), '3000000');
    await user.click(screen.getByRole('radio', { name: 'IDR' }));
  };

  it('posts a purchase', async () => {
    const user = userEvent.setup();
    const onChanged = setup();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/api/assets/lots', {
      assetClass: 'GOLD', symbol: 'XAU', date: expect.stringMatching(/^\d{4}-\d\d-\d\dT/), quantity: 2, totalPaid: 3000000, currency: 'IDR',
    }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('posts a sale with negated numbers', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /Add purchase/ }));
    await user.click(screen.getByRole('radio', { name: 'Sell' }));
    await user.type(screen.getByLabelText('Grams'), '2');
    await user.type(screen.getByLabelText('Total received'), '3000000');
    await user.click(screen.getByRole('radio', { name: 'IDR' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/api/assets/lots', expect.objectContaining({ quantity: -2, totalPaid: -3000000 })));
  });

  it('hides the average line when the cost base is not positive', () => {
    render(<ManualClassCard assetClass="GOLD" holding={{ ...holding, cost: -1000000 }} currency="IDR" onChanged={vi.fn()} />);
    expect(document.body.textContent).not.toContain('Avg');
  });

  it('edits a sale lot with absolute values and saves negated numbers', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /Gold/ }));
    await screen.findByText(/−2 g/);
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[1]);
    expect(screen.getByRole('radio', { name: 'Sell' }).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByLabelText('Grams') as HTMLInputElement).value).toBe('2');
    expect((screen.getByLabelText('Total received') as HTMLInputElement).value).toBe('2500000');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(axios.patch).toHaveBeenCalledWith('/api/assets/lots/l2', expect.objectContaining({ quantity: -2, totalPaid: -2500000 })));
  });

  it('lists purchases and deletes one after confirming', async () => {
    const user = userEvent.setup();
    const onChanged = setup();
    await user.click(screen.getByRole('button', { name: /Gold/ }));
    expect(await screen.findByRole('heading', { name: 'Purchases' })).toBeTruthy();
    expect(axios.get).toHaveBeenCalledWith('/api/assets/lots', { params: { assetClass: 'GOLD' } });
    await screen.findByText(/−2 g/);
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(axios.delete).toHaveBeenCalledWith('/api/assets/lots/l1'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
