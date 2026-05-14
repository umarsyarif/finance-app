import { applyBalanceOnCreate, applyBalanceOnDelete, applyBalanceOnUpdate } from '../src/middleware/prismaMiddleware';

// Mock Prisma tx object
const mockTx = {
  category: {
    findUnique: jest.fn(),
  },
  wallet: {
    update: jest.fn(),
  },
};

describe('Balance Helper Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.wallet.update.mockResolvedValue({});
  });

  describe('applyBalanceOnCreate', () => {
    it('should increase wallet balance when income transaction is created', async () => {
      mockTx.category.findUnique.mockResolvedValue({ type: 'INCOME' });

      await applyBalanceOnCreate(mockTx as any, {
        walletId: 'wallet123',
        categoryId: 'income-category123',
        amount: 500,
      });

      expect(mockTx.wallet.update).toHaveBeenCalledWith({
        where: { id: 'wallet123' },
        data: { balance: { increment: 500 } },
      });
    });

    it('should decrease wallet balance when expense transaction is created', async () => {
      mockTx.category.findUnique.mockResolvedValue({ type: 'EXPENSE' });

      await applyBalanceOnCreate(mockTx as any, {
        walletId: 'wallet123',
        categoryId: 'expense-category123',
        amount: 200,
      });

      expect(mockTx.wallet.update).toHaveBeenCalledWith({
        where: { id: 'wallet123' },
        data: { balance: { increment: -200 } },
      });
    });

    it('should do nothing if category not found', async () => {
      mockTx.category.findUnique.mockResolvedValue(null);

      await applyBalanceOnCreate(mockTx as any, {
        walletId: 'wallet123',
        categoryId: 'nonexistent',
        amount: 100,
      });

      expect(mockTx.wallet.update).not.toHaveBeenCalled();
    });
  });

  describe('applyBalanceOnDelete', () => {
    it('should restore wallet balance when income transaction is deleted', async () => {
      await applyBalanceOnDelete(mockTx as any, {
        walletId: 'wallet123',
        amount: 300,
        category: { type: 'INCOME' },
      });

      expect(mockTx.wallet.update).toHaveBeenCalledWith({
        where: { id: 'wallet123' },
        data: { balance: { increment: -300 } },
      });
    });

    it('should restore wallet balance when expense transaction is deleted', async () => {
      await applyBalanceOnDelete(mockTx as any, {
        walletId: 'wallet123',
        amount: 250,
        category: { type: 'EXPENSE' },
      });

      expect(mockTx.wallet.update).toHaveBeenCalledWith({
        where: { id: 'wallet123' },
        data: { balance: { increment: 250 } },
      });
    });
  });

  describe('applyBalanceOnUpdate', () => {
    it('should adjust wallet balance when transaction amount is updated', async () => {
      mockTx.category.findUnique.mockResolvedValue({ type: 'EXPENSE' });

      await applyBalanceOnUpdate(
        mockTx as any,
        { walletId: 'wallet123', amount: 100, category: { type: 'EXPENSE' } },
        { walletId: 'wallet123', categoryId: 'expense-category123', amount: 150 }
      );

      // diff = (-150) - (-100) = -50
      expect(mockTx.wallet.update).toHaveBeenCalledWith({
        where: { id: 'wallet123' },
        data: { balance: { increment: -50 } },
      });
    });

    it('should adjust wallet balance when transaction category type changes', async () => {
      mockTx.category.findUnique.mockResolvedValue({ type: 'INCOME' });

      await applyBalanceOnUpdate(
        mockTx as any,
        { walletId: 'wallet123', amount: 100, category: { type: 'EXPENSE' } },
        { walletId: 'wallet123', categoryId: 'income-category123', amount: 100 }
      );

      // original: -100 (expense), new: +100 (income), diff = 100 - (-100) = 200
      expect(mockTx.wallet.update).toHaveBeenCalledWith({
        where: { id: 'wallet123' },
        data: { balance: { increment: 200 } },
      });
    });

    it('should handle wallet change correctly', async () => {
      mockTx.category.findUnique.mockResolvedValue({ type: 'EXPENSE' });

      await applyBalanceOnUpdate(
        mockTx as any,
        { walletId: 'wallet123', amount: 100, category: { type: 'EXPENSE' } },
        { walletId: 'wallet456', categoryId: 'expense-category123', amount: 100 }
      );

      // Revert from old wallet: -(-100) = +100
      expect(mockTx.wallet.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'wallet123' },
        data: { balance: { increment: 100 } },
      });

      // Apply to new wallet: -100
      expect(mockTx.wallet.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'wallet456' },
        data: { balance: { increment: -100 } },
      });
    });

    it('should do nothing if diff is zero', async () => {
      mockTx.category.findUnique.mockResolvedValue({ type: 'INCOME' });

      await applyBalanceOnUpdate(
        mockTx as any,
        { walletId: 'wallet123', amount: 100, category: { type: 'INCOME' } },
        { walletId: 'wallet123', categoryId: 'income-category123', amount: 100 }
      );

      expect(mockTx.wallet.update).not.toHaveBeenCalled();
    });
  });
});
