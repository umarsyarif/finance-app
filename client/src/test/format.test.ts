import { describe, it, expect } from 'vitest';
import { formatAmount } from '@/lib/format-utils';
import { typeCounts, type Transaction } from '@/components/finance/transactions-list';

describe('formatAmount', () => {
  it('signs income and expense', () => {
    expect(formatAmount(48500, 'EXPENSE', 'KRW')).toBe('-₩48,500');
    expect(formatAmount(3200000, 'INCOME', 'KRW')).toBe('+₩3,200,000');
  });

  it('keeps a negative balance negative when no type is given', () => {
    expect(formatAmount(-1500, null, 'KRW')).toBe('-₩1,500');
  });

  it('uses the Rp symbol and rounds to whole numbers', () => {
    expect(formatAmount(18450000, null, 'IDR')).toBe('Rp\u00a018,450,000');
    expect(formatAmount(1436.88, null, 'IDR')).toBe('Rp\u00a01,437');
    expect(formatAmount(500.5, 'EXPENSE', 'KRW')).toBe('-₩501');
  });
});

describe('typeCounts', () => {
  it('counts all, income and expense', () => {
    const tx = (type: 'INCOME' | 'EXPENSE') => ({ type }) as Transaction;
    expect(typeCounts([tx('INCOME'), tx('EXPENSE'), tx('EXPENSE')])).toEqual({ ALL: 3, INCOME: 1, EXPENSE: 2 });
  });
});
