import prisma, { applyBalanceOnCreate, applyBalanceOnDelete, applyBalanceOnUpdate } from '../middleware/prismaMiddleware';
import AppError from '../utils/appError';
import type { TransferBody } from '../schemas/transfer.schema';

export const TRANSFER_OUT = 'transfer-out';
export const TRANSFER_IN = 'transfer-in';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Row = { walletId: string; categoryId: string; amount: number; date: Date; description: string };

const include = { transactions: { include: { wallet: true } } } as const;

// Business rules shared by create and update; throws AppError on bad input
async function resolve(tx: Tx, userId: string, input: TransferBody) {
  if (input.fromWalletId === input.toWalletId) throw new AppError(400, 'Pick two different wallets');
  const wallets = await tx.wallet.findMany({ where: { id: { in: [input.fromWalletId, input.toWalletId] }, userId } });
  const from = wallets.find((w) => w.id === input.fromWalletId);
  const to = wallets.find((w) => w.id === input.toWalletId);
  if (!from || !to) throw new AppError(404, 'Wallet not found');

  let received = input.amountSent;
  if (from.currency !== to.currency) {
    if (input.amountReceived === undefined) throw new AppError(400, 'Enter the amount received');
    received = input.amountReceived;
  } else if (input.amountReceived !== undefined && input.amountReceived !== input.amountSent) {
    throw new AppError(400, 'Amounts must match for wallets in the same currency');
  }

  const note = Array.from(input.note?.trim() ?? '').slice(0, 255).join('') || null;
  const date = new Date(input.date);
  const out: Row = { walletId: from.id, categoryId: TRANSFER_OUT, amount: input.amountSent, date, description: note ?? `Transfer to ${to.name}` };
  const inn: Row = { walletId: to.id, categoryId: TRANSFER_IN, amount: received, date, description: note ?? `Transfer from ${from.name}` };
  return { note, date, rows: [out, inn] };
}

type Loaded = NonNullable<Awaited<ReturnType<typeof loadTransfer>>>;
const loadTransfer = (tx: Tx | typeof prisma, userId: string, id: string) =>
  tx.transfer.findFirst({ where: { id, userId }, include });

function view(t: Loaded) {
  const side = (categoryId: string) => {
    const r = t.transactions.find((x) => x.categoryId === categoryId)!;
    return { walletId: r.walletId, walletName: r.wallet.name, currency: r.wallet.currency, amount: r.amount.toNumber(), transactionId: r.id };
  };
  return { id: t.id, date: t.date, note: t.note, from: side(TRANSFER_OUT), to: side(TRANSFER_IN) };
}

export const createTransfer = (userId: string, input: TransferBody) =>
  prisma.$transaction(async (tx) => {
    const { note, date, rows } = await resolve(tx, userId, input);
    const transfer = await tx.transfer.create({ data: { userId, date, note } });
    for (const row of rows) {
      await tx.transaction.create({ data: { ...row, transferId: transfer.id } });
      await applyBalanceOnCreate(tx, row);
    }
    return view((await loadTransfer(tx, userId, transfer.id))!);
  });

export const findTransfer = async (userId: string, id: string) => {
  const t = await loadTransfer(prisma, userId, id);
  if (!t) throw new AppError(404, 'Transfer not found');
  return view(t);
};

// Locks both rows, then returns them with their categories (for the balance helpers)
async function lockRows(tx: Tx, userId: string, id: string) {
  if (!(await tx.transfer.findFirst({ where: { id, userId }, select: { id: true } }))) {
    throw new AppError(404, 'Transfer not found');
  }
  await tx.$queryRaw`SELECT id FROM transactions WHERE "transferId" = ${id} FOR UPDATE`;
  return tx.transaction.findMany({ where: { transferId: id }, include: { category: true } });
}

export const updateTransfer = (userId: string, id: string, input: TransferBody) =>
  prisma.$transaction(async (tx) => {
    const existing = await lockRows(tx, userId, id);
    const { note, date, rows } = await resolve(tx, userId, input);
    for (const row of rows) {
      const original = existing.find((x) => x.categoryId === row.categoryId)!;
      await tx.transaction.update({
        where: { id: original.id },
        data: { walletId: row.walletId, amount: row.amount, date: row.date, description: row.description },
      });
      await applyBalanceOnUpdate(tx, { ...original, amount: original.amount.toNumber() }, row);
    }
    await tx.transfer.update({ where: { id }, data: { date, note } });
    return view((await loadTransfer(tx, userId, id))!);
  });

export const deleteTransfer = (userId: string, id: string) =>
  prisma.$transaction(async (tx) => {
    const existing = await lockRows(tx, userId, id);
    for (const row of existing) {
      await applyBalanceOnDelete(tx, { ...row, amount: row.amount.toNumber() });
    }
    await tx.transaction.deleteMany({ where: { transferId: id } });
    await tx.transfer.delete({ where: { id } });
  });
