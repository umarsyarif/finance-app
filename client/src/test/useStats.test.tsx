import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from '@/lib/axios';
import { useStats } from '@/hooks/use-stats';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));

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

describe('useStats', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    vi.mocked(axios.get).mockReset();
  });

  it('ignores an older query that resolves after a newer one', async () => {
    // Each wallet's requests resolve when its gate opens; the summary's income tags the wallet
    const gates: Record<string, () => void> = {};
    const opened: Record<string, Promise<void>> = {
      old: new Promise((r) => { gates.old = r; }),
      new: new Promise((r) => { gates.new = r; }),
    };
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      const wallet = url.includes('walletIds=old') ? 'old' : 'new';
      await opened[wallet];
      const income = wallet === 'old' ? 1 : 2;
      return { data: { data: url.includes('monthly-summary') ? { income, expense: 0, balance: income, month: 1, year: 2026 } : [] } };
    });

    const { result, rerender } = renderHook((p: { walletIds: string[] }) => useStats({ walletIds: p.walletIds }), {
      initialProps: { walletIds: ['old'] },
    });
    rerender({ walletIds: ['new'] });

    await act(async () => { gates.new(); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { gates.old(); await new Promise((r) => setTimeout(r, 20)); });

    expect(result.current.monthlySummary?.income).toBe(2);
    expect(result.current.loading).toBe(false);
  });
});
