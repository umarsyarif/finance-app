jest.mock('../src/middleware/prismaMiddleware', () => ({
  __esModule: true,
  default: {
    assetLot: { groupBy: jest.fn(), findMany: jest.fn() },
    assetCost: { findMany: jest.fn() },
    binanceConnection: { findUnique: jest.fn(), update: jest.fn() },
  },
}));
jest.mock('../src/services/assets/prices', () => ({
  ...jest.requireActual('../src/services/assets/prices'),
  usdPrices: jest.fn(),
  usdRates: jest.fn(),
}));
jest.mock('../src/services/binance.service', () => ({ ...jest.requireActual('../src/services/binance.service'), fetchBalances: jest.fn() }));
jest.mock('../src/services/crypto-box', () => ({ decrypt: () => 'secret' }));

import prisma from '../src/middleware/prismaMiddleware';
import { usdPrices, usdRates, PriceUnavailableError } from '../src/services/assets/prices';
import { fetchBalances, BinanceError } from '../src/services/binance.service';
import { getPortfolio } from '../src/services/assets/portfolio.service';
import { resetBinanceCache } from '../src/services/assets/sources';

const p = prisma as any;
const dec = (n: number) => ({ toNumber: () => n });

beforeEach(() => {
  jest.clearAllMocks();
  resetBinanceCache();
  (usdRates as jest.Mock).mockResolvedValue({ rates: { KRW: 1400, IDR: 16000 }, stale: false });
  (usdPrices as jest.Mock).mockImplementation(async (cls: string, symbols: string[]) => ({
    prices: Object.fromEntries(symbols.map((s) => [s, ({ XAU: 100, BTC: 80000, ETH: 3000, DUST: 0.0001, NOPE: null } as Record<string, number | null>)[s] ?? null])),
    stale: false,
  }));
  p.assetLot.findMany.mockResolvedValue([
    { assetClass: 'GOLD', symbol: 'XAU', quantity: dec(10), totalPaid: dec(14_000_000), currency: 'IDR' },
    { assetClass: 'GOLD', symbol: 'XAU', quantity: dec(-2), totalPaid: dec(-3_000_000), currency: 'IDR' },
  ]);
  p.assetCost.findMany.mockResolvedValue([{ assetClass: 'CRYPTO', symbol: 'BTC', costAmount: dec(5000), costCurrency: 'USD' }]);
  p.binanceConnection.findUnique.mockResolvedValue({ apiKey: 'k', secretEnc: 'x', iv: 'y', authTag: 'z', lastSyncedAt: null, lastError: null });
  p.binanceConnection.update.mockResolvedValue({});
  (fetchBalances as jest.Mock).mockResolvedValue({ BTC: 0.1, ETH: 0, DUST: 5, NOPE: 3 });
});

describe('getPortfolio', () => {
  it('values manual gold and synced crypto in the display currency', async () => {
    const pf = await getPortfolio('u1', 'IDR', false);
    const gold = pf.holdings.find((h) => h.symbol === 'XAU')!;
    expect(gold.quantity).toBe(8);
    expect(gold.value).toBe(8 * 100 * 16000);
    expect(gold.cost).toBe(11_000_000);
    expect(gold.gain).toBe(8 * 100 * 16000 - 11_000_000);

    const btc = pf.holdings.find((h) => h.symbol === 'BTC')!;
    expect(btc.value).toBe(0.1 * 80000 * 16000);
    expect(btc.cost).toBe(5000 * 16000);
    expect(btc.source).toBe('binance');
    expect(pf.sources.binance.connected).toBe(true);
  });

  it('converts costs paid in another currency when switching display currency', async () => {
    const pf = await getPortfolio('u1', 'KRW', false);
    const gold = pf.holdings.find((h) => h.symbol === 'XAU')!;
    expect(gold.cost).toBeCloseTo(11_000_000 / 16000 * 1400);
    expect(pf.holdings.find((h) => h.symbol === 'BTC')!.cost).toBeCloseTo(5000 * 1400);
  });

  it('drops dust and zero holdings; keeps unpriced ones out of totals', async () => {
    const pf = await getPortfolio('u1', 'IDR', false);
    expect(pf.holdings.map((h) => h.symbol)).not.toContain('DUST');
    expect(pf.holdings.map((h) => h.symbol)).not.toContain('ETH');
    const nope = pf.holdings.find((h) => h.symbol === 'NOPE')!;
    expect(nope.value).toBeNull();
    const pricedTotal = pf.holdings.filter((h) => h.value !== null).reduce((s, h) => s + h.value!, 0);
    expect(pf.total.value).toBe(pricedTotal);
    expect(Number.isNaN(pf.total.value)).toBe(false);
  });

  it('a fully sold manual holding disappears without NaN', async () => {
    p.assetLot.findMany.mockResolvedValue([
      { assetClass: 'GOLD', symbol: 'XAU', quantity: dec(2), totalPaid: dec(3_000_000), currency: 'IDR' },
      { assetClass: 'GOLD', symbol: 'XAU', quantity: dec(-2), totalPaid: dec(-3_500_000), currency: 'IDR' },
    ]);
    const pf = await getPortfolio('u1', 'IDR', false);
    expect(pf.holdings.find((h) => h.symbol === 'XAU')).toBeUndefined();
  });

  it('Binance failing keeps gold and reports the error; cached coins are reused', async () => {
    await getPortfolio('u1', 'IDR', false); // fills the cache
    (fetchBalances as jest.Mock).mockRejectedValue(new BinanceError('Invalid API-key, IP, or permissions for action.'));
    const pf = await getPortfolio('u1', 'IDR', true);
    expect(pf.holdings.find((h) => h.symbol === 'XAU')).toBeDefined();
    expect(pf.holdings.find((h) => h.symbol === 'BTC')).toBeDefined();
    expect(pf.sources.binance.error).toBe('Invalid API-key, IP, or permissions for action.');
  });

  it('one price class failing keeps the other class', async () => {
    (usdPrices as jest.Mock).mockImplementation(async (cls: string, symbols: string[]) => {
      if (cls === 'CRYPTO') throw new PriceUnavailableError('Prices are unavailable right now');
      return { prices: Object.fromEntries(symbols.map((s) => [s, 100])), stale: false };
    });
    const pf = await getPortfolio('u1', 'IDR', false);
    expect(pf.holdings.find((h) => h.symbol === 'XAU')!.value).toBe(8 * 100 * 16000);
    expect(pf.holdings.find((h) => h.symbol === 'BTC')!.value).toBeNull();
  });

  it('not connected: no Binance call', async () => {
    p.binanceConnection.findUnique.mockResolvedValue(null);
    const pf = await getPortfolio('u1', 'IDR', false);
    expect(fetchBalances).not.toHaveBeenCalled();
    expect(pf.sources.binance).toEqual({ connected: false, lastSyncedAt: null, error: null });
  });
});
