import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import axios from '@/lib/axios';

export interface Bill {
  id: string;
  name: string;
  amount: number;
  currency: 'KRW' | 'IDR';
  walletId: string | null;
  categoryId: string | null;
  dayOfMonth: number;
  remindDaysBefore: 0 | 1 | 3;
  active: boolean;
  createdAt: string;
  wallet: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
}

export function useBills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    try {
      const res = await axios.get('/api/bills');
      setBills(res.data.data.bills);
    } catch (err) {
      setError((isAxiosError(err) && err.response?.data?.message) || "Couldn't load bills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { bills, loading, error, refetch };
}
