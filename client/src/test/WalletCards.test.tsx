import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from '@/lib/axios';
import { WalletCards } from '@/components/finance/wallet-cards';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
const setMainWallet = vi.fn();
vi.mock('@/hooks/use-wallets', () => ({
  useWallets: () => ({
    wallets: [
      { id: 'k1', name: 'Won', currency: 'KRW', isMain: true, balance: 1000, color: '#000', _count: { transactions: 0 } },
      { id: 'i1', name: 'Rupiah', currency: 'IDR', isMain: false, balance: 5, color: '#000', _count: { transactions: 0 } },
    ],
    loading: false, error: null, refetch: vi.fn(), setMainWallet,
  }),
}));

const renderCards = (props: Parameters<typeof WalletCards>[0]) =>
  render(<MemoryRouter><WalletCards {...props} /></MemoryRouter>);

describe('WalletCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (axios.get as any).mockResolvedValue({ data: { data: { transactions: [] } } });
  });

  it('shows only the given wallets and does not change the selection without onSelect', () => {
    const onOpen = vi.fn();
    renderCards({ walletIds: ['i1'], onOpen, selectedWalletId: 'k1' });
    expect(screen.queryByLabelText('Won', { selector: 'article' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Rupiah', { selector: 'article' })).toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('tap opens; long-press makes main without opening; Manage does not open', () => {
    vi.useFakeTimers();
    const onOpen = vi.fn();
    renderCards({ onOpen });
    const card = screen.getByLabelText('Rupiah', { selector: 'article' });

    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledWith('i1');

    onOpen.mockClear();
    fireEvent.pointerDown(card);
    act(() => { vi.advanceTimersByTime(600); });
    fireEvent.pointerUp(card);
    fireEvent.click(card);
    expect(setMainWallet).toHaveBeenCalledWith('i1');
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Manage Rupiah'));
    expect(onOpen).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('fetches in/out for the given month', () => {
    renderCards({ month: new Date(2026, 8, 15) });
    const params = (axios.get as any).mock.calls[0][1].params;
    expect(new Date(params.startDate).getMonth()).toBe(8);
  });
});
