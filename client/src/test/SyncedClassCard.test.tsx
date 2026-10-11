import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from '@/lib/axios';
import type { Portfolio } from '@/hooks/use-portfolio';
import { SyncedClassCard } from '@/components/assets/synced-class-card';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), defaults: {} } }));

const btc = { assetClass: 'CRYPTO', symbol: 'BTC', quantity: 0.12345678901, unit: null, value: 9000000, cost: null, gain: null, gainPct: null, source: 'binance' };
const eth = { assetClass: 'CRYPTO', symbol: 'ETH', quantity: 2, unit: null, value: 4000000, cost: 3000000, gain: 1000000, gainPct: 33.3, source: 'binance' };
const off: Portfolio['sources']['binance'] = { connected: false, lastSyncedAt: null, error: null };
const on: Portfolio['sources']['binance'] = { connected: true, lastSyncedAt: new Date(Date.now() - 5 * 60000).toISOString(), error: null };

const setup = (status = on, holdings = [btc, eth]) => {
  const onChanged = vi.fn();
  const onSync = vi.fn();
  render(<SyncedClassCard assetClass="CRYPTO" holdings={holdings} status={status} currency="IDR" onChanged={onChanged} onSync={onSync} />);
  return { onChanged, onSync };
};

describe('SyncedClassCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.put).mockResolvedValue({ data: {} });
    vi.mocked(axios.delete).mockResolvedValue({ data: {} });
  });

  const connect = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Connect Binance' }));
    await user.type(screen.getByLabelText('API key'), 'KEY');
    await user.type(screen.getByLabelText('API secret'), 'SECRET');
    await user.click(screen.getByRole('button', { name: 'Connect' }));
  };

  it('connects: instructions, put, onChanged, secret cleared', async () => {
    const user = userEvent.setup();
    const { onChanged } = setup(off, []);
    await user.click(screen.getByRole('button', { name: 'Connect Binance' }));
    expect(document.body.textContent).toContain('Enable Reading');
    expect(document.body.textContent).toContain('43.155.186.108');
    const secret = screen.getByLabelText('API secret') as HTMLInputElement;
    expect(secret.type).toBe('password');
    expect(secret.autocomplete).toBe('off');
    expect((screen.getByLabelText('API key') as HTMLInputElement).autocomplete).toBe('off');
    await user.type(screen.getByLabelText('API key'), 'KEY');
    await user.type(secret, 'SECRET');
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith('/api/assets/sources/binance', { apiKey: 'KEY', apiSecret: 'SECRET' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(secret.value).toBe('');
  });

  it('shows a 400 message inline and clears the secret', async () => {
    vi.mocked(axios.put).mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { message: 'Use a read-only key' } } });
    const user = userEvent.setup();
    setup(off, []);
    await connect(user);
    expect((await screen.findByRole('alert')).textContent).toBe('Use a read-only key');
    expect((screen.getByLabelText('API secret') as HTMLInputElement).value).toBe('');
  });

  it('explains a 503', async () => {
    vi.mocked(axios.put).mockRejectedValue({ isAxiosError: true, response: { status: 503, data: { message: "Binance sync isn't set up" } } });
    const user = userEvent.setup();
    setup(off, []);
    await connect(user);
    expect((await screen.findByRole('alert')).textContent).toBe("Binance sync isn't set up on the server");
  });

  it('lists coins, last synced, add cost and gain', async () => {
    const user = userEvent.setup();
    setup();
    const t = document.body.textContent ?? '';
    expect(t).toContain('Last synced 5 min ago');
    expect(t).toContain('BTC');
    expect(t).toContain('0.12345679');
    expect(t).toMatch(/Rp\s?9,000,000/);
    expect(t).toMatch(/\+Rp\s?1,000,000/);
    expect(t).toContain('33.3%');
    await user.click(screen.getByRole('button', { name: 'Add cost' }));
    await user.type(screen.getByLabelText('Cost'), '5000');
    await user.click(screen.getByRole('radio', { name: 'USD' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith('/api/assets/costs/CRYPTO/BTC', { costAmount: 5000, costCurrency: 'USD' }));
  });

  it('shows a sync error and still lists coins', () => {
    setup({ ...on, error: 'Invalid API-key, IP, or permissions for action.' });
    const t = document.body.textContent ?? '';
    expect(t).toContain("Couldn't sync: Invalid API-key, IP, or permissions for action.");
    expect(t).toContain('ETH');
  });

  it('menu: sync now and disconnect', async () => {
    const user = userEvent.setup();
    const { onSync, onChanged } = setup();
    await user.click(screen.getByRole('button', { name: 'Crypto options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sync now' }));
    expect(onSync).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Crypto options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Disconnect' }));
    await user.click(await screen.findByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(axios.delete).toHaveBeenCalledWith('/api/assets/sources/binance'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
