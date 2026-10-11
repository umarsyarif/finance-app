import prisma from '../../middleware/prismaMiddleware';
import { ASSET_CLASSES, type AssetClass } from './asset-classes';
import { usdPrices, usdRates, PriceUnavailableError } from './prices';
import { manualHoldings, binanceHoldings, type Holding } from './sources';

export const DUST_USD = 1;
type Currency = 'KRW' | 'IDR';
const toUsd = (amount: number, currency: string, rates: { KRW: number; IDR: number }) =>
  currency === 'USD' ? amount : amount / rates[currency as Currency];

export async function getPortfolio(userId: string, currency: Currency, refresh: boolean) {
  const [{ rates, stale: fxStale }, manual, binance, lots, costs] = await Promise.all([
    usdRates(), // throws PriceUnavailableError when there's no rate at all: the route answers 503
    manualHoldings(userId),
    binanceHoldings(userId, refresh),
    prisma.assetLot.findMany({ where: { userId } }),
    prisma.assetCost.findMany({ where: { userId } }),
  ]);
  const holdings: Holding[] = [...manual, ...binance.holdings];

  // Price each class separately so one failing source doesn't hide the others
  let stale = fxStale;
  let classes = 0, failed = 0;
  const usd: Record<string, number | null> = {};
  for (const cls of Object.keys(ASSET_CLASSES) as AssetClass[]) {
    const symbols = [...new Set(holdings.filter((h) => h.assetClass === cls).map((h) => h.symbol))];
    if (symbols.length === 0) continue;
    classes++;
    try {
      const r = await usdPrices(cls, symbols);
      stale ||= r.stale;
      for (const s of symbols) usd[`${cls}:${s}`] = r.prices[s];
    } catch (err) {
      if (!(err instanceof PriceUnavailableError)) throw err;
      failed++;
      for (const s of symbols) usd[`${cls}:${s}`] = null;
    }
  }
  if (classes > 0 && failed === classes) throw new PriceUnavailableError(); // cold cache everywhere: 503, not a fake ₩0

  const rate = rates[currency];
  const costUsd = (h: Holding): number | null => {
    if (h.source === 'manual') {
      return lots
        .filter((l) => l.assetClass === h.assetClass && l.symbol === h.symbol)
        .reduce((sum, l) => sum + toUsd(l.totalPaid.toNumber(), l.currency, rates), 0);
    }
    const c = costs.find((c) => c.assetClass === h.assetClass && c.symbol === h.symbol);
    return c ? toUsd(c.costAmount.toNumber(), c.costCurrency, rates) : null;
  };

  const rows = holdings
    .map((h) => {
      const price = usd[`${h.assetClass}:${h.symbol}`] ?? null;
      const valueUsd = price === null ? null : h.quantity * price;
      const cUsd = costUsd(h);
      const value = valueUsd === null ? null : valueUsd * rate;
      const cost = cUsd === null ? null : cUsd * rate;
      const gain = value !== null && cost !== null ? value - cost : null;
      return {
        assetClass: h.assetClass, symbol: h.symbol, quantity: h.quantity,
        unit: ASSET_CLASSES[h.assetClass].unit, source: h.source,
        value, cost, gain, gainPct: gain !== null && cost !== null && cost > 0 ? (gain / cost) * 100 : null,
        valueUsd,
      };
    })
    .filter((r) => r.valueUsd === null || r.valueUsd >= DUST_USD)
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
    .map(({ valueUsd: _drop, ...r }) => r);

  const priced = rows.filter((r) => r.value !== null);
  const withCost = priced.filter((r) => r.cost !== null);
  const totalValue = priced.reduce((s, r) => s + r.value!, 0);
  const totalCost = withCost.length ? withCost.reduce((s, r) => s + r.cost!, 0) : null;
  const costedValue = withCost.reduce((s, r) => s + r.value!, 0);
  const totalGain = totalCost === null ? null : costedValue - totalCost;

  return {
    currency,
    total: { value: totalValue, cost: totalCost, gain: totalGain, gainPct: totalGain !== null && totalCost !== null && totalCost > 0 ? (totalGain / totalCost) * 100 : null },
    holdings: rows,
    sources: { binance: binance.status },
    stale,
  };
}
