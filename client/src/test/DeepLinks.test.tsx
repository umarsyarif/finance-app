import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import axios from '@/lib/axios';
import { toast } from 'sonner';
import { AppLayout } from '@/components/app-layout';
import Dashboard from '@/pages/Dashboard';
import { MonthlyTransactionsView } from '@/pages/Transactions';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const store = new Map<string, string>();
vi.mock('@/services/secure-storage.service', () => ({
  secureStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), info: vi.fn() } }));
vi.mock('@/hooks/use-wallets', () => ({
  useWallets: () => ({ wallets: [{ id: 'w1', name: 'Cash', currency: 'KRW', isMain: true, balance: 0 }, { id: 'w2', name: 'BCA', currency: 'IDR', isMain: false, balance: 0 }], loading: false, error: null, refetch: vi.fn() }),
}));
vi.mock('@/hooks/use-categories', () => ({
  useCategories: () => ({ categories: [{ id: 'c1', name: 'Bills', type: 'EXPENSE', color: '' }], loading: false, error: null, refetch: vi.fn() }),
}));
vi.mock('@/hooks/use-transactions', () => ({ useTransactions: () => ({ transactions: [], loading: false }) }));
vi.mock('@/hooks/use-stats', () => ({
  useStats: () => ({ monthlySummary: null, categoryBreakdown: [], incomeBreakdown: [], trendData: [], loading: false, error: null }),
}));
vi.mock('@/components/finance/wallet-cards', () => ({ WalletCards: () => null }));
vi.mock('@/components/finance/transactions-list', async (orig) => ({ ...(await orig<object>()), TransactionsList: () => null }));
vi.mock('@/components/finance/year-chart', () => ({ YearChart: () => null }));
vi.mock('@/components/app-header', () => ({ AppHeader: () => null }));
vi.mock('@/components/app-footer', () => ({ AppFooter: () => null }));

let go: (to: string) => void = () => {};
const Probe = () => { const l = useLocation(); go = useNavigate(); return <div data-testid="loc">{l.pathname + l.search}</div>; };
const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Probe />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="" element={<Dashboard />} />
          <Route path="transactions" element={<MonthlyTransactionsView />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

const bill = { id: 'b1', name: 'Rent', amount: 500000, walletId: 'w1', categoryId: 'c1' };

describe('deep links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    vi.mocked(axios.get).mockResolvedValue({ data: { data: { bills: [bill] } } });
  });

  it('?add=bill:<id> opens the sheet prefilled and drops the param', async () => {
    renderAt('/?add=bill:b1');
    expect(await screen.findByText('Add transaction')).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith('/api/bills');
    await waitFor(() => expect(screen.getByLabelText('Amount')).toHaveValue(500000));
    expect(screen.getByLabelText('Description')).toHaveValue('Rent');
    expect(screen.getByRole('button', { name: 'Expense' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Bills' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('combobox', { name: 'Wallet' })).toHaveTextContent('Cash');
    expect(screen.getByTestId('loc').textContent).not.toContain('add=');
  });

  it('a missing bill opens an empty sheet and says so', async () => {
    renderAt('/?add=bill:missing');
    expect(await screen.findByText('Add transaction')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('That bill no longer exists');
    expect(screen.getByLabelText('Amount')).toHaveValue(null);
  });

  it('?add=new opens an empty sheet', async () => {
    renderAt('/?add=new');
    expect(await screen.findByText('Add transaction')).toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalledWith('/api/bills');
    expect(screen.getByLabelText('Amount')).toHaveValue(null);
    expect(screen.getByTestId('loc').textContent).not.toContain('add=');
  });

  it('?wallet= selects the wallet and drops the param', async () => {
    renderAt('/transactions?wallet=w2');
    await waitFor(() => expect(store.get('selected_wallet')).toBe('w2'));
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('/transactions'));
  });

  it('?month= opens that month; invalid falls back to now', async () => {
    const { unmount } = renderAt('/?month=2026-09');
    expect(await screen.findByText('September 2026')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('/'));
    unmount();
    renderAt('/?month=abc');
    const now = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    expect(await screen.findByText(now)).toBeInTheDocument();
  });

  it('?month= works while Home is already mounted', async () => {
    renderAt('/');
    await screen.findByText(new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    act(() => go('/?month=2026-09'));
    expect(await screen.findByText('September 2026')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('/'));
  });

  it('a bill without a wallet keeps the default wallet', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { data: { bills: [{ ...bill, walletId: null }] } } });
    renderAt('/?add=bill:b1');
    await waitFor(() => expect(screen.getByLabelText('Amount')).toHaveValue(500000));
    expect(screen.getByRole('combobox', { name: 'Wallet' })).toHaveTextContent('Cash');
  });

  it('a failed bill fetch says so and opens an empty sheet', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('x'));
    renderAt('/?add=bill:b1');
    expect(await screen.findByText('Add transaction')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Couldn't load that bill");
  });
});
