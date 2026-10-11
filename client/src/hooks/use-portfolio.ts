import { useCallback, useEffect, useRef, useState } from 'react';
import { AxiosError } from 'axios';
import axios from '@/lib/axios';

export interface Holding {
  assetClass: string;
  symbol: string;
  quantity: number;
  unit: string | null;
  value: number | null;
  cost: number | null;
  gain: number | null;
  gainPct: number | null;
  source: string;
}

export interface Portfolio {
  currency: string;
  total: { value: number; cost: number | null; gain: number | null; gainPct: number | null };
  holdings: Holding[];
  sources: { binance: { connected: boolean; lastSyncedAt: string | null; error: string | null } };
  stale: boolean;
}

// refreshKey: bump to refetch; a bump (not a currency change) asks the server for fresh prices
export function usePortfolio(currency: string, refreshKey = 0) {
  const [data, setData] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevKey = useRef(refreshKey);
  const latest = useRef(0);

  const refetch = useCallback(async (refresh = false) => {
    const id = ++latest.current; // a newer request supersedes this one
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/assets', { params: { currency, ...(refresh && { refresh: '1' }) } });
      if (id === latest.current) setData(res.data.data);
    } catch (err) {
      if (id === latest.current) setError((err instanceof AxiosError && err.response?.data?.message) || "Couldn't load your assets");
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [currency]);

  useEffect(() => {
    const refresh = refreshKey !== prevKey.current;
    prevKey.current = refreshKey;
    refetch(refresh);
  }, [refetch, refreshKey]);

  // never expose another currency's numbers
  return { data: data?.currency === currency ? data : null, loading, error, refetch };
}
