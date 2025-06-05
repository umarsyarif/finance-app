import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import * as useBalanceHook from '../hooks/use-balance';

// Mock the hooks
vi.mock('../hooks/use-balance');
vi.mock('../lib/axios');
vi.mock('../components/finance/balance-card', () => ({
  BalanceCard: ({ balance, income, expense, onTransactionChange }: any) => (
    <div data-testid="balance-card">
      <div data-testid="total-balance">{balance}</div>
      <div data-testid="income">{income}</div>
      <div data-testid="expense">{expense}</div>
      <button onClick={() => onTransactionChange()}>Add Income</button>
      <button onClick={() => onTransactionChange()}>Add Expense</button>
    </div>
  )
}));
vi.mock('../components/finance/transactions-list', () => ({
  TransactionsList: ({ limit, showSeeAllLink, onTransactionChange }: any) => (
    <div data-testid="transactions-list">
      <div>Grocery Shopping - $150.00</div>
      <div>Salary - $3,000.00</div>
      <div>Food</div>
      <div>Salary</div>
      <div>Main Wallet</div>
    </div>
  )
}));

const mockBalance = {
  totalBalance: 1000.00,
  totalIncome: 3000.00,
  totalExpense: 150.00,
  currency: 'USD'
};

const renderDashboard = () => {
  return render(
    <BrowserRouter>
      <Dashboard />
    </BrowserRouter>
  );
};

describe('Dashboard', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock useBalance hook
    vi.mocked(useBalanceHook.useBalance).mockReturnValue({
      balance: mockBalance,
      loading: false,
      error: null,
      refetch: vi.fn()
    });
  });

  it('renders dashboard with balance cards', () => {
    renderDashboard();
    
    // Check if balance amounts are displayed
    expect(screen.getByTestId('total-balance')).toHaveTextContent('USD 1000.00');
    expect(screen.getByTestId('income')).toHaveTextContent('+USD 3000.00');
    expect(screen.getByTestId('expense')).toHaveTextContent('-USD 150.00');
  });

  it('renders add transaction buttons', () => {
    renderDashboard();
    
    // Should have two "Add" buttons - one for income and one for expense
    expect(screen.getByText('Add Income')).toBeInTheDocument();
    expect(screen.getByText('Add Expense')).toBeInTheDocument();
  });

  it('renders transactions list', () => {
    renderDashboard();
    
    // Check if transactions are displayed
    expect(screen.getByText('Grocery Shopping - $150.00')).toBeInTheDocument();
    expect(screen.getByText('Salary - $3,000.00')).toBeInTheDocument();
  });

  it('calls onTransactionChange when add button is clicked', async () => {
    const mockRefetch = vi.fn();
    vi.mocked(useBalanceHook.useBalance).mockReturnValue({
      balance: mockBalance,
      loading: false,
      error: null,
      refetch: mockRefetch
    });
    
    renderDashboard();
    
    // Click on the add income button
    fireEvent.click(screen.getByText('Add Income'));
    
    // The onTransactionChange should be called, which calls refetch
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('displays loading state when data is loading', () => {
    // Mock loading state
    vi.mocked(useBalanceHook.useBalance).mockReturnValue({
      balance: null,
      loading: true,
      error: null,
      refetch: vi.fn()
    });
    
    renderDashboard();
    
    // Check for loading spinner
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays error state when there is an error', () => {
    const mockRefetch = vi.fn();
    // Mock error state
    vi.mocked(useBalanceHook.useBalance).mockReturnValue({
      balance: null,
      loading: false,
      error: 'Failed to fetch balance',
      refetch: mockRefetch
    });
    
    renderDashboard();
    
    expect(screen.getByText('Failed to fetch balance')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    
    // Test retry functionality
    fireEvent.click(screen.getByText('Try Again'));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('calculates correct income and expense totals', () => {
    renderDashboard();
    
    // Income total should be 3000.00
    expect(screen.getByTestId('income')).toHaveTextContent('+USD 3000.00');
    
    // Expense total should be 150.00
    expect(screen.getByTestId('expense')).toHaveTextContent('-USD 150.00');
  });

  it('displays transactions correctly', () => {
    renderDashboard();
    
    // Should display both income and expense transactions
    expect(screen.getByText('Grocery Shopping - $150.00')).toBeInTheDocument(); // Expense
    expect(screen.getByText('Salary - $3,000.00')).toBeInTheDocument(); // Income
  });

  it('handles empty balance data', () => {
    // Mock null balance
    vi.mocked(useBalanceHook.useBalance).mockReturnValue({
      balance: null,
      loading: false,
      error: null,
      refetch: vi.fn()
    });
    
    renderDashboard();
    
    // Should show default values
    expect(screen.getByTestId('total-balance')).toHaveTextContent('$0.00');
    expect(screen.getByTestId('income')).toHaveTextContent('+$0.00');
    expect(screen.getByTestId('expense')).toHaveTextContent('-$0.00');
  });

  it('displays transaction categories', () => {
    renderDashboard();
    
    // Check if category names are displayed
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('Salary')).toBeInTheDocument();
  });

  it('displays wallet information', () => {
    renderDashboard();
    
    // Check if wallet name is displayed in transactions
    expect(screen.getByText('Main Wallet')).toBeInTheDocument();
  });
});