import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Wallets } from '../pages/Wallets';
import { useWallets } from '../hooks/use-wallets';
import { useCategories } from '../hooks/use-categories';
import axios from '@/lib/axios';
import { toast } from 'sonner';

// Mock the hooks
vi.mock('../hooks/use-wallets');
vi.mock('../hooks/use-categories');
vi.mock('../lib/axios');
vi.mock('sonner');

// Mock the format utils
vi.mock('../lib/format-utils', () => ({
  formatAmount: (amount: number, _type?: string | null, currency: string = 'KRW') => {
    const symbol = currency === 'KRW' ? '₩' : currency === 'IDR' ? 'Rp' : currency;
    return `${symbol}${amount.toFixed(2)}`;
  },
}));

// Mock the page header components
vi.mock('../components/page-header', () => ({
  PageHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="page-header">{children}</div>,
  PageHeaderHeading: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}));

// Mock the tabs components
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, defaultValue }: { children: React.ReactNode; defaultValue: string }) => (
    <div data-testid="tabs" data-default-value={defaultValue}>{children}</div>
  ),
  TabsList: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children, value, onClick }: { children: React.ReactNode; value: string; onClick?: () => void }) => (
    <button data-testid={`tab-${value}`} onClick={onClick}>{children}</button>
  ),
  TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid={`tab-content-${value}`}>{children}</div>
  ),
}));

// Mock the form components
vi.mock('../components/finance/wallet-form', () => ({
  WalletForm: ({ onSuccess }: { onSuccess: () => void }) => (
    <div data-testid="wallet-form">
      <button onClick={onSuccess} data-testid="submit-wallet">Submit Wallet</button>
    </div>
  ),
}));

vi.mock('../components/finance/category-form', () => ({
  CategoryForm: ({ onSuccess }: { onSuccess: () => void }) => (
    <div data-testid="category-form">
      <button onClick={onSuccess} data-testid="submit-category">Submit Category</button>
    </div>
  ),
}));

const mockWallets = [
  {
    id: '1',
    name: 'Main Wallet',
    balance: 1000,
    currency: 'USD',
    type: 'checking',
  },
  {
    id: '2',
    name: 'Savings',
    balance: 5000,
    currency: 'USD',
    type: 'savings',
  },
];

const mockCategories = [
  {
    id: '1',
    name: 'Food',
    type: 'EXPENSE',
    color: '#ff0000',
  },
  {
    id: '2',
    name: 'Salary',
    type: 'INCOME',
    color: '#00ff00',
  },
];

const mockUseWallets = {
  wallets: mockWallets,
  loading: false,
  error: null,
  refetch: vi.fn(),
};

const mockUseCategories = {
  categories: mockCategories,
  loading: false,
  error: null,
  refetch: vi.fn(),
};

describe('Wallets Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useWallets as any).mockReturnValue(mockUseWallets);
    (useCategories as any).mockReturnValue(mockUseCategories);
    (axios.delete as any).mockResolvedValue({ data: {} });
    (toast.success as any).mockImplementation(() => {});
    (toast.error as any).mockImplementation(() => {});
  });

  it('renders the page title', () => {
    render(<Wallets />);
    expect(screen.getByText('Wallets & Categories')).toBeInTheDocument();
  });

  it('displays wallets', () => {
    render(<Wallets />);
    expect(screen.getByText('Main Wallet')).toBeInTheDocument();
    expect(screen.getByText('Savings')).toBeInTheDocument();
  });

  it('displays loading state', () => {
    (useWallets as any).mockReturnValue({
      ...mockUseWallets,
      loading: true,
    });
    
    render(<Wallets />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays error state for wallets', () => {
    (useWallets as any).mockReturnValue({
      ...mockUseWallets,
      error: 'Failed to load wallets',
    });
    
    render(<Wallets />);
    expect(screen.getByText('Error: Failed to load wallets')).toBeInTheDocument();
  });

  it('displays error state for categories', () => {
    (useCategories as any).mockReturnValue({
      ...mockUseCategories,
      error: 'Failed to load categories',
    });
    
    render(<Wallets />);
    expect(screen.getByText('Error: Failed to load categories')).toBeInTheDocument();
  });

  it('opens wallet creation dialog', () => {
    render(<Wallets />);
    
    const addButton = screen.getByText('Add Wallet');
    fireEvent.click(addButton);
    
    expect(screen.getByTestId('wallet-form')).toBeInTheDocument();
  });

  it('handles wallet form success', () => {
    render(<Wallets />);
    
    // Open wallet dialog
    const addButton = screen.getByText('Add Wallet');
    fireEvent.click(addButton);
    
    // Submit form
    const submitButton = screen.getByTestId('submit-wallet');
    fireEvent.click(submitButton);
    
    expect(mockUseWallets.refetch).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Wallet created successfully');
  });

  it('switches to categories tab', () => {
    render(<Wallets />);
    
    const categoriesTab = screen.getByTestId('tab-categories');
    expect(categoriesTab).toBeInTheDocument();
    expect(screen.getByTestId('tab-content-categories')).toBeInTheDocument();
  });

  it('opens category creation dialog', () => {
    render(<Wallets />);
    
    // Categories content should be visible
    expect(screen.getByTestId('tab-content-categories')).toBeInTheDocument();
    
    const addButton = screen.getByText('Add Category');
    fireEvent.click(addButton);
    
    expect(screen.getByTestId('category-form')).toBeInTheDocument();
  });

  it('handles category form success', () => {
    render(<Wallets />);
    
    // Categories content should be visible
    expect(screen.getByTestId('tab-content-categories')).toBeInTheDocument();
    
    const addButton = screen.getByText('Add Category');
    fireEvent.click(addButton);
    
    expect(screen.getByTestId('category-form')).toBeInTheDocument();
    
    // Submit form
    const submitButton = screen.getByTestId('submit-category');
    fireEvent.click(submitButton);
    
    expect(mockUseCategories.refetch).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Category created successfully');
  });

  it('displays empty state when no wallets exist', () => {
    (useWallets as any).mockReturnValue({
      ...mockUseWallets,
      wallets: [],
    });
    
    render(<Wallets />);
    expect(screen.getByText('No wallets found')).toBeInTheDocument();
  });

  it('displays empty state when no categories exist', () => {
    (useCategories as any).mockReturnValue({
      ...mockUseCategories,
      categories: [],
    });
    
    render(<Wallets />);
    
    // Categories content should be visible
    expect(screen.getByTestId('tab-content-categories')).toBeInTheDocument();
    expect(screen.getByText('No categories found')).toBeInTheDocument();
  });
});