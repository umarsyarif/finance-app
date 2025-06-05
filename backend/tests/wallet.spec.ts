import { Request, Response, NextFunction } from 'express';
import {
  createWalletHandler,
  getWalletsHandler,
  getWalletHandler,
  updateWalletHandler,
  deleteWalletHandler,
  getUserWalletsHandler
} from '../src/controllers/wallet.controller';
import {
  CreateWalletInput,
  GetWalletsInput,
  GetWalletInput,
  UpdateWalletInput,
  DeleteWalletInput
} from '../src/schemas/wallet.schema';
import * as walletService from '../src/services/wallet.service';
import * as jwt from '../src/utils/jwt';
import * as userService from '../src/services/user.service';

// Mock the modules
jest.mock('../src/services/wallet.service');
jest.mock('../src/utils/jwt');
jest.mock('../src/services/user.service');

describe('Wallet Controller Tests', () => {
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

  describe('createWalletHandler', () => {
    it('should create a new wallet successfully', async () => {
      const walletData = {
        name: 'Main Wallet',
        currency: 'USD',
        balance: 1000
      };

      const mockWallet = {
        id: 'wallet123',
        userId: 'user123',
        name: 'Main Wallet',
        currency: 'USD',
        balance: 1000,
        createdAt: new Date(),
        user: {
          id: 'user123',
          name: 'Test User',
          email: 'test@example.com'
        }
      };

      req.body = walletData;
      (walletService.createWallet as jest.Mock).mockResolvedValue(mockWallet);

      await createWalletHandler(req as Request, res as Response, next);

      expect(walletService.createWallet).toHaveBeenCalledWith({
        name: 'Main Wallet',
        currency: 'USD',
        balance: 1000,
        user: {
          connect: { id: 'user123' }
        }
      });
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        data: {
          wallet: mockWallet
        }
      });
    });

    it('should handle duplicate wallet name error', async () => {
      const walletData = {
        name: 'Main Wallet',
        currency: 'USD',
        balance: 1000
      };

      req.body = walletData;
      const error = new Error('Duplicate entry');
      (error as any).code = 'P2002';
      (walletService.createWallet as jest.Mock).mockRejectedValue(error);

      await createWalletHandler(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 409,
        message: 'Wallet with that name already exists'
      }));
    });
  });

  describe('getWalletHandler', () => {
    it('should get a wallet successfully', async () => {
      const mockWallet = {
        id: 'wallet123',
        userId: 'user123',
        name: 'Main Wallet',
        currency: 'USD',
        balance: 1000,
        createdAt: new Date(),
        user: {
          id: 'user123',
          name: 'Test User',
          email: 'test@example.com'
        },
        transactions: []
      };

      req.params = { walletId: 'wallet123' };
      (walletService.findWalletById as jest.Mock).mockResolvedValue(mockWallet);

      await getWalletHandler(req as Request<GetWalletInput>, res as Response, next);

      expect(walletService.findWalletById).toHaveBeenCalledWith('wallet123');
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        data: {
          wallet: mockWallet
        }
      });
    });

    it('should return 404 if wallet not found', async () => {
      req.params = { walletId: 'nonexistent' };
      (walletService.findWalletById as jest.Mock).mockResolvedValue(null);

      await getWalletHandler(req as Request<GetWalletInput>, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 404,
        message: 'Wallet not found'
      }));
    });

    it('should return 403 if wallet does not belong to user', async () => {
      const mockWallet = {
        id: 'wallet123',
        userId: 'otheruser',
        name: 'Main Wallet',
        currency: 'USD',
        balance: 1000
      };

      req.params = { walletId: 'wallet123' };
      (walletService.findWalletById as jest.Mock).mockResolvedValue(mockWallet);

      await getWalletHandler(req as Request<GetWalletInput>, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 403,
        message: 'Access denied'
      }));
    });
  });

  describe('getWalletsHandler', () => {
    it('should get all wallets for user', async () => {
      const mockWallets = [
        {
          id: 'wallet1',
          userId: 'user123',
          name: 'Main Wallet',
          currency: 'USD',
          balance: 1000,
          createdAt: new Date(),
          user: {
            id: 'user123',
            name: 'Test User',
            email: 'test@example.com'
          },
          _count: {
            transactions: 5
          }
        },
        {
          id: 'wallet2',
          userId: 'user123',
          name: 'Savings',
          currency: 'USD',
          balance: 5000,
          createdAt: new Date(),
          user: {
            id: 'user123',
            name: 'Test User',
            email: 'test@example.com'
          },
          _count: {
            transactions: 2
          }
        }
      ];

      (walletService.findWallets as jest.Mock).mockResolvedValue(mockWallets);

      await getWalletsHandler(req as Request, res as Response, next);

      expect(walletService.findWallets).toHaveBeenCalledWith(
        { userId: 'user123' },
        { createdAt: 'desc' }
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        results: 2,
        data: {
          wallets: mockWallets
        }
      });
    });

    it('should filter wallets by currency', async () => {
      const mockWallets = [
        {
          id: 'wallet1',
          userId: 'user123',
          name: 'EUR Wallet',
          currency: 'EUR',
          balance: 1000,
          createdAt: new Date()
        }
      ];

      req.query = { currency: 'EUR' };
      (walletService.findWallets as jest.Mock).mockResolvedValue(mockWallets);

      await getWalletsHandler(req as Request, res as Response, next);

      expect(walletService.findWallets).toHaveBeenCalledWith(
        { userId: 'user123', currency: 'EUR' },
        { createdAt: 'desc' }
      );
    });
  });

  describe('updateWalletHandler', () => {
    it('should update a wallet successfully', async () => {
      const existingWallet = {
        id: 'wallet123',
        userId: 'user123',
        name: 'Main Wallet',
        currency: 'USD',
        balance: 1000
      };

      const updatedWallet = {
        ...existingWallet,
        name: 'Updated Wallet',
        balance: 1500
      };

      req.params = { walletId: 'wallet123' };
      req.body = { name: 'Updated Wallet', balance: 1500 };
      (walletService.findWalletById as jest.Mock).mockResolvedValue(existingWallet);
      (walletService.updateWallet as jest.Mock).mockResolvedValue(updatedWallet);

      await updateWalletHandler(req as Request<UpdateWalletInput['params'], {}, UpdateWalletInput['body']>, res as Response, next);

      expect(walletService.updateWallet).toHaveBeenCalledWith('wallet123', {
        name: 'Updated Wallet',
        balance: 1500
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        data: {
          wallet: updatedWallet
        }
      });
    });

    it('should return 404 if wallet not found', async () => {
      req.params = { walletId: 'nonexistent' };
      req.body = { name: 'Updated Wallet' };
      (walletService.findWalletById as jest.Mock).mockResolvedValue(null);

      await updateWalletHandler(req as Request<UpdateWalletInput['params'], {}, UpdateWalletInput['body']>, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 404,
        message: 'Wallet not found'
      }));
    });

    it('should return 403 if wallet does not belong to user', async () => {
      const existingWallet = {
        id: 'wallet123',
        userId: 'otheruser',
        name: 'Main Wallet'
      };

      req.params = { walletId: 'wallet123' };
      req.body = { name: 'Updated Wallet' };
      (walletService.findWalletById as jest.Mock).mockResolvedValue(existingWallet);

      await updateWalletHandler(req as Request<UpdateWalletInput['params'], {}, UpdateWalletInput['body']>, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 403,
        message: 'Access denied'
      }));
    });
  });

  describe('deleteWalletHandler', () => {
    it('should delete a wallet successfully', async () => {
      const existingWallet = {
        id: 'wallet123',
        userId: 'user123',
        name: 'Main Wallet',
        transactions: []
      };

      req.params = { walletId: 'wallet123' };
      (walletService.findWalletById as jest.Mock).mockResolvedValue(existingWallet);
      (walletService.deleteWallet as jest.Mock).mockResolvedValue(undefined);

      await deleteWalletHandler(req as Request<DeleteWalletInput>, res as Response, next);

      expect(walletService.deleteWallet).toHaveBeenCalledWith('wallet123');
      expect(statusMock).toHaveBeenCalledWith(204);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        data: null
      });
    });

    it('should return 404 if wallet not found', async () => {
      req.params = { walletId: 'nonexistent' };
      (walletService.findWalletById as jest.Mock).mockResolvedValue(null);

      await deleteWalletHandler(req as Request<DeleteWalletInput>, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 404,
        message: 'Wallet not found'
      }));
    });

    it('should return 403 if wallet does not belong to user', async () => {
      const existingWallet = {
        id: 'wallet123',
        userId: 'otheruser',
        name: 'Main Wallet'
      };

      req.params = { walletId: 'wallet123' };
      (walletService.findWalletById as jest.Mock).mockResolvedValue(existingWallet);

      await deleteWalletHandler(req as Request<DeleteWalletInput>, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 403,
        message: 'Access denied'
      }));
    });

    it('should return 400 if wallet has transactions', async () => {
      const existingWallet = {
        id: 'wallet123',
        userId: 'user123',
        name: 'Main Wallet',
        transactions: [{ id: 'transaction1' }]
      };

      req.params = { walletId: 'wallet123' };
      (walletService.findWalletById as jest.Mock).mockResolvedValue(existingWallet);

      await deleteWalletHandler(req as Request<DeleteWalletInput>, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 400,
        message: 'Cannot delete wallet with existing transactions'
      }));
    });
  });

  describe('getUserWalletsHandler', () => {
    it('should get user wallets successfully', async () => {
      const mockWallets = [
        {
          id: 'wallet1',
          userId: 'user123',
          name: 'Main Wallet',
          currency: 'USD',
          balance: 1000,
          _count: {
            transactions: 5
          }
        },
        {
          id: 'wallet2',
          userId: 'user123',
          name: 'Savings',
          currency: 'USD',
          balance: 5000,
          _count: {
            transactions: 2
          }
        }
      ];

      (walletService.findWalletsByUserId as jest.Mock).mockResolvedValue(mockWallets);

      await getUserWalletsHandler(req as Request, res as Response, next);

      expect(walletService.findWalletsByUserId).toHaveBeenCalledWith('user123');
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'success',
        results: 2,
        data: {
          wallets: mockWallets
        }
      });
    });
  });
});