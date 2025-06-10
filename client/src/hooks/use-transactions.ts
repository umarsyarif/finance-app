import { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import { Transaction } from '@/components/finance/transactions-list';

interface ApiTransaction {
  id: string;
  walletId: string;
  categoryId: string;
  amount: number;
  description: string;
  date: string;
  createdAt: string;
  wallet: {
    id: string;
    userId: string;
    name: string;
    currency: string;
    balance: number;
    createdAt: string;
  };
  category: {
    id: string;
    userId: string;
    name: string;
    type: 'INCOME' | 'EXPENSE';
    createdAt: string;
  };
}

interface UseTransactionsOptions {
  page?: number;
  limit?: number;
  walletId?: string;
  categoryId?: string;
  month?: number;
  year?: number;
}

interface UseTransactionsReturn {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  hasMore: boolean;
  totalCount: number;
}

export function useTransactions(options: UseTransactionsOptions = {}): UseTransactionsReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const { page = 1, limit = 10, walletId, categoryId, month, year } = options;

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (walletId) params.append('walletId', walletId);
      if (categoryId) params.append('categoryId', categoryId);
      if (month) params.append('month', month.toString());
      if (year) params.append('year', year.toString());

      const response = await axios.get(`/api/transactions?${params.toString()}`);
      const { data } = response.data;

      // Transform API data to match our Transaction interface
      const transformedTransactions: Transaction[] = data.transactions.map((apiTransaction: ApiTransaction) => ({
        id: apiTransaction.id,
        title: apiTransaction.description,
        description: apiTransaction.description,
        date: apiTransaction.date,
        amount: apiTransaction.amount,
        type: apiTransaction.category.type as 'INCOME' | 'EXPENSE',
        walletId: apiTransaction.walletId,
        categoryId: apiTransaction.categoryId,
        wallet: {
          id: apiTransaction.wallet.id,
          name: apiTransaction.wallet.name,
          currency: apiTransaction.wallet.currency,
        },
        category: {
          id: apiTransaction.category.id,
          name: apiTransaction.category.name,
        },
      }));

      setTransactions(transformedTransactions);
      setTotalCount(data.pagination?.total || 0);
      setHasMore((page * limit) < (data.pagination?.total || 0));
    } catch (err: any) {
      console.error('Failed to fetch transactions:', err);
      setError(err.response?.data?.message || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, limit, walletId, categoryId, month, year]);

  return {
    transactions,
    loading,
    error,
    refetch: fetchTransactions,
    hasMore,
    totalCount,
  };
}