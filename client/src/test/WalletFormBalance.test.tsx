import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WalletForm } from '@/components/finance/wallet-form';

vi.mock('@/lib/axios', () => ({ default: { post: vi.fn(), patch: vi.fn(), defaults: {} } }));

const wallet = (transactions: number) => ({
  id: 'w1', name: 'Cash', balance: 700, currency: 'KRW', color: '#3B82F6', _count: { transactions },
});

describe('WalletForm balance', () => {
  it('is locked once the wallet has transactions', () => {
    render(<WalletForm wallet={wallet(3)} />);
    expect(screen.getByLabelText('Balance')).toBeDisabled();
    expect(screen.getByText('Locked: this wallet has transactions.')).toBeInTheDocument();
  });

  it('stays editable for an empty wallet and for a new one', () => {
    const { unmount } = render(<WalletForm wallet={wallet(0)} />);
    expect(screen.getByLabelText('Balance')).toBeEnabled();
    unmount();
    render(<WalletForm />);
    expect(screen.getByLabelText('Starting balance')).toBeEnabled();
  });
});
