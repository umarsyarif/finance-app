import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';

const txOpts = vi.fn();
const statsOpts = vi.fn();
let wallets: unknown[] = [];
const walletsState = { loading: false, error: null as string | null };
const refetchWallets = vi.fn();
vi.mock('@/hooks/use-wallets', () => ({ useWallets: () => ({ wallets, ...walletsState, refetch: refetchWallets }) }));
vi.mock('@/hooks/use-transactions', () => ({
  useTransactions: (o: unknown) => { txOpts(o); return { transactions: [], loading: false }; },
}));
let statsState: Record<string, unknown> = {};
vi.mock('@/hooks/use-stats', () => ({
  useStats: (o: unknown) => { statsOpts(o); return { monthlySummary: null, categoryBreakdown: [], incomeBreakdown: [], trendData: [], loading: false, error: null, ...statsState }; },
}));
vi.mock('@/components/finance/wallet-cards', () => ({ WalletCards: () => <div data-testid="wallet-cards" /> }));
vi.mock('@/components/finance/year-chart', () => ({ YearChart: () => null }));
const shell = { selectedCurrency: 'IDR', setSelectedCurrency: vi.fn(), selectedWalletId: undefined as string | undefined, setSelectedWalletId: vi.fn(), dataVersion: 0, notifyDataChanged: vi.fn() };
vi.mock('@/components/app-layout', () => ({ useAppShell: () => shell }));

const renderHome = () => render(<MemoryRouter><Dashboard /></MemoryRouter>);

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    walletsState.loading = false;
    walletsState.error = null;
    statsState = {};
    shell.selectedWalletId = undefined;
  });

  const mixed = [
    { id: 'k1', currency: 'KRW', isMain: true, balance: 1000 },
    { id: 'i1', currency: 'IDR', isMain: false, balance: 1500 },
    { id: 'i2', currency: 'IDR', isMain: false, balance: 2500 },
  ];

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

  it('hides leftover Summary figures while stats load', () => {
    wallets = mixed;
    statsState = { loading: true, monthlySummary: { income: 7777, expense: 0, balance: 7777, month: 1, year: 2026 } };
    const { container } = renderHome();
    expect(screen.queryByText('Summary')).not.toBeInTheDocument();
    expect(screen.queryByText(/7,777/)).not.toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows the stats error when the query failed with no data', () => {
    wallets = mixed;
    statsState = { error: 'Failed to fetch statistics' };
    renderHome();
    expect(screen.getByText('Failed to fetch statistics')).toBeInTheDocument();
  });

  it('renders no wallet cards while wallets load', () => {
    wallets = [];
    walletsState.loading = true;
    renderHome();
    expect(screen.queryByTestId('wallet-cards')).not.toBeInTheDocument();
  });

  it('shows the wallets error with a Try again that refetches', () => {
    wallets = [];
    walletsState.error = 'Failed to fetch wallets';
    renderHome();
    expect(screen.getByText('Failed to fetch wallets')).toBeInTheDocument();
    expect(screen.queryByTestId('wallet-cards')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetchWallets).toHaveBeenCalled();
  });

  it('renders the empty-state wallet cards once loading finished with no wallets', () => {
    wallets = [];
    renderHome();
    expect(screen.getByTestId('wallet-cards')).toBeInTheDocument();
  });

  it('"See all transactions" opens a wallet of the selected currency', () => {
    wallets = mixed;
    shell.selectedWalletId = 'k1'; // KRW wallet while Home shows IDR
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: /See all transactions/ }));
    expect(shell.setSelectedWalletId).toHaveBeenCalledWith('i1');
  });

  it('"See all transactions" keeps the selected wallet when it is in the currency', () => {
    wallets = mixed;
    shell.selectedWalletId = 'i2';
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: /See all transactions/ }));
    expect(shell.setSelectedWalletId).toHaveBeenCalledWith('i2');
  });
});
