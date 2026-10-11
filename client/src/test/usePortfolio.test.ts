import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePortfolio } from '@/hooks/use-portfolio';

const get = vi.fn();
vi.mock('@/lib/axios', () => ({ default: { get: (...a: unknown[]) => get(...a) } }));

const pf = (currency: string) => ({ data: { data: { currency, total: { value: 1, cost: null, gain: null, gainPct: null }, holdings: [], sources: { binance: { connected: false, lastSyncedAt: null, error: null } }, stale: false } } });
const deferred = () => { let resolve!: (v: unknown) => void; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

describe('usePortfolio', () => {
  beforeEach(() => { get.mockReset(); });

  it('ignores a slower response from a superseded currency', async () => {
    const slow = deferred();
    get.mockImplementation((_u: string, cfg: { params: { currency: string } }) => (cfg.params.currency === 'IDR' ? slow.promise : Promise.resolve(pf(cfg.params.currency))));
    const { result, rerender } = renderHook(({ c }) => usePortfolio(c), { initialProps: { c: 'KRW' } });
    await waitFor(() => expect(result.current.data?.currency).toBe('KRW'));
    rerender({ c: 'IDR' });
    rerender({ c: 'KRW' });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { slow.resolve(pf('IDR')); await slow.promise; });
    expect(result.current.data?.currency).toBe('KRW');
  });

  it('sends refresh=1 for a refreshKey bump but not for a later currency toggle', async () => {
    get.mockImplementation((_u: string, cfg: { params: { currency: string } }) => Promise.resolve(pf(cfg.params.currency)));
    const { result, rerender } = renderHook(({ c, k }) => usePortfolio(c, k), { initialProps: { c: 'KRW', k: 0 } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(get.mock.calls[0][1].params).toEqual({ currency: 'KRW' });
    rerender({ c: 'KRW', k: 1 });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(get.mock.calls[1][1].params).toEqual({ currency: 'KRW', refresh: '1' });
    rerender({ c: 'IDR', k: 1 });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(3));
    expect(get.mock.calls[2][1].params).toEqual({ currency: 'IDR' });
  });

  it('surfaces an error with no data when the new currency fails to load', async () => {
    get.mockImplementation((_u: string, cfg: { params: { currency: string } }) => (cfg.params.currency === 'KRW' ? Promise.resolve(pf('KRW')) : Promise.reject(new Error('x'))));
    const { result, rerender } = renderHook(({ c }) => usePortfolio(c), { initialProps: { c: 'KRW' } });
    await waitFor(() => expect(result.current.data?.currency).toBe('KRW'));
    rerender({ c: 'IDR' });
    await waitFor(() => expect(result.current.error).toBe("Couldn't load your assets"));
    expect(result.current.data).toBeNull();
  });
});
