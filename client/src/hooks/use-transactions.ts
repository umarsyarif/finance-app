import { useState, useEffect, useRef } from 'react';
import axios from '@/lib/axios';
import { Transaction } from '@/components/finance/transactions-list';
import { useOffline } from '@/hooks/use-offline';
import { getStartOfMonth, getEndOfMonth } from '@/lib/date-utils';
import { toast } from 'sonner';

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
    icon?: string | null;
    createdAt: string;
  };
  transferId: string | null;
  transfer: Transaction['transfer'];
}

interface UseTransactionsOptions {
  limit?: number;
  walletId?: string;
  walletIds?: string[]; // sent as walletIds=a,b (ignored if walletId is also given)
  enabled?: boolean; // false = no request, loading stays true
  categoryId?: string;
  month?: number;
  year?: number;
  refreshKey?: number; // change to force a refetch (e.g. after the global Add sheet saves)
}

interface UseTransactionsReturn {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  loadMore: () => void;
  loadingMore: boolean;
  hasMore: boolean;
  totalCount: number;
}

export function useTransactions(options: UseTransactionsOptions = {}): UseTransactionsReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  const { limit = 10, walletId, walletIds, enabled = true, categoryId, month, year, refreshKey } = options;
  const { isOnline, saveOfflineData, getOfflineData } = useOffline();
  const latestRequest = useRef(0);

  const query = new URLSearchParams({ limit: limit.toString() });
  if (walletId) query.append('walletId', walletId);
  else if (walletIds && walletIds.length > 0) query.append('walletIds', walletIds.join(','));
  if (categoryId) query.append('categoryId', categoryId);
  if (month && year) {
    // Send the month as exact instants in the browser's timezone, so the server's timezone doesn't matter
    query.append('startDate', getStartOfMonth(year, month).toISOString());
    query.append('endDate', getEndOfMonth(year, month).toISOString());
  }
  const cacheKey = `transactions?${query.toString()}`;

  const fetchTransactions = async (pageToLoad: number) => {
    const append = pageToLoad > 1;
    // Only the newest request may write state, so a slow older query (e.g. a wallet swiped past) can't overwrite a newer one
    const request = ++latestRequest.current;
    const stale = () => request !== latestRequest.current;
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      // Offline: show what was cached for this exact query (first page only)
      if (!isOnline && !append) {
        const cachedTransactions = getOfflineData(cacheKey);
        if (cachedTransactions && cachedTransactions.length > 0) {
          setTransactions(cachedTransactions);
          setTotalCount(cachedTransactions.length);
          setHasMore(false);
          return;
        }
      }

      const response = await axios.get(`/api/transactions?${query.toString()}&page=${pageToLoad}`);
      if (stale()) return;
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
          icon: apiTransaction.category.icon,
        },
        transferId: apiTransaction.transferId,
        transfer: apiTransaction.transfer,
      }));

      setTransactions((prev) => (append ? [...prev, ...transformedTransactions] : transformedTransactions));
      setPage(pageToLoad);
      setTotalCount(data.pagination?.total || 0);
      setHasMore(pageToLoad * limit < (data.pagination?.total || 0));

      if (!append) {
        saveOfflineData(cacheKey, transformedTransactions);
      }
    } catch (err: any) {
      if (stale()) return;
      console.error('Failed to fetch transactions:', err);
      if (append) {
        toast.error(err.response?.data?.message || 'Failed to load more transactions');
        return;
      }

      // Fall back to what was cached for this exact query
      const cachedTransactions = getOfflineData(cacheKey);
      if (cachedTransactions && cachedTransactions.length > 0) {
        setTransactions(cachedTransactions);
        setTotalCount(cachedTransactions.length);
        setHasMore(false);
        setError('Using cached data - some information may be outdated');
      } else {
        // Don't keep showing the previous query's rows (e.g. last month's) under this one
        setTransactions([]);
        setTotalCount(0);
        setHasMore(false);
        setError(err.response?.data?.message || 'Failed to fetch transactions');
      }
    } finally {
      if (!stale()) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    if (!enabled) return;
    fetchTransactions(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, refreshKey, enabled]);

  return {
    transactions,
    loading,
    error,
    refetch: () => fetchTransactions(1),
    loadMore: () => fetchTransactions(page + 1),
    loadingMore,
    hasMore,
    totalCount,
  };
}
