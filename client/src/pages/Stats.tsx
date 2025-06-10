import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useStats } from '@/hooks/use-stats';
import { useWallets } from '@/hooks/use-wallets';
import { useCategories } from '@/hooks/use-categories';
import { CalendarIcon, TrendingUpIcon, TrendingDownIcon, DollarSignIcon, FilterIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/format-utils';
import { getStartOfCurrentMonth, getEndOfCurrentMonth, formatDateForDateInput, getDateRangeLabel } from '@/lib/date-utils';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

interface StatsFilters {
  startDate: string;
  endDate: string;
  walletIds: string[];
  categoryId: string;
  year: number;
  month: number;
}

export default function Stats() {
  // Initialize filters with current month
  const startOfMonth = getStartOfCurrentMonth();
  const endOfMonth = getEndOfCurrentMonth();
  
  const [filters, setFilters] = useState<Partial<StatsFilters>>({
    startDate: formatDateForDateInput(startOfMonth),
    endDate: formatDateForDateInput(endOfMonth),
  });
  const [tempFilters, setTempFilters] = useState<Partial<StatsFilters>>({
    startDate: formatDateForDateInput(startOfMonth),
    endDate: formatDateForDateInput(endOfMonth),
  });
  const [showFilters, setShowFilters] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  const { monthlySummary, categoryBreakdown, trendData, loading, error } = useStats(filters);
  const { wallets, getMainWallet } = useWallets();
  const { categories } = useCategories();

  // Set main wallet as initial value when wallets are loaded
  useEffect(() => {
    const mainWallet = getMainWallet();
    if (mainWallet && !tempFilters.walletIds) {
      const initialWalletIds = [mainWallet.id];
      setTempFilters(prev => ({
        ...prev,
        walletIds: initialWalletIds
      }));
      setFilters(prev => ({
        ...prev,
        walletIds: initialWalletIds
      }));
    }
  }, [wallets, getMainWallet, tempFilters.walletIds]);

  const handleTempFilterChange = (key: keyof StatsFilters, value: string | number | string[]) => {
    setTempFilters(prev => ({
      ...prev,
      [key]: Array.isArray(value) ? value : (value === 'all' ? undefined : value)
    }));
  };

  const handleWalletChange = (selectedWalletIds: string[]) => {
    handleTempFilterChange('walletIds', selectedWalletIds);
  };

  const applyFilters = () => {
    setFilters(tempFilters);
  };

  const clearFilters = () => {
    const startOfMonth = getStartOfCurrentMonth();
    const endOfMonth = getEndOfCurrentMonth();
    const mainWallet = getMainWallet();
    const defaultFilters = {
      startDate: formatDateForDateInput(startOfMonth),
      endDate: formatDateForDateInput(endOfMonth),
      walletIds: mainWallet ? [mainWallet.id] : [],
    };
    setTempFilters(defaultFilters);
    setFilters(defaultFilters);
  };
  
  const toggleFilters = () => {
    setShowFilters(prev => !prev);
  };

  // Get currency from selected wallets
  const selectedCurrency = useMemo(() => {
    if (!filters.walletIds || filters.walletIds.length === 0) {
      const mainWallet = getMainWallet();
      return mainWallet?.currency || 'USD';
    }
    
    const selectedWallet = wallets.find(wallet => filters.walletIds?.includes(wallet.id));
    return selectedWallet?.currency || 'USD';
  }, [filters.walletIds, wallets, getMainWallet]);





  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading statistics...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-500">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Statistics</h1>
            <p className="text-muted-foreground">
              View your financial insights and trends
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFilters}
            className="flex items-center gap-2"
          >
            <FilterIcon className="h-4 w-4" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Filters
            </CardTitle>
            <CardDescription>
              Filter your statistics by date, wallet, or category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <DatePicker
                  date={tempFilters.startDate ? new Date(tempFilters.startDate) : undefined}
                  onSelect={(date) => handleTempFilterChange('startDate', date ? formatDateForDateInput(date) : '')}
                  placeholder="Select start date"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <DatePicker
                  date={tempFilters.endDate ? new Date(tempFilters.endDate) : undefined}
                  onSelect={(date) => handleTempFilterChange('endDate', date ? formatDateForDateInput(date) : '')}
                  placeholder="Select end date"
                />
              </div>

              <div className="space-y-2">
                <Label>Wallets</Label>
                <MultiSelect
                  options={wallets.map((wallet) => ({
                    label: wallet.name,
                    value: wallet.id,
                    currency: wallet.currency,
                    color: wallet.color
                  }))}
                  onValueChange={handleWalletChange}
                  value={tempFilters.walletIds || []}
                  placeholder="Select wallets (same currency only)"
                  maxCount={2}
                  className="w-full"
                  closeOnSelect={false}
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={tempFilters.categoryId || 'all'}
                  onValueChange={(value) => handleTempFilterChange('categoryId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name} ({category.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={applyFilters}>
                Apply Filters
              </Button>
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Summary */}
      {monthlySummary && (
        <>
          <div className="mb-4">
            <h2 className="text-2xl font-bold">Monthly Summary</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Income</CardTitle>
              <TrendingUpIcon className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(monthlySummary.income, selectedCurrency)}
              </div>
              <p className="text-xs text-muted-foreground">
                {getDateRangeLabel(filters.startDate, filters.endDate)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <TrendingDownIcon className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(monthlySummary.expense, selectedCurrency)}
              </div>
              <p className="text-xs text-muted-foreground">
                {getDateRangeLabel(filters.startDate, filters.endDate)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
              <DollarSignIcon className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                monthlySummary.balance >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(monthlySummary.balance, selectedCurrency)}
              </div>
              <p className="text-xs text-muted-foreground">
                {getDateRangeLabel(filters.startDate, filters.endDate)}
              </p>
            </CardContent>
          </Card>
        </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>
              Distribution of expenses by category
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="amount"
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name, props) => [
                        formatCurrency(Number(value), selectedCurrency), 
                        props.payload.categoryName
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="grid grid-cols-1 gap-2">
                  {categoryBreakdown.map((entry, index) => (
                    <div key={entry.categoryId} className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="flex-1 truncate">{entry.categoryName}</span>
                      <span className="font-medium">{entry.percentage.toFixed(1)}%</span>
                      <span className="text-muted-foreground">{formatCurrency(entry.amount, selectedCurrency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trend Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Financial Trends</CardTitle>
                <CardDescription>
                  Income and expense trends over time
                </CardDescription>
              </div>
              <Select value={chartType} onValueChange={(value: 'bar' | 'line') => setChartType(value)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="line">Line</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                {chartType === 'bar' ? (
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value), selectedCurrency)} />
                    <Legend />
                    <Bar dataKey="income" fill="#10b981" name="Income" />
                    <Bar dataKey="expense" fill="#ef4444" name="Expense" />
                  </BarChart>
                ) : (
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value), selectedCurrency)} />
                    <Legend />
                    <Line type="monotone" dataKey="income" stroke="#10b981" name="Income" strokeWidth={2} />
                    <Line type="monotone" dataKey="expense" stroke="#ef4444" name="Expense" strokeWidth={2} />
                    <Line type="monotone" dataKey="balance" stroke="#3b82f6" name="Balance" strokeWidth={2} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}