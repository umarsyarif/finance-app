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
    try {
      setLoading(true);
      setError(null);

      // Try to get cached data first if offline
      if (!isOnline) {
        const cachedSummary = getOfflineData('stats-summary');
        const cachedBreakdown = getOfflineData('stats-breakdown');
        const cachedTrend = getOfflineData('stats-trend');
        
        if (cachedSummary || cachedBreakdown || cachedTrend) {
          setMonthlySummary(cachedSummary || null);
          setCategoryBreakdown(cachedBreakdown || []);
          setTrendData(cachedTrend || []);
          setLoading(false);
          return;
        }
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.walletIds && filters.walletIds.length > 0) {
        // Send multiple wallet IDs as comma-separated values
        params.append('walletIds', filters.walletIds.join(','));
      }
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.year) params.append('year', filters.year.toString());
      if (filters.month) params.append('month', filters.month.toString());

      // Fetch all stats data in parallel
      const [summaryResponse, breakdownResponse, trendResponse] = await Promise.all([
        axios.get(`/api/stats/monthly-summary?${params.toString()}`),
        axios.get(`/api/stats/category-breakdown?${params.toString()}`),
        axios.get(`/api/stats/trend?${params.toString()}`)
      ]);

      const summary = summaryResponse.data.data || null;
      const breakdown = breakdownResponse.data.data || [];
      const trend = trendResponse.data.data || [];

      setMonthlySummary(summary);
      setCategoryBreakdown(breakdown);
      setTrendData(trend);

      // Save to offline cache when online
      if (isOnline) {
        saveOfflineData('stats-summary', summary);
        saveOfflineData('stats-breakdown', breakdown);
        saveOfflineData('stats-trend', trend);
      }
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
      
      // Try to use cached data on error
      const cachedSummary = getOfflineData('stats-summary');
      const cachedBreakdown = getOfflineData('stats-breakdown');
      const cachedTrend = getOfflineData('stats-trend');
      
      if (cachedSummary || cachedBreakdown || cachedTrend) {
        setMonthlySummary(cachedSummary || null);
        setCategoryBreakdown(cachedBreakdown || []);
        setTrendData(cachedTrend || []);
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
  }, [filters.startDate, filters.endDate, JSON.stringify(filters.walletIds), filters.categoryId, filters.year, filters.month]);

  return {
    monthlySummary,
    categoryBreakdown,
    trendData,
    loading,
    error,
    refetch: fetchStats,
  };
}