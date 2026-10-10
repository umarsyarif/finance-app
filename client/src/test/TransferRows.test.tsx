import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransactionRow, typeCounts, counterpart, type Transaction } from '@/components/finance/transactions-list';

const base = { title: '', date: '2026-10-05T03:00:00.000Z', categoryId: 'c', walletId: 'w1' };
const out: Transaction = {
  ...base, id: 'out', description: 'Transfer to Rupiah', amount: 100000, type: 'EXPENSE',
  wallet: { id: 'w1', name: 'Won', currency: 'KRW' }, category: { id: 'transfer-out', name: 'Transfer out' },
  transferId: 'x',
  transfer: { id: 'x', note: null, transactions: [
    { id: 'out', amount: 100000, wallet: { id: 'w1', name: 'Won', currency: 'KRW' } },
    { id: 'in', amount: 1150000, wallet: { id: 'w2', name: 'Rupiah', currency: 'IDR' } },
  ] },
};
const food: Transaction = { ...base, id: 'f', description: 'Lunch', amount: 7000, type: 'EXPENSE', category: { id: 'c', name: 'Food' } };
const pay: Transaction = { ...base, id: 'p', description: 'Salary', amount: 9, type: 'INCOME', category: { id: 'c2', name: 'Salary' } };

describe('transfer rows', () => {
  it('counterpart is the other side', () => {
    expect(counterpart(out)?.wallet.name).toBe('Rupiah');
    expect(counterpart(food)).toBeUndefined();
  });

  it('typeCounts leave transfers out of income and expense', () => {
    expect(typeCounts([out, food, pay])).toEqual({ ALL: 3, INCOME: 1, EXPENSE: 1 });
  });

  it('row shows Transfer, not the hidden category, in a neutral colour', () => {
    render(<TransactionRow transaction={out} onClick={vi.fn()} />);
    expect(screen.getByText(/Transfer ·/)).toBeInTheDocument();
    expect(screen.queryByText(/Transfer out/)).not.toBeInTheDocument();
    const amount = screen.getByText(/100,000/);
    expect(amount.className).not.toMatch(/text-expense|text-income/);
  });
});
