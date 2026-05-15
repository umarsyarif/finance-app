import prisma, { applyBalanceOnCreate, applyBalanceOnDelete, applyBalanceOnUpdate } from '../middleware/prismaMiddleware';
import { Prisma } from '@prisma/client';

export const createTransaction = async (input: Prisma.TransactionCreateInput) => {
  return await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: input,
      include: { category: true, wallet: true },
    });
    await applyBalanceOnCreate(tx, {
      walletId: transaction.walletId,
      categoryId: transaction.categoryId,
      amount: transaction.amount.toNumber(),
    });
    return transaction;
  });
};

export const updateTransaction = async (
  where: Prisma.TransactionWhereUniqueInput,
  data: Prisma.TransactionUpdateInput
) => {
  return await prisma.$transaction(async (tx) => {
    const original = await tx.transaction.findUnique({
      where,
      include: { category: true, wallet: true },
    });
    if (!original) throw new Error('Transaction not found');

    const updated = await tx.transaction.update({
      where,
      data,
      include: { category: true, wallet: true },
    });
    await applyBalanceOnUpdate(tx, { ...original, amount: original.amount.toNumber() }, {
      walletId: updated.walletId,
      categoryId: updated.categoryId,
      amount: updated.amount.toNumber(),
    });
    return updated;
  });
};

export const deleteTransaction = async (where: Prisma.TransactionWhereUniqueInput) => {
  return await prisma.$transaction(async (tx) => {
    const original = await tx.transaction.findUnique({
      where,
      include: { category: true, wallet: true },
    });
    if (!original) throw new Error('Transaction not found');

    await applyBalanceOnDelete(tx, { ...original, amount: original.amount.toNumber() });
    return await tx.transaction.delete({ where });
  });
};

export const findUniqueTransaction = async (where: Prisma.TransactionWhereInput) => {
  return await prisma.transaction.findFirst({
    where,
    include: { category: true, wallet: true },
  });
};

export const findTransactions = async (
  where: Prisma.TransactionWhereInput,
  orderBy: Prisma.TransactionOrderByWithRelationInput,
  skip: number,
  take: number
) => {
  return await prisma.transaction.findMany({
    where,
    orderBy,
    skip,
    take,
    include: { category: true, wallet: true },
  });
};

export const countTransactions = async (where: Prisma.TransactionWhereInput) => {
  return await prisma.transaction.count({ where });
};

export const countTransactionsForWallet = async (walletId: string) => {
  return await prisma.transaction.count({ where: { walletId } });
};
