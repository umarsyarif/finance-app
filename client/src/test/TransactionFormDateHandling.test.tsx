import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransactionForm } from '@/hooks/use-transaction-form';

// Mock axios
vi.mock('@/lib/axios', () => ({
  default: {
    post: vi.fn(),
    patch: vi.fn(),
    get: vi.fn(),
  },
}));

// Mock the hooks
vi.mock('@/hooks/use-wallets', () => ({
  useWallets: () => ({
    wallets: [
      { id: 'wallet-1', name: 'Main Wallet', currency: 'USD' },
      { id: 'wallet-2', name: 'Savings', currency: 'EUR' },
    ],
    loading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/use-categories', () => ({
  useCategories: () => ({
    categories: [
      { id: 'cat-1', name: 'Food', type: 'EXPENSE' as const, color: '#ff0000' },
      { id: 'cat-2', name: 'Salary', type: 'INCOME' as const, color: '#00ff00' },
    ],
    loading: false,
    error: null,
  }),
}));

const mockTransaction = {
  id: 'trans-1',
  title: 'Grocery Shopping',
  walletId: 'wallet-1',
  categoryId: 'cat-1',
  amount: 150.50,
  description: 'Grocery shopping',
  date: '2024-01-15T14:30:00.000Z',
  type: 'EXPENSE' as const,
};

describe('Transaction Form Date Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('New Transaction', () => {
    it('initializes with current date and time', () => {
      const { result } = renderHook(() => useTransactionForm({}));
      
      // Should initialize with current date/time in ISO format
      expect(result.current.formData.date).toBeDefined();
      expect(typeof result.current.formData.date).toBe('string');
      expect(result.current.formData.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      
      // Should be close to current time (within 1 minute)
      const formDate = new Date(result.current.formData.date);
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - formDate.getTime());
      expect(timeDiff).toBeLessThan(60000); // Less than 1 minute
    });

    it('resets to current date and time when form is reset', () => {
      const { result } = renderHook(() => useTransactionForm({}));
      
      // Change the date
      act(() => {
        result.current.updateField('date', '2023-12-01T10:00:00.000Z');
      });
      
      expect(result.current.formData.date).toBe('2023-12-01T10:00:00.000Z');
      
      // Reset the form
      act(() => {
        result.current.resetForm();
      });
      
      // Should reset to current date/time
      expect(result.current.formData.date).toBeDefined();
      const formDate = new Date(result.current.formData.date);
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - formDate.getTime());
      expect(timeDiff).toBeLessThan(60000); // Less than 1 minute
    });
  });

  describe('Edit Transaction', () => {
    it('preserves original transaction date when editing', () => {
      const { result } = renderHook(() => useTransactionForm({ transaction: mockTransaction }));
      
      // Should use the exact original date from the transaction
      expect(result.current.formData.date).toBe(mockTransaction.date);
    });

    it('maintains date precision when editing transaction', () => {
      const preciseDate = '2024-01-15T14:30:45.123Z';
      const transactionWithPreciseDate = {
        ...mockTransaction,
        date: preciseDate,
      };
      
      const { result } = renderHook(() => useTransactionForm({ transaction: transactionWithPreciseDate }));
      
      // Should preserve the exact date including milliseconds
      expect(result.current.formData.date).toBe(preciseDate);
    });

    it('handles different timezone dates correctly', () => {
      const timezoneDate = '2024-01-15T22:30:00.000Z'; // UTC time
      const transactionWithTimezone = {
        ...mockTransaction,
        date: timezoneDate,
      };
      
      const { result } = renderHook(() => useTransactionForm({ transaction: transactionWithTimezone }));
      
      // Should preserve the exact UTC date
      expect(result.current.formData.date).toBe(timezoneDate);
      
      // Verify it's a valid date
      const parsedDate = new Date(result.current.formData.date);
      expect(parsedDate.toISOString()).toBe(timezoneDate);
    });
  });

  describe('Date Updates', () => {
    it('updates date field correctly', () => {
      const { result } = renderHook(() => useTransactionForm({}));
      
      const newDate = '2024-02-20T16:45:00.000Z';
      
      act(() => {
        result.current.updateField('date', newDate);
      });
      
      expect(result.current.formData.date).toBe(newDate);
    });

    it('handles date updates from datetime picker', () => {
      const { result } = renderHook(() => useTransactionForm({}));
      
      // Simulate datetime picker providing a Date object converted to ISO string
      const pickerDate = new Date('2024-03-10T09:15:30.000Z');
      const isoString = pickerDate.toISOString();
      
      act(() => {
        result.current.updateField('date', isoString);
      });
      
      expect(result.current.formData.date).toBe(isoString);
    });
  });

  describe('Form Submission', () => {
    it('submits date in ISO format for new transaction', async () => {
      const mockPost = vi.fn().mockResolvedValue({ data: { success: true } });
      const axios = await import('@/lib/axios');
      (axios.default.post as any).mockImplementation(mockPost);
      
      const { result } = renderHook(() => useTransactionForm({}));
      
      // Set form data
      act(() => {
        result.current.updateField('walletId', 'wallet-1');
        result.current.updateField('categoryId', 'cat-1');
        result.current.updateField('amount', '100');
        result.current.updateField('description', 'Test transaction');
        result.current.updateField('date', '2024-01-15T14:30:00.000Z');
      });
      
      // Submit form
      await act(async () => {
        await result.current.submitForm();
      });
      
      // Verify the date is submitted in ISO format
      expect(mockPost).toHaveBeenCalledWith('/api/transactions', {
        title: '',
        walletId: 'wallet-1',
        categoryId: 'cat-1',
        amount: 100,
        description: 'Test transaction',
        date: '2024-01-15T14:30:00.000Z',
      });
    });

    it('submits date in ISO format for updated transaction', async () => {
      const mockPatch = vi.fn().mockResolvedValue({ data: { success: true } });
      const axios = await import('@/lib/axios');
      (axios.default.patch as any).mockImplementation(mockPatch);
      
      const { result } = renderHook(() => useTransactionForm({ transaction: mockTransaction }));
      
      // Update the date
      act(() => {
        result.current.updateField('date', '2024-01-16T10:00:00.000Z');
      });
      
      // Submit form
      await act(async () => {
        await result.current.submitForm();
      });
      
      // Verify the updated date is submitted in ISO format
      expect(mockPatch).toHaveBeenCalledWith(`/api/transactions/${mockTransaction.id}`, {
        title: mockTransaction.title,
        walletId: mockTransaction.walletId,
        categoryId: mockTransaction.categoryId,
        amount: mockTransaction.amount,
        description: mockTransaction.description,
        date: '2024-01-16T10:00:00.000Z',
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined transaction gracefully', () => {
      const { result } = renderHook(() => useTransactionForm({}));
      
      // Should initialize with current date
      expect(result.current.formData.date).toBeDefined();
      expect(typeof result.current.formData.date).toBe('string');
    });

    it('handles transaction with missing date', () => {
      const transactionWithoutDate = {
        ...mockTransaction,
        date: undefined as any,
      };
      
      const { result } = renderHook(() => useTransactionForm({ transaction: transactionWithoutDate }));
      
      // Should fallback to current date
      expect(result.current.formData.date).toBeDefined();
      expect(typeof result.current.formData.date).toBe('string');
    });

    it('handles invalid date strings', () => {
      const transactionWithInvalidDate = {
        ...mockTransaction,
        date: 'invalid-date-string',
      };
      
      const { result } = renderHook(() => useTransactionForm({ transaction: transactionWithInvalidDate }));
      
      // Should fallback to current date for invalid date strings
      expect(result.current.formData.date).toBeDefined();
      expect(typeof result.current.formData.date).toBe('string');
      
      // Should be a valid ISO string
      expect(() => new Date(result.current.formData.date)).not.toThrow();
    });
  });
});