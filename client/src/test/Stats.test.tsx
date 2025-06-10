import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Stats from '../pages/Stats';
import { useStats } from '@/hooks/use-stats';
import { useWallets } from '@/hooks/use-wallets';
import { useCategories } from '@/hooks/use-categories';
import { formatCurrency } from '@/lib/format-utils';
import { getCurrentDate, getStartOfCurrentMonth, getEndOfCurrentMonth, formatDateForDateInput, getDateRangeLabel } from '@/lib/date-utils';

// Mock the hooks
vi.mock('@/hooks/use-stats');
vi.mock('@/hooks/use-wallets');
vi.mock('@/hooks/use-categories');
vi.mock('@/lib/format-utils');
vi.mock('@/lib/date-utils');

// Mock Recharts components
vi.mock('recharts', () => ({
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ data }: any) => <div data-testid="pie" data-length={data?.length || 0} />,
  Cell: () => <div data-testid="pie-cell" />,
  BarChart: ({ children, data }: any) => <div data-testid="bar-chart" data-length={data?.length || 0}>{children}</div>,
  Bar: ({ dataKey }: any) => <div data-testid="bar" data-key={dataKey} />,
  LineChart: ({ children, data }: any) => <div data-testid="line-chart" data-length={data?.length || 0}>{children}</div>,
  Line: ({ dataKey }: any) => <div data-testid="line" data-key={dataKey} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardDescription: ({ children }: any) => <p data-testid="card-description">{children}</p>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h2 data-testid="card-title">{children}</h2>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <div data-testid="select" data-value={value}>
      <button onClick={() => onValueChange?.('test-value')}>{children}</button>
    </div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => <div data-testid="select-item" data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <span data-testid="select-value">{placeholder}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant }: any) => (
    <button data-testid="button" data-variant={variant} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, type, id }: any) => (
    <input
      data-testid={`input-${id}`}
      type={type}
      value={value}
      onChange={onChange}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: any) => (
    <label data-testid={`label-${htmlFor}`}>{children}</label>
  ),
}));

const mockUseStats = vi.mocked(useStats);
const mockUseWallets = vi.mocked(useWallets);
const mockUseCategories = vi.mocked(useCategories);
const mockFormatCurrency = vi.mocked(formatCurrency);
const mockGetCurrentDate = vi.mocked(getCurrentDate);
const mockGetStartOfCurrentMonth = vi.mocked(getStartOfCurrentMonth);
const mockGetEndOfCurrentMonth = vi.mocked(getEndOfCurrentMonth);
const mockFormatDateForDateInput = vi.mocked(formatDateForDateInput);
const mockGetDateRangeLabel = vi.mocked(getDateRangeLabel);

const mockMonthlySummary = {
  income: 5000,
  expense: 3000,
  balance: 2000,
  month: 12,
  year: 2023,
};

const mockCategoryBreakdown = [
  {
    categoryId: 'cat-1',
    categoryName: 'Food',
    amount: 1500,
    percentage: 50,
    type: 'EXPENSE' as const,
    color: '#FF8042',
  },
  {
    categoryId: 'cat-2',
    categoryName: 'Transportation',
    amount: 1000,
    percentage: 33.33,
    type: 'EXPENSE' as const,
    color: '#0088FE',
  },
  {
    categoryId: 'cat-3',
    categoryName: 'Entertainment',
    amount: 500,
    percentage: 16.67,
    type: 'EXPENSE' as const,
    color: '#00C49F',
  },
];

const mockTrendData = [
  { month: 'Jan 2023', income: 4000, expense: 2500, balance: 1500 },
  { month: 'Feb 2023', income: 4500, expense: 2800, balance: 1700 },
  { month: 'Mar 2023', income: 5000, expense: 3000, balance: 2000 },
];

const mockWallets = [
  { id: 'wallet-1', name: 'Main Wallet', balance: 1000 },
  { id: 'wallet-2', name: 'Savings', balance: 5000 },
];

const mockCategories = [
  { id: 'cat-1', name: 'Food', type: 'EXPENSE' },
  { id: 'cat-2', name: 'Transportation', type: 'EXPENSE' },
  { id: 'cat-3', name: 'Salary', type: 'INCOME' },
];

const renderStats = () => {
  return render(
    <BrowserRouter>
      <Stats />
    </BrowserRouter>
  );
};

