import { useState, useEffect } from 'react';
import axios from '@/lib/axios';

interface Wallet {
  id: string;
  name: string;
  balance: number;
  currency: string;
  color: string;
  isMain: boolean;
  displayOrder: number;
}

interface UseWalletsReturn {
  wallets: Wallet[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  setMainWallet: (walletId: string) => Promise<void>;
  updateWalletOrder: (walletOrders: { id: string; displayOrder: number }[]) => Promise<void>;
  getMainWallet: () => Wallet | undefined;
}

export function useWallets(): UseWalletsReturn {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/wallets/user', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        params: {
          _t: Date.now() // Cache busting parameter
        }
      });
      setWallets(response.data.data.wallets || []);
    } catch (err: any) {
      console.error('Failed to fetch wallets:', err);
      setError(err.response?.data?.message || 'Failed to fetch wallets');
    } finally {
      setLoading(false);
    }
  };

  const setMainWallet = async (walletId: string) => {
    try {
      await axios.put(`/api/wallets/${walletId}/main`);
      await fetchWallets(); // Refetch to get updated data
    } catch (err: any) {
      console.error('Failed to set main wallet:', err);
      throw new Error(err.response?.data?.message || 'Failed to set main wallet');
    }
  };

  const updateWalletOrder = async (walletOrders: { id: string; displayOrder: number }[]) => {
    try {
      await axios.put('/api/wallets/order', { walletOrders });
      await fetchWallets(); // Refetch to get updated data
    } catch (err: any) {
      console.error('Failed to update wallet order:', err);
      throw new Error(err.response?.data?.message || 'Failed to update wallet order');
    }
  };

  const getMainWallet = () => {
    return wallets.find(wallet => wallet.isMain);
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  return {
    wallets,
    loading,
    error,
    refetch: fetchWallets,
    setMainWallet,
    updateWalletOrder,
    getMainWallet,
  };
}