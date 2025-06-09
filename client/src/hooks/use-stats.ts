import { useState, useEffect } from 'react';
import axios from '@/lib/axios';

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
  walletId?: string;
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

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.walletId) params.append('walletId', filters.walletId);
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.year) params.append('year', filters.year.toString());
      if (filters.month) params.append('month', filters.month.toString());

      // Fetch all stats data in parallel
      const [summaryResponse, breakdownResponse, trendResponse] = await Promise.all([
        axios.get(`/api/stats/monthly-summary?${params.toString()}`),
        axios.get(`/api/stats/category-breakdown?${params.toString()}`),
        axios.get(`/api/stats/trend?${params.toString()}`)
      ]);

      setMonthlySummary(summaryResponse.data.data || null);
      setCategoryBreakdown(breakdownResponse.data.data || []);
      setTrendData(trendResponse.data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
      setError(err.response?.data?.message || 'Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [filters.startDate, filters.endDate, filters.walletId, filters.categoryId, filters.year, filters.month]);

  return {
    monthlySummary,
    categoryBreakdown,
    trendData,
    loading,
    error,
    refetch: fetchStats,
  };
}