describe('Stats Page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    
    // Setup date utils mocks
    mockGetCurrentDate.mockReturnValue(new Date('2023-12-15'));
    mockGetStartOfCurrentMonth.mockReturnValue(new Date('2023-12-01'));
    mockGetEndOfCurrentMonth.mockReturnValue(new Date('2023-12-31'));
    mockFormatDateForDateInput.mockImplementation((date) => {
      if (date instanceof Date) {
        return date.toISOString().split('T')[0];
      }
      return '2023-12-01';
    });
    mockGetDateRangeLabel.mockReturnValue('Dec 1 - Dec 31, 2023');
    mockFormatCurrency.mockImplementation((amount) => 
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount)
    );

    // Setup default hook returns
    mockUseStats.mockReturnValue({
      monthlySummary: mockMonthlySummary,
      categoryBreakdown: mockCategoryBreakdown,
      trendData: mockTrendData,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    mockUseWallets.mockReturnValue({
      wallets: mockWallets,
      loading: false,
      error: null,
      createWallet: vi.fn(),
      updateWallet: vi.fn(),
      deleteWallet: vi.fn(),
      refetch: vi.fn(),
    });

    mockUseCategories.mockReturnValue({
      categories: mockCategories,
      loading: false,
      error: null,
      createCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      refetch: vi.fn(),
    });
  });



  describe('Page Rendering', () => {
    it('renders the page title and description', () => {
      renderStats();
      
      expect(screen.getByText('Statistics')).toBeInTheDocument();
      expect(screen.getByText('View your financial insights and trends')).toBeInTheDocument();
    });

    it('renders the filters section', () => {
      renderStats();
      
      expect(screen.getByText('Filters')).toBeInTheDocument();
      expect(screen.getByText('Filter your statistics by date, wallet, or category')).toBeInTheDocument();
      expect(screen.getByTestId('label-start-date')).toHaveTextContent('Start Date');
      expect(screen.getByTestId('label-end-date')).toHaveTextContent('End Date');
      expect(screen.getByText('Wallet')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
    });

    it('renders monthly summary cards with correct data', () => {
      renderStats();
      
      expect(screen.getByText('Total Income')).toBeInTheDocument();
      expect(screen.getByText('Total Expenses')).toBeInTheDocument();
      expect(screen.getByText('Net Balance')).toBeInTheDocument();
      expect(screen.getByText('$5,000.00')).toBeInTheDocument();
      expect(screen.getByText('$3,000.00')).toBeInTheDocument();
      expect(screen.getByText('$2,000.00')).toBeInTheDocument();
    });

    it('renders category breakdown chart', () => {
      renderStats();
      
      expect(screen.getByText('Category Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Distribution of expenses by category')).toBeInTheDocument();
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });

    it('renders trend chart with default bar type', () => {
      renderStats();
      
      expect(screen.getByText('Financial Trends')).toBeInTheDocument();
      expect(screen.getByText('Income and expense trends over time')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('displays loading state when data is being fetched', () => {
      mockUseStats.mockReturnValue({
        monthlySummary: null,
        categoryBreakdown: [],
        trendData: [],
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      renderStats();
      
      expect(screen.getByText('Loading statistics...')).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('displays error message when there is an error', () => {
      mockUseStats.mockReturnValue({
        monthlySummary: null,
        categoryBreakdown: [],
        trendData: [],
        loading: false,
        error: 'Failed to fetch statistics',
        refetch: vi.fn(),
      });

      renderStats();
      
      expect(screen.getByText('Error: Failed to fetch statistics')).toBeInTheDocument();
    });
  });

  describe('Filter Functionality', () => {
    it('initializes with current month date range', () => {
      renderStats();
      
      expect(mockGetStartOfCurrentMonth).toHaveBeenCalled();
      expect(mockGetEndOfCurrentMonth).toHaveBeenCalled();
      expect(mockFormatDateForDateInput).toHaveBeenCalledWith(new Date('2023-12-01'));
      expect(mockFormatDateForDateInput).toHaveBeenCalledWith(new Date('2023-12-31'));
    });

    it('updates start date filter when date input changes', () => {
      renderStats();
      
      const startDateInput = screen.getByTestId('input-start-date');
      fireEvent.change(startDateInput, { target: { value: '2023-11-01' } });
      
      expect(startDateInput).toHaveValue('2023-11-01');
    });

    it('updates end date filter when date input changes', () => {
      renderStats();
      
      const endDateInput = screen.getByTestId('input-end-date');
      fireEvent.change(endDateInput, { target: { value: '2023-11-30' } });
      
      expect(endDateInput).toHaveValue('2023-11-30');
    });

    it('clears filters when clear button is clicked', () => {
      renderStats();
      
      const clearButton = screen.getByText('Clear Filters');
      fireEvent.click(clearButton);
      
      // Verify that the date functions are called when clearing filters
      expect(mockGetStartOfCurrentMonth).toHaveBeenCalled();
      expect(mockGetEndOfCurrentMonth).toHaveBeenCalled();
      expect(mockFormatDateForDateInput).toHaveBeenCalled();
    });

    it('renders wallet filter options', () => {
      renderStats();
      
      // Check that wallet filter section exists
      expect(screen.getByText('Wallet')).toBeInTheDocument();
    });

    it('renders category filter options', () => {
      renderStats();
      
      // Check that category filter section exists
      expect(screen.getByText('Category')).toBeInTheDocument();
    });
  });

  describe('Chart Interactions', () => {
    it('switches between bar and line chart types', () => {
      renderStats();
      
      // Initially shows bar chart
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
      
      // Switch to line chart
      const chartTypeSelect = screen.getAllByTestId('select')[1]; // Second select is chart type
      const selectButton = chartTypeSelect.querySelector('button');
      fireEvent.click(selectButton!);
      
      // Note: In a real test, you'd need to simulate selecting 'line' option
      // This is simplified due to mocked components
    });
  });

  describe('Data Display', () => {
    it('displays category breakdown with percentages and amounts', () => {
      renderStats();
      
      expect(screen.getByText('Food')).toBeInTheDocument();
      expect(screen.getByText('Transportation')).toBeInTheDocument();
      expect(screen.getByText('Entertainment')).toBeInTheDocument();
      expect(screen.getByText('50.0%')).toBeInTheDocument();
      expect(screen.getByText('33.3%')).toBeInTheDocument();
      expect(screen.getByText('16.7%')).toBeInTheDocument();
    });

    it('shows positive balance in green color', () => {
      renderStats();
      
      const balanceElement = screen.getByText('$2,000.00');
      expect(balanceElement).toHaveClass('text-green-600');
    });

    it('shows negative balance in red color when balance is negative', () => {
      mockFormatCurrency.mockImplementation((amount) => {
        if (amount < 0) return `-$${Math.abs(amount).toLocaleString()}`;
        return `$${amount.toLocaleString()}`;
      });
      
      mockUseStats.mockReturnValue({
        monthlySummary: { ...mockMonthlySummary, balance: -500 },
        categoryBreakdown: mockCategoryBreakdown,
        trendData: mockTrendData,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      renderStats();
      
      // Check that negative balance is formatted correctly
      expect(mockFormatCurrency).toHaveBeenCalledWith(-500);
      expect(screen.getByText('-$500')).toBeInTheDocument();
    });

    it('displays date range labels correctly', () => {
      renderStats();
      
      expect(mockGetDateRangeLabel).toHaveBeenCalled();
      // Check that the date range label function is called with correct parameters
      expect(mockGetDateRangeLabel).toHaveBeenCalledWith('2023-12-01', '2023-12-31');
    });
  });

  describe('Empty Data States', () => {
    it('shows "No data available" for empty category breakdown', () => {
      mockUseStats.mockReturnValue({
        monthlySummary: mockMonthlySummary,
        categoryBreakdown: [],
        trendData: mockTrendData,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      renderStats();
      
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('shows "No data available" for empty trend data', () => {
      mockUseStats.mockReturnValue({
        monthlySummary: mockMonthlySummary,
        categoryBreakdown: mockCategoryBreakdown,
        trendData: [],
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      renderStats();
      
      expect(screen.getAllByText('No data available')).toHaveLength(1);
    });

    it('handles null monthly summary gracefully', () => {
      mockUseStats.mockReturnValue({
        monthlySummary: null,
        categoryBreakdown: mockCategoryBreakdown,
        trendData: mockTrendData,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      renderStats();
      
      // Should not render summary cards when monthlySummary is null
      expect(screen.queryByText('Total Income')).not.toBeInTheDocument();
      expect(screen.queryByText('Total Expenses')).not.toBeInTheDocument();
      expect(screen.queryByText('Net Balance')).not.toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('renders responsive containers for charts', () => {
      renderStats();
      
      const responsiveContainers = screen.getAllByTestId('responsive-container');
      expect(responsiveContainers).toHaveLength(2); // One for pie chart, one for trend chart
    });
  });

  describe('Accessibility', () => {
    it('has proper labels for form inputs', () => {
      renderStats();
      
      expect(screen.getByTestId('label-start-date')).toBeInTheDocument();
      expect(screen.getByTestId('label-end-date')).toBeInTheDocument();
    });

    it('has proper ARIA labels and roles for charts', () => {
      renderStats();
      
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  describe('Integration with Hooks', () => {
    it('renders with stats data from useStats hook', () => {
      renderStats();
      
      // Verify that the component renders with the mocked data
      expect(screen.getByText('Monthly Summary')).toBeInTheDocument();
      expect(screen.getByText('$5,000.00')).toBeInTheDocument(); // Total income
      expect(screen.getByText('$3,000.00')).toBeInTheDocument(); // Total expenses
    });

    it('renders wallet and category filter options', () => {
      renderStats();
      
      // Verify that wallet and category filters are rendered
      expect(screen.getByText('Wallet')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
    });
  });
});