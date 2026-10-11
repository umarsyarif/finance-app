import prisma from '../../middleware/prismaMiddleware';
import { decrypt } from '../crypto-box';
import { fetchBalances, BinanceError } from '../binance.service';
import type { AssetClass } from './asset-classes';

export type Holding = { assetClass: AssetClass; symbol: string; quantity: number; source: 'manual' | 'binance' };
export type BinanceStatus = { connected: boolean; lastSyncedAt: string | null; error: string | null };

// Manual lots summed per (class, symbol); fully sold holdings drop out
export async function manualHoldings(userId: string): Promise<Holding[]> {
  const lots = await prisma.assetLot.findMany({ where: { userId } });
  const sums = new Map<string, number>();
  for (const l of lots) {
    const key = `${l.assetClass}:${l.symbol}`;
    sums.set(key, (sums.get(key) ?? 0) + l.quantity.toNumber());
  }
  return [...sums].filter(([, q]) => q > 1e-9).map(([key, quantity]) => {
    const [assetClass, symbol] = key.split(':');
    return { assetClass: assetClass as AssetClass, symbol, quantity, source: 'manual' as const };
  });
}

const BINANCE_TTL = 5 * 60_000;
const binanceCache = new Map<string, { at: number; balances: Record<string, number> }>();
export const resetBinanceCache = () => binanceCache.clear();

export async function binanceHoldings(userId: string, refresh: boolean): Promise<{ holdings: Holding[]; status: BinanceStatus }> {
  const conn = await prisma.binanceConnection.findUnique({ where: { userId } });
  if (!conn) return { holdings: [], status: { connected: false, lastSyncedAt: null, error: null } };

  const cached = binanceCache.get(userId);
  let balances = cached?.balances ?? {};
  let lastSyncedAt = conn.lastSyncedAt;
  let error = conn.lastError;
  if (refresh || !cached || Date.now() - cached.at >= BINANCE_TTL) {
    try {
      balances = await fetchBalances({ apiKey: conn.apiKey, apiSecret: decrypt(conn) });
      binanceCache.set(userId, { at: Date.now(), balances });
      lastSyncedAt = new Date();
      error = null;
      await prisma.binanceConnection.update({ where: { userId }, data: { lastSyncedAt, lastError: null } });
    } catch (err) {
      error = err instanceof BinanceError ? err.message : "Couldn't reach Binance";
      await prisma.binanceConnection.update({ where: { userId }, data: { lastError: error } });
    }
  }
  const holdings = Object.entries(balances)
    .filter(([, q]) => q > 0)
    .map(([symbol, quantity]) => ({ assetClass: 'CRYPTO' as const, symbol, quantity, source: 'binance' as const }));
  return { holdings, status: { connected: true, lastSyncedAt: lastSyncedAt?.toISOString() ?? null, error } };
}
