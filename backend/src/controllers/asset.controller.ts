import { Request, Response, NextFunction } from 'express';
import prisma from '../middleware/prismaMiddleware';
import AppError from '../utils/appError';
import { encrypt, isEncryptionConfigured } from '../services/crypto-box';
import { checkReadOnly, BinanceError } from '../services/binance.service';
import { getPortfolio } from '../services/assets/portfolio.service';
import { binanceHoldings, clearBinanceCache } from '../services/assets/sources';
import { isAssetClass, isManualClass } from '../services/assets/asset-classes';
import { PriceUnavailableError } from '../services/assets/prices';

const MANUAL_ONLY = 'This asset class is synced, not entered by hand';
const uid = (res: Response): string => res.locals.user.id;

async function ownLot(userId: string, id: string) {
  const lot = await prisma.assetLot.findFirst({ where: { id, userId } });
  if (!lot) throw new AppError(404, 'Lot not found');
  return lot;
}

export const getPortfolioHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currency, refresh } = req.query as { currency: 'KRW' | 'IDR'; refresh?: string };
    const data = await getPortfolio(uid(res), currency, refresh === '1');
    res.status(200).json({ status: 'success', data });
  } catch (err) {
    next(err instanceof PriceUnavailableError ? new AppError(503, 'Prices are unavailable right now') : err);
  }
};

export const listLotsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assetClass = req.query.assetClass as string | undefined;
    const lots = await prisma.assetLot.findMany({
      where: { userId: uid(res), ...(assetClass && { assetClass }) },
      orderBy: { date: 'desc' },
    });
    res.status(200).json({ status: 'success', data: { lots } });
  } catch (err) {
    next(err);
  }
};

export const createLotHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    if (!isManualClass(body.assetClass)) throw new AppError(400, MANUAL_ONLY);
    const lot = await prisma.assetLot.create({ data: { ...body, userId: uid(res), date: new Date(body.date) } });
    res.status(201).json({ status: 'success', data: { lot } });
  } catch (err) {
    next(err);
  }
};

export const updateLotHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    await ownLot(uid(res), req.params.id);
    if (body.assetClass !== undefined && !isManualClass(body.assetClass)) throw new AppError(400, MANUAL_ONLY);
    const lot = await prisma.assetLot.update({
      where: { id: req.params.id },
      data: { ...body, ...(body.date && { date: new Date(body.date) }) },
    });
    res.status(200).json({ status: 'success', data: { lot } });
  } catch (err) {
    next(err);
  }
};

export const deleteLotHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ownLot(uid(res), req.params.id);
    await prisma.assetLot.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const putCostHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assetClass, symbol } = req.params;
    const { costAmount, costCurrency } = req.body;
    if (!isAssetClass(assetClass)) throw new AppError(400, 'Unknown asset class');
    const userId = uid(res);
    if (costAmount === null) {
      await prisma.assetCost.deleteMany({ where: { userId, assetClass, symbol } });
    } else {
      await prisma.assetCost.upsert({
        where: { userId_assetClass_symbol: { userId, assetClass, symbol } },
        create: { userId, assetClass, symbol, costAmount, costCurrency },
        update: { costAmount, costCurrency },
      });
    }
    res.status(200).json({ status: 'success' });
  } catch (err) {
    next(err);
  }
};

export const putBinanceHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { apiKey, apiSecret } = req.body;
    const userId = uid(res);
    if (!isEncryptionConfigured()) throw new AppError(503, "Binance sync isn't set up");
    try {
      await checkReadOnly({ apiKey, apiSecret });
    } catch (err) {
      if (err instanceof BinanceError) throw new AppError(400, err.message);
      throw err;
    }
    const data = { apiKey, ...encrypt(apiSecret), lastSyncedAt: null, lastError: null };
    await prisma.binanceConnection.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    clearBinanceCache(userId);
    const { status } = await binanceHoldings(userId, true);
    res.status(200).json({ status: 'success', data: { connected: true, lastSyncedAt: status.lastSyncedAt } });
  } catch (err) {
    next(err);
  }
};

export const deleteBinanceHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = uid(res);
    await prisma.binanceConnection.deleteMany({ where: { userId } });
    clearBinanceCache(userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
