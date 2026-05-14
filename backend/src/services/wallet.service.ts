import { Prisma } from '@prisma/client';
import prisma from '../middleware/prismaMiddleware';

export const createWallet = async (
  input: Prisma.WalletCreateInput
) => {
  return await prisma.wallet.create({
    data: input,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
};

export const findWalletById = async (id: string) => {
  return await prisma.wallet.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      transactions: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
        include: {
          category: true,
        },
      },
    },
  });
};

export const findWallets = async (
  where: Prisma.WalletWhereInput = {},
  orderBy: Prisma.WalletOrderByWithRelationInput = { displayOrder: 'asc' }
) => {
  return await prisma.wallet.findMany({
    where,
    orderBy,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          transactions: true,
        },
      },
    },
  });
};

export const findMainWallet = async (userId: string) => {
  return await prisma.wallet.findFirst({
    where: {
      userId,
      isMain: true,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
};

export const setMainWallet = async (userId: string, walletId: string) => {
  return await prisma.$transaction(async (tx) => {
    await tx.wallet.updateMany({
      where: { userId, isMain: true },
      data: { isMain: false },
    });
    return await tx.wallet.update({
      where: { id: walletId },
      data: { isMain: true },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  });
};

export const updateWalletOrder = async (userId: string, walletOrders: { id: string; displayOrder: number }[]) => {
  return await prisma.$transaction(
    walletOrders.map(({ id, displayOrder }) =>
      prisma.wallet.update({
        where: { id },
        data: { displayOrder },
      })
    )
  );
};

export const updateWallet = async (
  id: string,
  data: Prisma.WalletUpdateInput
) => {
  return await prisma.wallet.update({
    where: { id },
    data,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
};

export const deleteWallet = async (id: string) => {
  return await prisma.wallet.delete({
    where: { id },
  });
};

export const countWallets = async (
  where: Prisma.WalletWhereInput = {}
) => {
  return await prisma.wallet.count({ where });
};

export const findWalletsByUserId = async (userId: string) => {
  return await prisma.wallet.findMany({
    where: { userId },
    orderBy: { displayOrder: 'asc' },
    include: {
      _count: {
        select: {
          transactions: true,
        },
      },
    },
  });
};