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

// refreshKey: bump to refetch; every bump after the first load asks the server for fresh prices
export function usePortfolio(currency: string, refreshKey = 0) {
  const [data, setData] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const firstKey = useRef(refreshKey);

  const refetch = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/assets', { params: { currency, ...(refresh && { refresh: '1' }) } });
      setData(res.data.data);
    } catch (err) {
      setError((err instanceof AxiosError && err.response?.data?.message) || "Couldn't load your assets");
    } finally {
      setLoading(false);
    }
  }, [currency]);

  useEffect(() => {
    refetch(refreshKey !== firstKey.current);
  }, [refetch, refreshKey]);

  return { data, loading, error, refetch };
}
