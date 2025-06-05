import { Request, Response, NextFunction } from 'express';
import * as transactionService from '../src/services/transaction.service';
import {
  createTransactionHandler,
  getTransactionHandler,
  getTransactionsHandler,
  updateTransactionHandler,
  deleteTransactionHandler
} from '../src/controllers/transaction.controller';

// Mock the modules
jest.mock('../src/services/transaction.service');

describe('Transaction Controller Tests', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {}
    };
    
    statusMock = jest.fn();
    jsonMock = jest.fn();
    statusMock.mockReturnValue({ json: jsonMock });
    res = {
      status: statusMock,
      locals: { user: { id: 'user123' } }
    };
    
    next = jest.fn() as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTransactionHandler', () => {
    it('should create a new transaction successfully', async () => {
      const transactionData = {
        walletId: 'wallet123',
        categoryId: 'category123',
        amount: 50.00,
        description: 'Lunch at restaurant',
        date: '2024-01-15T12:00:00.000Z'
      };

      const mockTransaction = {
        id: 'transaction123',
        walletId: 'wallet123',
        categoryId: 'category123',
        amount: 50.00,
        description: 'Lunch at restaurant',
        date: new Date('2024-01-15T12:00:00.000Z'),
        createdAt: new Date()
      };

      req.body = transactionData;
      (transactionService.createTransaction as jest.Mock).mockResolvedValue(mockTransaction);

      await createTransactionHandler(req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        data: {
          transaction: mockTransaction
        }
      });
    });

    it('should handle errors when creating transaction', async () => {
      const transactionData = {
        walletId: 'wallet123',
        categoryId: 'category123',
        amount: 50.00,
        description: 'Test transaction',
        date: '2024-01-15T12:00:00.000Z'
      };

      const error = new Error('Database error');
      req.body = transactionData;
      (transactionService.createTransaction as jest.Mock).mockRejectedValue(error);

      await createTransactionHandler(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getTransactionHandler', () => {
    it('should get a transaction successfully', async () => {
      const mockTransaction = {
        id: 'transaction123',
        walletId: 'wallet123',
        categoryId: 'category123',
        amount: 50.00,
        description: 'Lunch at restaurant',
        date: new Date('2024-01-15T12:00:00.000Z'),
        createdAt: new Date()
      };

      req.params = { transactionId: 'transaction123' };
      (transactionService.findUniqueTransaction as jest.Mock).mockResolvedValue(mockTransaction);

      await getTransactionHandler(req as Request<{transactionId: string}>, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        data: {
          transaction: mockTransaction
        }
      });
    });

    it('should handle transaction not found', async () => {
      req.params = { transactionId: 'nonexistent' };
      (transactionService.findUniqueTransaction as jest.Mock).mockResolvedValue(null);

      await getTransactionHandler(req as Request<{transactionId: string}>, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getTransactionsHandler', () => {
    it('should get all transactions successfully', async () => {
      const mockTransactions = [
        {
          id: 'transaction1',
          walletId: 'wallet123',
          categoryId: 'category123',
          amount: 50.00,
          description: 'Lunch at restaurant',
          date: new Date('2024-01-15T12:00:00.000Z'),
          createdAt: new Date()
        }
      ];

      req.query = { page: '1', limit: '10' };
      (transactionService.findTransactions as jest.Mock).mockResolvedValue(mockTransactions);
      (transactionService.countTransactions as jest.Mock).mockResolvedValue(mockTransactions.length);

      await getTransactionsHandler(req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        data: {
          transactions: mockTransactions,
          pagination: {
            page: 1,
            limit: 10,
            total: mockTransactions.length,
            pages: 1
          }
        }
      });
    });
  });

  describe('updateTransactionHandler', () => {
    it('should update a transaction successfully', async () => {
      const updateData = {
        amount: 75.00,
        description: 'Updated description'
      };

      const mockTransaction = {
        id: 'transaction123',
        walletId: 'wallet123',
        categoryId: 'category123',
        amount: 75.00,
        description: 'Updated description',
        date: new Date('2024-01-15T12:00:00.000Z'),
        createdAt: new Date()
      };

      req.params = { transactionId: 'transaction123' };
      req.body = updateData;
      (transactionService.findUniqueTransaction as jest.Mock).mockResolvedValue(mockTransaction);
      (transactionService.updateTransaction as jest.Mock).mockResolvedValue(mockTransaction);

      await updateTransactionHandler(req as Request<{transactionId: string}>, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        data: {
          transaction: mockTransaction
        }
      });
    });

    it('should handle transaction not found during update', async () => {
      const updateData = {
        amount: 75.00,
        description: 'Updated description'
      };

      req.params = { transactionId: 'nonexistent' };
      req.body = updateData;
      (transactionService.findUniqueTransaction as jest.Mock).mockResolvedValue(null);

      await updateTransactionHandler(req as Request<{transactionId: string}>, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteTransactionHandler', () => {
    it('should delete a transaction successfully', async () => {
      req.params = { transactionId: 'transaction123' };
      const mockDeletedTransaction = {
        id: 'transaction123',
        amount: 100,
        description: 'Test transaction',
        date: new Date(),
        createdAt: new Date(),
        walletId: 'wallet123',
        categoryId: 'category123',
        wallet: {
          id: 'wallet123',
          name: 'Test Wallet',
          balance: 1000,
          currency: 'USD',
          userId: 'user123',
          createdAt: new Date()
        },
        category: {
          id: 'category123',
          name: 'Test Category',
          type: 'expense' as any,
          userId: 'user123',
          createdAt: new Date()
        }
      };
      (transactionService.findUniqueTransaction as jest.Mock).mockResolvedValue(mockDeletedTransaction);
      (transactionService.deleteTransaction as jest.Mock).mockResolvedValue(mockDeletedTransaction);

      await deleteTransactionHandler(req as Request<{transactionId: string}>, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(204);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        data: null
      });
    });

    it('should handle transaction not found during delete', async () => {
      req.params = { transactionId: 'nonexistent' };
      (transactionService.findUniqueTransaction as jest.Mock).mockResolvedValue(null);

      await deleteTransactionHandler(req as Request<{transactionId: string}>, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});