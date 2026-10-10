import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';

const txOpts = vi.fn();
const statsOpts = vi.fn();
let wallets: unknown[] = [];
vi.mock('@/hooks/use-wallets', () => ({ useWallets: () => ({ wallets, loading: false, refetch: vi.fn() }) }));
vi.mock('@/hooks/use-transactions', () => ({
  useTransactions: (o: unknown) => { txOpts(o); return { transactions: [], loading: false }; },
}));
vi.mock('@/hooks/use-stats', () => ({
  useStats: (o: unknown) => { statsOpts(o); return { monthlySummary: null, categoryBreakdown: [], incomeBreakdown: [], trendData: [], loading: false, error: null }; },
}));
vi.mock('@/components/finance/wallet-cards', () => ({ WalletCards: () => null }));
vi.mock('@/components/finance/year-chart', () => ({ YearChart: () => null }));
const shell = { selectedCurrency: 'IDR', setSelectedCurrency: vi.fn(), selectedWalletId: undefined, setSelectedWalletId: vi.fn(), dataVersion: 0, notifyDataChanged: vi.fn() };
vi.mock('@/components/app-layout', () => ({ useAppShell: () => shell }));

const renderHome = () => render(<MemoryRouter><Dashboard /></MemoryRouter>);

describe('Home', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not query before wallets load', () => {
    wallets = [];
    renderHome();
    expect(txOpts).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
    expect(statsOpts).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('scopes Latest, Summary and the total to the selected currency', () => {
    wallets = [
      { id: 'k1', currency: 'KRW', isMain: true, balance: 1000 },
      { id: 'i1', currency: 'IDR', isMain: false, balance: 1500 },
      { id: 'i2', currency: 'IDR', isMain: false, balance: 2500 },
    ];
    renderHome();
    expect(txOpts).toHaveBeenLastCalledWith(expect.objectContaining({ walletIds: ['i1', 'i2'], limit: 5, enabled: true }));
    expect(statsOpts).toHaveBeenLastCalledWith(expect.objectContaining({ walletIds: ['i1', 'i2'], enabled: true }));
    expect(screen.getByText('Rp 4,000')).toBeInTheDocument();
    expect(screen.getByText(/2 wallets/)).toBeInTheDocument();
  });
});
