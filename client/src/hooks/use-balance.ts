import { useState, useEffect } from 'react';
import axios from '@/lib/axios';

interface BalanceData {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  currency: string;
}

interface UseBalanceReturn {
  balance: BalanceData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useBalance(): UseBalanceReturn {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch wallets to calculate total balance
      const walletsResponse = await axios.get('/api/wallets');
      const wallets = walletsResponse.data.data.wallets || [];
      
      // Calculate total balance
      const totalBalance = wallets.reduce((sum: number, wallet: any) => sum + wallet.balance, 0);
      
      // Fetch transactions to calculate income and expense
      const transactionsResponse = await axios.get('/api/transactions?limit=1000'); // Get all transactions
      const transactions = transactionsResponse.data.data.transactions || [];
      
      let totalIncome = 0;
      let totalExpense = 0;
      
      transactions.forEach((transaction: any) => {
        if (transaction.category.type === 'INCOME') {
          totalIncome += transaction.amount;
        } else if (transaction.category.type === 'EXPENSE') {
          totalExpense += Math.abs(transaction.amount);
        }
      });
      
      // Use the first wallet's currency or default to USD
      const currency = wallets.length > 0 ? wallets[0].currency : 'USD';
      
      setBalance({
        totalBalance,
        totalIncome,
        totalExpense,
        currency
      });
    } catch (err: any) {
      console.error('Failed to fetch balance:', err);
      setError(err.response?.data?.message || 'Failed to fetch balance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  return {
    balance,
    loading,
    error,
    refetch: fetchBalance,
  };
}