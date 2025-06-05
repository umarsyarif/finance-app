import { useState, useEffect } from 'react';
import axios from '../lib/axios';

interface Wallet {
  id: string;
  name: string;
  balance: number;
  currency: string;
}

interface UseWalletsReturn {
  wallets: Wallet[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useWallets(): UseWalletsReturn {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/wallets');
      setWallets(response.data.data.wallets || []);
    } catch (err: any) {
      console.error('Failed to fetch wallets:', err);
      setError(err.response?.data?.message || 'Failed to fetch wallets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  return {
    wallets,
    loading,
    error,
    refetch: fetchWallets,
  };
}