import { Request, Response, NextFunction } from 'express';
import prisma from '../middleware/prismaMiddleware';
import AppError from '../utils/appError';

const uid = (res: Response): string => res.locals.user.id;
const include = { wallet: { select: { id: true, name: true } }, category: { select: { id: true, name: true } } };
const FIELDS = ['name', 'amount', 'currency', 'walletId', 'categoryId', 'dayOfMonth', 'remindDaysBefore', 'active'];
// Explicit pick: the validate middleware keeps unknown keys
const billData = (b: Record<string, unknown>) => Object.fromEntries(FIELDS.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]));

async function ownBill(userId: string, id: string) {
  const bill = await prisma.bill.findFirst({ where: { id, userId } });
  if (!bill) throw new AppError(404, 'Bill not found');
  return bill;
}

// walletId/categoryId must be the caller's (or a global category), expense-only, same currency
async function checkRefs(userId: string, d: { walletId?: string | null; categoryId?: string | null; currency?: string }) {
  if (d.walletId) {
    const w = await prisma.wallet.findFirst({ where: { id: d.walletId, userId } });
    if (!w) throw new AppError(400, 'Wallet not found');
    if (d.currency && w.currency !== d.currency) throw new AppError(400, "Wallet currency doesn't match");
  }
  if (d.categoryId) {
    const c = await prisma.category.findFirst({ where: { id: d.categoryId, OR: [{ userId }, { userId: null }], type: 'EXPENSE', isTransfer: false } });
    if (!c) throw new AppError(400, 'Choose an expense category');
  }
}

export const listBillsHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const bills = await prisma.bill.findMany({ where: { userId: uid(res) }, include, orderBy: [{ dayOfMonth: 'asc' }, { name: 'asc' }] });
    res.status(200).json({ status: 'success', data: { bills } });
  } catch (err) { next(err); }
};

export const createBillHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = uid(res);
    const data = billData(req.body) as any;
    await checkRefs(userId, data);
    const bill = await prisma.bill.create({ data: { ...data, userId }, include });
    res.status(201).json({ status: 'success', data: { bill } });
  } catch (err) { next(err); }
};

export const updateBillHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = uid(res);
    const existing = await ownBill(userId, req.params.id);
    const data = billData(req.body) as any;
    await checkRefs(userId, {
      walletId: data.walletId !== undefined ? data.walletId : existing.walletId,
      categoryId: data.categoryId,
      currency: data.currency ?? existing.currency,
    });
    const bill = await prisma.bill.update({ where: { id: existing.id }, data, include });
    res.status(200).json({ status: 'success', data: { bill } });
  } catch (err) { next(err); }
};

export const deleteBillHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bill = await ownBill(uid(res), req.params.id);
    await prisma.bill.delete({ where: { id: bill.id } });
    res.status(204).end();
  } catch (err) { next(err); }
};
