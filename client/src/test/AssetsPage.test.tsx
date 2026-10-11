import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Assets from '@/pages/Assets';

vi.mock('recharts', async (orig) => {
  const actual = await orig<typeof import('recharts')>();
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactElement }) => <div style={{ width: 300, height: 180 }}>{children}</div> };
});
let hook: Record<string, unknown> = {};
vi.mock('@/hooks/use-portfolio', () => ({ usePortfolio: () => hook }));
vi.mock('@/components/app-layout', () => ({
  useAppShell: () => ({ selectedCurrency: 'IDR', setSelectedCurrency: vi.fn(), dataVersion: 0 }),
}));

const portfolio = (over = {}) => ({
  currency: 'IDR',
  total: { value: 1000000, cost: 800000, gain: 200000, gainPct: 25 },
  holdings: [
    { assetClass: 'GOLD', symbol: 'XAU', quantity: 10, unit: 'g', value: 600000, cost: 500000, gain: 100000, gainPct: 20, source: 'manual' },
    { assetClass: 'CRYPTO', symbol: 'BTC', quantity: 0.1, unit: null, value: 400000, cost: 300000, gain: 100000, gainPct: 33, source: 'binance' },
  ],
  sources: { binance: { connected: true, lastSyncedAt: null, error: null } },
  stale: false,
  ...over,
});
const renderPage = () => render(<MemoryRouter><Assets /></MemoryRouter>);

describe('Assets page', () => {
  beforeEach(() => { hook = { data: portfolio(), loading: false, error: null, refetch: vi.fn() }; });

  it('shows the heading and eyebrow', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Assets' })).toBeTruthy();
    expect(screen.getByText('Portfolio')).toBeTruthy();
  });

  it('shows the total and a positive gain', () => {
    renderPage();
    const card = screen.getByLabelText('Total assets');
    expect(card.textContent).toMatch(/Rp\s?1,000,000/);
    expect(card.textContent).toContain('+');
    expect(card.textContent).toContain('25.0%');
  });

  it('lists the distribution legend', () => {
    renderPage();
    const dist = screen.getByLabelText('Distribution');
    expect(dist.textContent).toContain('Gold');
    expect(dist.textContent).toContain('BTC');
    expect(dist.textContent).toContain('60%');
    expect(dist.textContent).toContain('40%');
  });

  it('notes stale prices', () => {
    hook = { ...hook, data: portfolio({ stale: true }) };
    renderPage();
    expect(screen.getByText('Prices may be out of date')).toBeTruthy();
  });

  it('shows the error when there is no data', () => {
    hook = { data: null, loading: false, error: 'Prices are unavailable right now', refetch: vi.fn() };
    renderPage();
    expect(screen.getByText('Prices are unavailable right now')).toBeTruthy();
  });
});
