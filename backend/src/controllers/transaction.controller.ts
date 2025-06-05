import { Request, Response, NextFunction } from 'express';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
  GetTransactionInput,
  DeleteTransactionInput,
  GetTransactionsInput,
} from '../schemas/transaction.schema';
import {
  createTransaction,
  findUniqueTransaction,
  findTransactions,
  updateTransaction,
  deleteTransaction,
  countTransactions,
} from '../services/transaction.service';
import AppError from '../utils/appError';

export const createTransactionHandler = async (
  req: Request<{}, {}, CreateTransactionInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { walletId, categoryId, amount, description, date } = req.body;
    
    const transaction = await createTransaction({
      wallet: {
        connect: { id: walletId },
      },
      category: {
        connect: { id: categoryId },
      },
      amount,
      description,
      date: new Date(date),
    });

    res.status(201).json({
      status: 'success',
      data: {
        transaction,
      },
    });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return next(new AppError(404, 'Wallet or Category not found'));
    }
    next(err);
  }
};

export const getTransactionHandler = async (
  req: Request<GetTransactionInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { transactionId } = req.params;

    const transaction = await findUniqueTransaction({ id: transactionId });

    if (!transaction) {
      return next(new AppError(404, 'Transaction not found'));
    }

    res.status(200).json({
      status: 'success',
      data: {
        transaction,
      },
    });
  } catch (err: any) {
    next(err);
  }
};

export const getTransactionsHandler = async (
  req: Request<{}, {}, {}, GetTransactionsInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { walletId, categoryId, page = 1, limit = 10 } = req.query;
    
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (walletId) where.walletId = walletId;
    if (categoryId) where.categoryId = categoryId;

    const [transactions, total] = await Promise.all([
      findTransactions(where, { createdAt: 'desc' }, skip, limitNum),
      countTransactions(where),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        transactions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err: any) {
    next(err);
  }
};

export const updateTransactionHandler = async (
  req: Request<UpdateTransactionInput['params'], {}, UpdateTransactionInput['body']>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { transactionId } = req.params;
    const { walletId, categoryId, amount, description, date } = req.body;

    const existingTransaction = await findUniqueTransaction({ id: transactionId });
    if (!existingTransaction) {
      return next(new AppError(404, 'Transaction not found'));
    }

    const updateData: any = {};
    if (walletId) updateData.wallet = { connect: { id: walletId } };
    if (categoryId) updateData.category = { connect: { id: categoryId } };
    if (amount !== undefined) updateData.amount = amount;
    if (description !== undefined) updateData.description = description;
    if (date) updateData.date = new Date(date);

    const transaction = await updateTransaction({ id: transactionId }, updateData);

    res.status(200).json({
      status: 'success',
      data: {
        transaction,
      },
    });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return next(new AppError(404, 'Transaction, Wallet or Category not found'));
    }
    next(err);
  }
};

export const deleteTransactionHandler = async (
  req: Request<DeleteTransactionInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { transactionId } = req.params;

    const existingTransaction = await findUniqueTransaction({ id: transactionId });
    if (!existingTransaction) {
      return next(new AppError(404, 'Transaction not found'));
    }

    await deleteTransaction({ id: transactionId });

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (err: any) {
    next(err);
  }
};