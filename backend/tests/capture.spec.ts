process.env.TZ = 'Asia/Seoul';

import { resolveDraft, summarize, CaptureError, type DraftCategory } from '../src/services/capture.service';
import type { AiExtraction } from '../src/services/ai.service';

const now = new Date('2026-10-10T03:00:00.000Z'); // 12:00 in Seoul
const wallets = [
  { id: 'w-krw-main', name: 'KRW Main', currency: 'KRW', isMain: true },
  { id: 'w-krw-card', name: 'Shinhan Card', currency: 'KRW', isMain: false },
  { id: 'w-idr', name: 'Rupiah', currency: 'IDR', isMain: false },
];
const categories: DraftCategory[] = [
  { id: 'c-food', name: 'Food', type: 'EXPENSE' },
  { id: 'c-salary', name: 'Salary', type: 'INCOME' },
];
const other = jest.fn(async (type: 'INCOME' | 'EXPENSE') => ({ id: `c-other-${type}`, name: 'Other', type }));
const ctx = () => ({ wallets, categories, now, otherCategory: other });

const extraction = (over: Partial<AiExtraction> = {}): AiExtraction => ({
  found: true,
  type: 'EXPENSE',
  amount: 6500,
  currency: 'KRW',
  description: 'Starbucks',
  date: '2026-10-10T08:15:00',
  categoryName: 'Food',
  walletName: null,
  ...over,
});

beforeEach(() => other.mockClear());

describe('resolveDraft: amount', () => {
  it('rejects a capture without an amount', async () => {
    await expect(resolveDraft(extraction({ amount: null }), ctx())).rejects.toThrow("Couldn't find an amount");
    await expect(resolveDraft(extraction({ found: false }), ctx())).rejects.toThrow(CaptureError);
  });

  it('rejects zero, negative and oversized amounts', async () => {
    await expect(resolveDraft(extraction({ amount: 0 }), ctx())).rejects.toThrow(CaptureError);
    await expect(resolveDraft(extraction({ amount: -5 }), ctx())).rejects.toThrow(CaptureError);
    await expect(resolveDraft(extraction({ amount: 1e13 }), ctx())).rejects.toThrow(CaptureError);
  });
});

describe('resolveDraft: wallet', () => {
  it('uses the named wallet when its currency matches', async () => {
    const draft = await resolveDraft(extraction({ walletName: 'shinhan card' }), ctx());
    expect(draft.walletId).toBe('w-krw-card');
  });

  it('ignores a named wallet in another currency and falls back to the main wallet', async () => {
    const draft = await resolveDraft(extraction({ walletName: 'Rupiah' }), ctx());
    expect(draft.walletId).toBe('w-krw-main');
  });

  it('picks a wallet in the capture currency when the main wallet differs', async () => {
    const draft = await resolveDraft(extraction({ currency: 'IDR', amount: 25000 }), ctx());
    expect(draft.walletId).toBe('w-idr');
    expect(draft.currency).toBe('IDR');
  });

  it('uses the main wallet when the currency is unknown', async () => {
    const draft = await resolveDraft(extraction({ currency: null }), ctx());
    expect(draft.walletId).toBe('w-krw-main');
  });

  it('refuses a currency with no wallet', async () => {
    await expect(resolveDraft(extraction({ currency: 'USD' }), ctx())).rejects.toThrow('No USD wallet');
  });

  it('refuses when the user has no wallets', async () => {
    await expect(resolveDraft(extraction(), { ...ctx(), wallets: [] })).rejects.toThrow('Add a wallet first');
  });
});

describe('resolveDraft: category', () => {
  it('matches an existing category of the same type, case-insensitively', async () => {
    const draft = await resolveDraft(extraction({ categoryName: 'food' }), ctx());
    expect(draft.categoryId).toBe('c-food');
    expect(other).not.toHaveBeenCalled();
  });

  it('falls back to Other when the name is unknown or the type differs', async () => {
    const unknown = await resolveDraft(extraction({ categoryName: 'Pharmacy' }), ctx());
    expect(unknown.categoryId).toBe('c-other-EXPENSE');
    const wrongType = await resolveDraft(extraction({ categoryName: 'Salary' }), ctx());
    expect(wrongType.categoryId).toBe('c-other-EXPENSE');
    const income = await resolveDraft(extraction({ type: 'INCOME', categoryName: null }), ctx());
    expect(income.categoryId).toBe('c-other-INCOME');
  });
});

describe('resolveDraft: date and description', () => {
  it('reads a local date-time in the server timezone', async () => {
    const draft = await resolveDraft(extraction({ date: '2026-10-09T14:20:00' }), ctx());
    expect(draft.date).toBe('2026-10-09T05:20:00.000Z');
  });

  it('uses local noon for a date without a time', async () => {
    const draft = await resolveDraft(extraction({ date: '2026-10-09' }), ctx());
    expect(draft.date).toBe('2026-10-09T03:00:00.000Z');
  });

  it('uses now for a missing, invalid or far-future date', async () => {
    for (const date of [null, 'not a date', '2027-10-10T08:00:00']) {
      const draft = await resolveDraft(extraction({ date }), ctx());
      expect(draft.date).toBe(now.toISOString());
    }
  });

  it('trims the description and falls back to the category name', async () => {
    expect((await resolveDraft(extraction({ description: '  Emart  ' }), ctx())).description).toBe('Emart');
    expect((await resolveDraft(extraction({ description: '' }), ctx())).description).toBe('Food');
  });
});

describe('summarize', () => {
  it('describes what was added', async () => {
    const draft = await resolveDraft(extraction(), ctx());
    expect(summarize(draft)).toBe('Added -₩6,500 Starbucks · Food · KRW Main');
  });

  it('signs income with +', async () => {
    const draft = await resolveDraft(extraction({ type: 'INCOME', amount: 3200000, categoryName: 'Salary', description: 'Payroll' }), ctx());
    expect(summarize(draft)).toBe('Added +₩3,200,000 Payroll · Salary · KRW Main');
  });
});
