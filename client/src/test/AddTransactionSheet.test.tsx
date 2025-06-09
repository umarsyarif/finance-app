import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AddTransactionSheet } from '@/components/finance/add-transaction-sheet';

// Simple mocks
vi.mock('@/hooks/use-transaction-form', () => ({
  useTransactionForm: () => ({
    form: {
      register: vi.fn(),
      handleSubmit: vi.fn(),
      formState: { errors: {} },
      setValue: vi.fn(),
      watch: vi.fn(),
      reset: vi.fn()
    },
    onSubmit: vi.fn(),
    loading: false
  })
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: any) => <div data-testid="sheet">{children}</div>,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <h2>{children}</h2>,
  SheetDescription: ({ children }: any) => <p>{children}</p>,
  SheetTrigger: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>
}));

vi.mock('@/components/finance/transaction-form', () => ({
  TransactionForm: () => <div data-testid="transaction-form">Transaction Form</div>
}));

describe('AddTransactionSheet', () => {
  it('renders without crashing', () => {
    render(<AddTransactionSheet type="INCOME" />);
    expect(screen.getByTestId('sheet')).toBeInTheDocument();
  });

  it('shows correct button text for income', () => {
    render(<AddTransactionSheet type="INCOME" />);
    expect(screen.getByText('Add Income')).toBeInTheDocument();
  });

  it('shows correct button text for expense', () => {
    render(<AddTransactionSheet type="EXPENSE" />);
    expect(screen.getByText('Add Expense')).toBeInTheDocument();
  });
});