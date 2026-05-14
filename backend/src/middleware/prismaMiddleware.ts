import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;

export async function applyBalanceOnCreate(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  transaction: { walletId: string; categoryId: string; amount: number }
) {
  const category = await tx.category.findUnique({
    where: { id: transaction.categoryId },
    select: { type: true },
  });
  if (!category) return;

  const balanceChange = category.type === 'INCOME' ? transaction.amount : -transaction.amount;
  await tx.wallet.update({
    where: { id: transaction.walletId },
    data: { balance: { increment: balanceChange } },
  });
}

export async function applyBalanceOnDelete(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  original: { walletId: string; amount: number; category: { type: string } }
) {
  const revert = original.category.type === 'INCOME' ? -original.amount : original.amount;
  await tx.wallet.update({
    where: { id: original.walletId },
    data: { balance: { increment: revert } },
  });
}

export async function applyBalanceOnUpdate(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  original: { walletId: string; amount: number; category: { type: string } },
  updated: { walletId: string; categoryId: string; amount: number }
) {
  const updatedCategory = await tx.category.findUnique({
    where: { id: updated.categoryId },
    select: { type: true },
  });
  if (!updatedCategory) return;

  const originalChange = original.category.type === 'INCOME' ? original.amount : -original.amount;
  const newChange = updatedCategory.type === 'INCOME' ? updated.amount : -updated.amount;

  if (original.walletId !== updated.walletId) {
    await tx.wallet.update({
      where: { id: original.walletId },
      data: { balance: { increment: -originalChange } },
    });
    await tx.wallet.update({
      where: { id: updated.walletId },
      data: { balance: { increment: newChange } },
    });
  } else {
    const diff = newChange - originalChange;
    if (diff !== 0) {
      await tx.wallet.update({
        where: { id: original.walletId },
        data: { balance: { increment: diff } },
      });
    }
  }
}
