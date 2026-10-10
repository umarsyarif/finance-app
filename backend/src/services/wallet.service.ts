import { Prisma } from '@prisma/client';
import prisma from '../middleware/prismaMiddleware';

// One main wallet per currency: keep the first flagged wallet of each currency (display order),
// and promote the first wallet of any currency left without one. Every write that can change
// which wallets exist, their currency, or their main flag ends with this.
export async function normalizeMainWallets(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM wallets WHERE "userId" = ${userId} FOR UPDATE`;
  const wallets = await tx.wallet.findMany({
    where: { userId },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, currency: true, isMain: true },
  });
  const main = new Map<string, string>();
  for (const w of wallets) if (w.isMain && !main.has(w.currency)) main.set(w.currency, w.id);
  for (const w of wallets) if (!main.has(w.currency)) main.set(w.currency, w.id);
  const mainIds = [...main.values()];
  await tx.wallet.updateMany({ where: { userId, isMain: true, id: { notIn: mainIds } }, data: { isMain: false } });
  await tx.wallet.updateMany({ where: { id: { in: mainIds }, isMain: false }, data: { isMain: true } });
}

export const createWallet = async (
  input: Prisma.WalletCreateInput
) => {
  return await prisma.$transaction(async (tx) => {
    const created = await tx.wallet.create({ data: input });
    await normalizeMainWallets(tx, created.userId);
    return await tx.wallet.findUniqueOrThrow({
      where: { id: created.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
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
  // Ties in displayOrder (0 by default) fall back to creation order, so lists and "first wallet" are stable
  orderBy: Prisma.WalletOrderByWithRelationInput[] = [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
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
    // Lock the user's wallets so concurrent calls cannot each leave a different main wallet
    await tx.$queryRaw`SELECT id FROM wallets WHERE "userId" = ${userId} FOR UPDATE`;
    const target = await tx.wallet.findUniqueOrThrow({ where: { id: walletId }, select: { currency: true } });
    // Main is per currency: only this currency's main steps down
    await tx.wallet.updateMany({
      where: { userId, currency: target.currency, isMain: true },
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
  return await prisma.$transaction(async (tx) => {
    const before = await tx.wallet.findUniqueOrThrow({ where: { id }, select: { userId: true, currency: true } });
    // A wallet moving to another currency gives up being main; both currencies are then rebalanced
    const movesCurrency = typeof data.currency === 'string' && data.currency !== before.currency;
    await tx.wallet.update({ where: { id }, data: movesCurrency ? { ...data, isMain: false } : data });
    if (movesCurrency) await normalizeMainWallets(tx, before.userId);
    return await tx.wallet.findUniqueOrThrow({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  });
};

export const deleteWallet = async (id: string) => {
  return await prisma.$transaction(async (tx) => {
    const deleted = await tx.wallet.delete({ where: { id } });
    // Deleting a main wallet promotes another wallet of that currency
    await normalizeMainWallets(tx, deleted.userId);
    return deleted;
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
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      _count: {
        select: {
          transactions: true,
        },
      },
    },
  });
};