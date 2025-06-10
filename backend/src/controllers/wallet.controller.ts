import { NextFunction, Request, Response } from 'express';
import {
  CreateWalletInput,
  GetWalletsInput,
  GetWalletInput,
  UpdateWalletInput,
  DeleteWalletInput,
} from '../schemas/wallet.schema';
import {
  createWallet,
  findWallets,
  findWalletById,
  updateWallet,
  deleteWallet,
  countWallets,
  findWalletsByUserId,
  findMainWallet,
  setMainWallet,
  updateWalletOrder,
} from '../services/wallet.service';
import AppError from '../utils/appError';

export const createWalletHandler = async (
  req: Request<{}, {}, CreateWalletInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = res.locals.user.id;
    const { name, currency, balance, color } = req.body;

    const wallet = await createWallet({
      name,
      currency,
      balance,
      color,
      user: {
        connect: { id: userId },
      },
    });

    res.status(201).json({
      status: 'success',
      data: {
        wallet,
      },
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return next(new AppError(409, 'Wallet with that name already exists'));
    }
    next(err);
  }
};

export const getWalletHandler = async (
  req: Request<GetWalletInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { walletId } = req.params;
    const userId = res.locals.user.id;

    const wallet = await findWalletById(walletId);

    if (!wallet) {
      return next(new AppError(404, 'Wallet not found'));
    }

    // Check if wallet belongs to the user
    if (wallet.userId !== userId) {
      return next(new AppError(403, 'Access denied'));
    }

    res.status(200).json({
      status: 'success',
      data: {
        wallet,
      },
    });
  } catch (err: any) {
    next(err);
  }
};

export const getWalletsHandler = async (
  req: Request<{}, {}, {}, GetWalletsInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = res.locals.user.id;
    const { currency } = req.query;

    const where: any = { userId };
    if (currency) where.currency = currency;

    const wallets = await findWallets(where, { createdAt: 'desc' });

    res.status(200).json({
      status: 'success',
      results: wallets.length,
      data: {
        wallets,
      },
    });
  } catch (err: any) {
    next(err);
  }
};

export const updateWalletHandler = async (
  req: Request<UpdateWalletInput['params'], {}, UpdateWalletInput['body']>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { walletId } = req.params;
    const userId = res.locals.user.id;
    const { name, currency, balance, color } = req.body;

    // Check if wallet exists and belongs to user
    const existingWallet = await findWalletById(walletId);
    if (!existingWallet) {
      return next(new AppError(404, 'Wallet not found'));
    }

    if (existingWallet.userId !== userId) {
      return next(new AppError(403, 'Access denied'));
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (currency !== undefined) updateData.currency = currency;
    if (balance !== undefined) updateData.balance = balance;
    if (color !== undefined) updateData.color = color;

    const wallet = await updateWallet(walletId, updateData);

    res.status(200).json({
      status: 'success',
      data: {
        wallet,
      },
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return next(new AppError(409, 'Wallet with that name already exists'));
    }
    next(err);
  }
};

export const deleteWalletHandler = async (
  req: Request<DeleteWalletInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { walletId } = req.params;
    const userId = res.locals.user.id;

    // Check if wallet exists and belongs to user
    const existingWallet = await findWalletById(walletId);
    if (!existingWallet) {
      return next(new AppError(404, 'Wallet not found'));
    }

    if (existingWallet.userId !== userId) {
      return next(new AppError(403, 'Access denied'));
    }

    // Check if wallet has transactions
    if (existingWallet.transactions && existingWallet.transactions.length > 0) {
      return next(new AppError(400, 'Cannot delete wallet with existing transactions'));
    }

    await deleteWallet(walletId);

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (err: any) {
    next(err);
  }
};

export const getUserWalletsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = res.locals.user.id;

    const wallets = await findWalletsByUserId(userId);

    res.status(200).json({
      status: 'success',
      results: wallets.length,
      data: {
        wallets,
      },
    });
  } catch (err: any) {
    next(err);
  }
};

export const getMainWalletHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = res.locals.user.id;

    const mainWallet = await findMainWallet(userId);

    if (!mainWallet) {
      return next(new AppError(404, 'Main wallet not found'));
    }

    res.status(200).json({
      status: 'success',
      data: {
        wallet: mainWallet,
      },
    });
  } catch (err: any) {
    next(err);
  }
};

export const setMainWalletHandler = async (
  req: Request<{ walletId: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = res.locals.user.id;
    const { walletId } = req.params;

    // Check if wallet belongs to the user
    const wallet = await findWalletById(walletId);
    if (!wallet || wallet.userId !== userId) {
      return next(new AppError(404, 'Wallet not found or access denied'));
    }

    const mainWallet = await setMainWallet(userId, walletId);

    res.status(200).json({
      status: 'success',
      data: {
        wallet: mainWallet,
      },
    });
  } catch (err: any) {
    next(err);
  }
};

export const updateWalletOrderHandler = async (
  req: Request<{}, {}, { walletOrders: { id: string; displayOrder: number }[] }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = res.locals.user.id;
    const { walletOrders } = req.body;

    // Verify all wallets belong to the user
    const walletIds = walletOrders.map(w => w.id);
    const userWallets = await findWallets({ userId, id: { in: walletIds } });
    
    if (userWallets.length !== walletIds.length) {
      return next(new AppError(403, 'Some wallets do not belong to the user'));
    }

    await updateWalletOrder(userId, walletOrders);

    res.status(200).json({
      status: 'success',
      message: 'Wallet order updated successfully',
    });
  } catch (err: any) {
    next(err);
  }
};