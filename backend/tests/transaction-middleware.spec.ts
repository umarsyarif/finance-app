import { PrismaClient } from '@prisma/client';
import prisma from '../src/middleware/prismaMiddleware';

// Mock data
const mockUser = {
  id: 'user123',
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashedpassword',
  role: 'user' as any,
  photo: 'default.png',
  verified: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockWallet = {
  id: 'wallet123',
  userId: 'user123',
  name: 'Test Wallet',
  currency: 'USD',
  balance: 1000.0,
  createdAt: new Date()
};

const mockIncomeCategory = {
  id: 'income-category123',
  userId: 'user123',
  name: 'Salary',
  type: 'INCOME' as any,
  createdAt: new Date()
};

const mockExpenseCategory = {
  id: 'expense-category123',
  userId: 'user123',
  name: 'Food',
  type: 'EXPENSE' as any,
  createdAt: new Date()
};

describe('Transaction Middleware - Wallet Balance Auto Update', () => {
  let userId: string;
  let walletId: string;
  let incomeCategoryId: string;
  let expenseCategoryId: string;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.transaction.deleteMany({ where: { wallet: { userId: mockUser.id } } });
    await prisma.wallet.deleteMany({ where: { userId: mockUser.id } });
    await prisma.category.deleteMany({ where: { userId: mockUser.id } });
    await prisma.user.deleteMany({ where: { id: mockUser.id } });

    // Create test user
    const user = await prisma.user.create({ data: mockUser });
    userId = user.id;

    // Create test wallet
    const wallet = await prisma.wallet.create({ data: mockWallet });
    walletId = wallet.id;

    // Create test categories
    const incomeCategory = await prisma.category.create({ data: mockIncomeCategory });
    const expenseCategory = await prisma.category.create({ data: mockExpenseCategory });
    incomeCategoryId = incomeCategory.id;
    expenseCategoryId = expenseCategory.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.transaction.deleteMany({ where: { wallet: { userId } } });
    await prisma.wallet.deleteMany({ where: { userId } });
    await prisma.category.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset wallet balance before each test
    await prisma.wallet.update({
      where: { id: walletId },
      data: { balance: 1000.0 }
    });
  });

  describe('Transaction Creation', () => {
    it('should increase wallet balance when income transaction is created', async () => {
      const incomeAmount = 500.0;
      
      // Create income transaction
      await prisma.transaction.create({
        data: {
          walletId,
          categoryId: incomeCategoryId,
          amount: incomeAmount,
          description: 'Salary payment',
          date: new Date()
        }
      });

      // Check wallet balance
      const updatedWallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      expect(updatedWallet?.balance).toBe(1500.0); // 1000 + 500
    });

    it('should decrease wallet balance when expense transaction is created', async () => {
      const expenseAmount = 200.0;
      
      // Create expense transaction
      await prisma.transaction.create({
        data: {
          walletId,
          categoryId: expenseCategoryId,
          amount: expenseAmount,
          description: 'Grocery shopping',
          date: new Date()
        }
      });

      // Check wallet balance
      const updatedWallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      expect(updatedWallet?.balance).toBe(800.0); // 1000 - 200
    });
  });

  describe('Transaction Update', () => {
    it('should adjust wallet balance when transaction amount is updated', async () => {
      // Create initial transaction
      const transaction = await prisma.transaction.create({
        data: {
          walletId,
          categoryId: expenseCategoryId,
          amount: 100.0,
          description: 'Initial expense',
          date: new Date()
        }
      });

      // Wallet balance should be 900 (1000 - 100)
      let wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      expect(wallet?.balance).toBe(900.0);

      // Update transaction amount
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { amount: 150.0 }
      });

      // Wallet balance should be 850 (1000 - 150)
      wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      expect(wallet?.balance).toBe(850.0);
    });

    it('should adjust wallet balance when transaction category type changes', async () => {
      // Create initial expense transaction
      const transaction = await prisma.transaction.create({
        data: {
          walletId,
          categoryId: expenseCategoryId,
          amount: 100.0,
          description: 'Initial expense',
          date: new Date()
        }
      });

      // Wallet balance should be 900 (1000 - 100)
      let wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      expect(wallet?.balance).toBe(900.0);

      // Change to income category
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { categoryId: incomeCategoryId }
      });

      // Wallet balance should be 1100 (1000 + 100)
      wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      expect(wallet?.balance).toBe(1100.0);
    });

    it('should handle wallet change correctly', async () => {
      // Create second wallet
      const secondWallet = await prisma.wallet.create({
        data: {
          id: 'wallet456',
          userId,
          name: 'Second Wallet',
          currency: 'USD',
          balance: 500.0,
          createdAt: new Date()
        }
      });

      // Create transaction in first wallet
      const transaction = await prisma.transaction.create({
        data: {
          walletId,
          categoryId: expenseCategoryId,
          amount: 100.0,
          description: 'Expense in first wallet',
          date: new Date()
        }
      });

      // First wallet balance should be 900 (1000 - 100)
      let firstWallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      expect(firstWallet?.balance).toBe(900.0);

      // Move transaction to second wallet
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { walletId: secondWallet.id }
      });

      // First wallet balance should be restored to 1000
      firstWallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      expect(firstWallet?.balance).toBe(1000.0);

      // Second wallet balance should be 400 (500 - 100)
      const updatedSecondWallet = await prisma.wallet.findUnique({ where: { id: secondWallet.id } });
      expect(updatedSecondWallet?.balance).toBe(400.0);

      // Clean up - delete transaction first to avoid foreign key constraint
      await prisma.transaction.delete({ where: { id: transaction.id } });
      await prisma.wallet.delete({ where: { id: secondWallet.id } });
    });
  });

  describe('Transaction Deletion', () => {
    it('should restore wallet balance when income transaction is deleted', async () => {
      // Create income transaction
      const transaction = await prisma.transaction.create({
        data: {
          walletId,
          categoryId: incomeCategoryId,
          amount: 300.0,
          description: 'Income to be deleted',
          date: new Date()
        }
      });

      // Wallet balance should be 1300 (1000 + 300)
      let wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      expect(wallet?.balance).toBe(1300.0);

      // Delete transaction
      await prisma.transaction.delete({ where: { id: transaction.id } });

      // Wallet balance should be restored to 1000
      wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      expect(wallet?.balance).toBe(1000.0);
    });

    it('should restore wallet balance when expense transaction is deleted', async () => {
      // Create expense transaction
      const transaction = await prisma.transaction.create({
        data: {
          walletId,
          categoryId: expenseCategoryId,
          amount: 250.0,
          description: 'Expense to be deleted',
          date: new Date()
        }
      });

      // Wallet balance should be 750 (1000 - 250)
      let wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      expect(wallet?.balance).toBe(750.0);

      // Delete transaction
      await prisma.transaction.delete({ where: { id: transaction.id } });

      // Wallet balance should be restored to 1000
      wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      expect(wallet?.balance).toBe(1000.0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple transactions correctly', async () => {
      // Create multiple transactions
      await prisma.transaction.create({
        data: {
          walletId,
          categoryId: incomeCategoryId,
          amount: 1000.0,
          description: 'Salary',
          date: new Date()
        }
      });

      await prisma.transaction.create({
        data: {
          walletId,
          categoryId: expenseCategoryId,
          amount: 200.0,
          description: 'Groceries',
          date: new Date()
        }
      });

      await prisma.transaction.create({
        data: {
          walletId,
          categoryId: expenseCategoryId,
          amount: 150.0,
          description: 'Gas',
          date: new Date()
        }
      });

      // Final balance should be 1000 + 1000 - 200 - 150 = 1650
      const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      expect(wallet?.balance).toBe(1650.0);
    });
  });
});