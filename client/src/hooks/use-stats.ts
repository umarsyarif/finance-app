import { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import { useOffline } from '@/hooks/use-offline';

interface MonthlySummary {
  income: number;
  expense: number;
  balance: number;
  month: number;
  year: number;
}

interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  type: 'INCOME' | 'EXPENSE';
  color: string;
}

interface TrendData {
  month: string;
  income: number;
  expense: number;
  balance: number;
}

interface StatsFilters {
  refreshKey?: number; // change to force a refetch
  startDate?: string;
  endDate?: string;
  walletIds?: string[];
  categoryId?: string;
  year?: number;
  month?: number;
}

interface UseStatsReturn {
  monthlySummary: MonthlySummary | null;
  categoryBreakdown: CategoryBreakdown[];
  trendData: TrendData[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useStats(filters: StatsFilters = {}): UseStatsReturn {
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isOnline, saveOfflineData, getOfflineData } = useOffline();

  const fetchStats = async () => {
    // Set once the query (and so the cache keys) is known; used for offline and error fallback
    let useCached = () => false;
    try {
      setLoading(true);
      setError(null);

      // Build query parameters. Date-only filters ("2026-10-01") become exact instants in the
      // browser's timezone, so the server's timezone doesn't decide which day a transaction is on.
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', new Date(`${filters.startDate}T00:00:00`).toISOString());
      if (filters.endDate) params.append('endDate', new Date(`${filters.endDate}T23:59:59.999`).toISOString());
      if (filters.walletIds && filters.walletIds.length > 0) {
        // Send multiple wallet IDs as comma-separated values
        params.append('walletIds', filters.walletIds.join(','));
      }
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.year) params.append('year', filters.year.toString());
      if (filters.month) params.append('month', filters.month.toString());

      // The trend chart covers the whole (local) year of the selected range
      const trendYear = filters.year || (filters.startDate ? Number(filters.startDate.slice(0, 4)) : new Date().getFullYear());
      const trendParams = new URLSearchParams({
        startDate: new Date(trendYear, 0, 1).toISOString(),
        endDate: new Date(trendYear, 11, 31, 23, 59, 59, 999).toISOString(),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (filters.walletIds && filters.walletIds.length > 0) trendParams.append('walletIds', filters.walletIds.join(','));
      if (filters.categoryId) trendParams.append('categoryId', filters.categoryId);

      // Cache entries are per query so offline never shows another filter's numbers
      const summaryKey = `stats-summary?${params}`;
      const breakdownKey = `stats-breakdown?${params}`;
      const trendKey = `stats-trend?${trendParams}`;
      useCached = () => {
        const cachedSummary = getOfflineData(summaryKey);
        const cachedBreakdown = getOfflineData(breakdownKey);
        const cachedTrend = getOfflineData(trendKey);
        if (!cachedSummary && !cachedBreakdown && !cachedTrend) return false;
        setMonthlySummary(cachedSummary || null);
        setCategoryBreakdown(cachedBreakdown || []);
        setTrendData(cachedTrend || []);
        return true;
      };

      if (!isOnline && useCached()) {
        return;
      }

      // Fetch all stats data in parallel
      const [summaryResponse, breakdownResponse, trendResponse] = await Promise.all([
        axios.get(`/api/stats/monthly-summary?${params.toString()}`),
        axios.get(`/api/stats/category-breakdown?${params.toString()}`),
        axios.get(`/api/stats/trend?${trendParams.toString()}`)
      ]);

      const summary = summaryResponse.data.data || null;
      const breakdown = breakdownResponse.data.data || [];
      const trend = trendResponse.data.data || [];

      setMonthlySummary(summary);
      setCategoryBreakdown(breakdown);
      setTrendData(trend);

      saveOfflineData(summaryKey, summary);
      saveOfflineData(breakdownKey, breakdown);
      saveOfflineData(trendKey, trend);
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
      
      // Try to use cached data for this exact query on error
      if (useCached()) {
        setError('Using cached data - some information may be outdated');
      } else {
        setError(err.response?.data?.message || 'Failed to fetch statistics');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [filters.startDate, filters.endDate, JSON.stringify(filters.walletIds), filters.categoryId, filters.year, filters.month, filters.refreshKey]);

  return {
    monthlySummary,
    categoryBreakdown,
    trendData,
    loading,
    error,
    refetch: fetchStats,
  };
}