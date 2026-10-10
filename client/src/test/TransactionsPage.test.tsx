import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MonthlyTransactionsView } from '@/pages/Transactions';

const listProps = vi.fn();
const cardProps = vi.fn();
vi.mock('@/components/finance/transactions-list', () => ({
  TransactionsList: (p: unknown) => { listProps(p); return null; },
}));
vi.mock('@/components/finance/wallet-cards', () => ({
  WalletCards: (p: unknown) => { cardProps(p); return null; },
}));
vi.mock('@/hooks/use-wallets', () => ({
  useWallets: () => ({ wallets: [{ id: 'k1', currency: 'KRW', isMain: true }, { id: 'i1', currency: 'IDR', isMain: false }] }),
}));
const shell = { selectedWalletId: 'deleted', setSelectedWalletId: vi.fn(), dataVersion: 0 };
vi.mock('@/components/app-layout', () => ({ useAppShell: () => shell }));

describe('Transactions page', () => {
  it('lists only the resolved wallet (main when the stored one is gone)', () => {
    render(<MonthlyTransactionsView />);
    expect(listProps).toHaveBeenLastCalledWith(expect.objectContaining({ walletId: 'k1' }));
    expect(cardProps).toHaveBeenLastCalledWith(expect.objectContaining({ selectedWalletId: 'k1', onSelect: shell.setSelectedWalletId }));
  });

  it('cards follow the page month', () => {
    render(<MonthlyTransactionsView />);
    const { month } = cardProps.mock.lastCall![0] as { month: Date };
    const list = listProps.mock.lastCall![0] as { currentDate: Date };
    expect(month).toBe(list.currentDate);
  });
});
