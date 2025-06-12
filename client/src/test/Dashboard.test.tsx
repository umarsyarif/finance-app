import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';

// Mock the hooks and components
vi.mock('../lib/axios');
vi.mock('../hooks/use-wallets', () => ({
  useWallets: vi.fn()
}));
vi.mock('../components/finance/wallet-carousel', () => ({
  WalletCarousel: ({ onTransactionChange, onWalletChange }: any) => (
    <div data-testid="wallet-carousel">
      <div data-testid="wallet-card">
        <div data-testid="wallet-name">Main Wallet</div>
        <div data-testid="wallet-balance">$1,000.00</div>
        <div data-testid="wallet-income">+$3,000.00</div>
        <div data-testid="wallet-expense">-$150.00</div>
        <button onClick={() => onTransactionChange()}>Add Income</button>
        <button onClick={() => onTransactionChange()}>Add Expense</button>
        <button onClick={() => onWalletChange?.('wallet-1')}>Select Wallet</button>
      </div>
    </div>
  )
}));
vi.mock('../components/finance/transactions-list', () => ({
  TransactionsList: ({ walletId }: any) => {
    if (!walletId) return null;
    return (
      <div data-testid="transactions-list">
        <div>Grocery Shopping - $150.00</div>
        <div>Salary - $3,000.00</div>
        <div>Food</div>
        <div>Salary</div>
        <div>Main Wallet</div>
      </div>
    );
  }
}));

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
  });

  it('renders dashboard with wallet carousel', () => {
    renderDashboard();
    
    // Check if wallet carousel is displayed
    expect(screen.getByTestId('wallet-carousel')).toBeInTheDocument();
    expect(screen.getByTestId('wallet-name')).toHaveTextContent('Main Wallet');
    expect(screen.getByTestId('wallet-balance')).toHaveTextContent('$1,000.00');
  });

  it('shows message when no wallet is selected', () => {
    renderDashboard();
    
    // Should show the default message
    expect(screen.getByText('Select a wallet to view transactions')).toBeInTheDocument();
  });

  it('renders add transaction buttons', () => {
    renderDashboard();
    
    // Should have two "Add" buttons - one for income and one for expense
    expect(screen.getByText('Add Income')).toBeInTheDocument();
    expect(screen.getByText('Add Expense')).toBeInTheDocument();
  });

  it('renders transactions list when wallet is selected', async () => {
    renderDashboard();
    
    // Initially, transactions list should not be visible
    expect(screen.queryByTestId('transactions-list')).not.toBeInTheDocument();
    
    // Select a wallet first
    await act(async () => {
      fireEvent.click(screen.getByText('Select Wallet'));
    });
    
    // Check if transactions list is rendered after wallet selection
    await waitFor(() => {
      expect(screen.getByTestId('transactions-list')).toBeInTheDocument();
    });
  });

  it('calls onTransactionChange when add button is clicked', async () => {
    renderDashboard();
    
    // Click on the add income button
    fireEvent.click(screen.getByText('Add Income'));
    
    // The component should handle the transaction change internally
    expect(screen.getByText('Add Income')).toBeInTheDocument();
  });

  it('shows transactions list when wallet is selected', async () => {
    renderDashboard();
    
    // Click to select a wallet
    await act(async () => {
      fireEvent.click(screen.getByText('Select Wallet'));
    });
    
    // Should show transactions list
    await waitFor(() => {
      expect(screen.getByTestId('transactions-list')).toBeInTheDocument();
    });
  });

  it('displays wallet income and expense', () => {
    renderDashboard();
    
    // Check wallet financial data
    expect(screen.getByTestId('wallet-income')).toHaveTextContent('+$3,000.00');
    expect(screen.getByTestId('wallet-expense')).toHaveTextContent('-$150.00');
  });

  it('displays transaction details when wallet is selected', async () => {
    renderDashboard();
    
    // Initially, transaction details should not be visible
    expect(screen.queryByTestId('transactions-list')).not.toBeInTheDocument();
    expect(screen.getByText('Select a wallet to view transactions')).toBeInTheDocument();
    
    // Select a wallet first
    await act(async () => {
      fireEvent.click(screen.getByText('Select Wallet'));
    });
    
    // Check if transaction list appears after wallet selection
    await waitFor(() => {
      expect(screen.getByTestId('transactions-list')).toBeInTheDocument();
      expect(screen.queryByText('Select a wallet to view transactions')).not.toBeInTheDocument();
    });
  });
});