import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from '@/lib/axios';
import { useTransactions } from '@/hooks/use-transactions';

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Node 25 ships a global localStorage that shadows jsdom's; use an in-memory one
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (key) => { store.delete(key); },
    setItem: (key, value) => { store.set(key, String(value)); },
  };
}

describe('useTransactions', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    vi.mocked(axios.get).mockReset();
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        data: {
          transactions: [
            {
              id: 't1',
              walletId: 'w1',
              categoryId: 'c1',
              amount: 1500,
              description: 'Lunch',
              date: '2026-10-01T03:00:00.000Z',
              createdAt: '2026-10-01T03:00:00.000Z',
              wallet: { id: 'w1', userId: 'u1', name: 'Main', currency: 'KRW', balance: 0, createdAt: '' },
              category: { id: 'c1', userId: 'u1', name: 'Food', type: 'EXPENSE', createdAt: '' },
            },
          ],
          pagination: { total: 1 },
        },
      },
    });
  });

  it('fetches once and does not refetch after caching offline data', async () => {
    const { result } = renderHook(() => useTransactions({ walletId: 'w1' }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    // Give any re-render driven refetch a chance to happen
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(result.current.transactions).toHaveLength(1);
  });
});
