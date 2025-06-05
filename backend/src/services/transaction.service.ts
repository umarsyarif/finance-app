import { PrismaClient, Prisma, Transaction } from '@prisma/client';

const prisma = new PrismaClient();

export const createTransaction = async (input: Prisma.TransactionCreateInput) => {
  return (await prisma.transaction.create({
    data: input,
    include: {
      wallet: true,
      category: true,
    },
  })) as Transaction;
};

export const findTransaction = async (
  where: Prisma.TransactionWhereInput,
  select?: Prisma.TransactionSelect
) => {
  if (select) {
    return (await prisma.transaction.findFirst({
      where,
      select,
    })) as Transaction;
  }
  return (await prisma.transaction.findFirst({
    where,
    include: {
      wallet: true,
      category: true,
    },
  })) as Transaction;
};

export const findUniqueTransaction = async (
  where: Prisma.TransactionWhereUniqueInput,
  select?: Prisma.TransactionSelect
) => {
  if (select) {
    return (await prisma.transaction.findUnique({
      where,
      select,
    })) as Transaction;
  }
  return (await prisma.transaction.findUnique({
    where,
    include: {
      wallet: true,
      category: true,
    },
  })) as Transaction;
};

export const findTransactions = async (
  where: Prisma.TransactionWhereInput = {},
  orderBy: Prisma.TransactionOrderByWithRelationInput = { createdAt: 'desc' },
  skip?: number,
  take?: number
) => {
  return await prisma.transaction.findMany({
    where,
    orderBy,
    skip,
    take,
    include: {
      wallet: true,
      category: true,
    },
  });
};

export const updateTransaction = async (
  where: Prisma.TransactionWhereUniqueInput,
  data: Prisma.TransactionUpdateInput,
  select?: Prisma.TransactionSelect
) => {
  if (select) {
    return (await prisma.transaction.update({
      where,
      data,
      select,
    })) as Transaction;
  }
  return (await prisma.transaction.update({
    where,
    data,
    include: {
      wallet: true,
      category: true,
    },
  })) as Transaction;
};

export const deleteTransaction = async (
  where: Prisma.TransactionWhereUniqueInput
) => {
  return await prisma.transaction.delete({
    where,
    include: {
      wallet: true,
      category: true,
    },
  });
};

export const countTransactions = async (
  where: Prisma.TransactionWhereInput = {}
) => {
  return await prisma.transaction.count({
    where,
  });
};