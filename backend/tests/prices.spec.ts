import { isAssetClass, isManualClass } from '../src/services/assets/asset-classes';
import { usdPrices, usdRates, resetPriceCache, PriceUnavailableError, GRAMS_PER_TROY_OZ } from '../src/services/assets/prices';

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
let fetchMock: jest.SpyInstance;
beforeEach(() => { resetPriceCache(); fetchMock = jest.spyOn(global, 'fetch'); });
afterEach(() => jest.restoreAllMocks());

describe('price sources', () => {
  it('prices gold per gram from PAXG', async () => {
    fetchMock.mockImplementation(() => json([{ symbol: 'PAXGUSDT', price: '3110.35' }]));
    const { prices } = await usdPrices('GOLD', ['XAU']);
    expect(prices.XAU).toBeCloseTo(3110.35 / GRAMS_PER_TROY_OZ);
  });

  it('prices crypto from USDT pairs, USDT = 1, unknown → null', async () => {
    fetchMock.mockImplementation((url: string) => {
      expect(decodeURIComponent(String(url))).toContain('"BTCUSDT"');
      return json([{ symbol: 'BTCUSDT', price: '80000' }]);
    });
    const { prices } = await usdPrices('CRYPTO', ['BTC', 'USDT', 'NOPE']);
    expect(prices).toEqual({ BTC: 80000, USDT: 1, NOPE: null });
  });

  it('on a batch 400 fetches all tickers once and filters locally', async () => {
    fetchMock
      .mockImplementationOnce(() => json({ code: -1121, msg: 'Invalid symbol.' }, 400))
      .mockImplementationOnce(() => json([{ symbol: 'BTCUSDT', price: '80000' }, { symbol: 'ETHUSDT', price: '3000' }, { symbol: 'BADUSDT', price: 'x' }]));
    const { prices } = await usdPrices('CRYPTO', ['BTC', 'NOPE']);
    expect(prices).toEqual({ BTC: 80000, NOPE: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignores ticker rows with a non-finite price', async () => {
    fetchMock.mockImplementation(() => json([{ symbol: 'BTCUSDT', price: 'oops' }]));
    expect((await usdPrices('CRYPTO', ['BTC'])).prices).toEqual({ BTC: null });
  });

  it('a network error on the all-tickers fallback serves stale, never caches null', async () => {
    fetchMock.mockImplementation(() => json([{ symbol: 'BTCUSDT', price: '80000' }]));
    await usdPrices('CRYPTO', ['BTC']);
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
    fetchMock.mockReset();
    fetchMock
      .mockImplementationOnce(() => json({ code: -1121 }, 400))
      .mockImplementationOnce(() => Promise.reject(new Error('down')));
    expect(await usdPrices('CRYPTO', ['BTC'])).toEqual({ prices: { BTC: 80000 }, stale: true });
  });

  it('batch 400 then network error with nothing cached throws', async () => {
    fetchMock
      .mockImplementationOnce(() => json({ code: -1121 }, 400))
      .mockImplementationOnce(() => Promise.reject(new Error('down')));
    await expect(usdPrices('CRYPTO', ['BTC'])).rejects.toBeInstanceOf(PriceUnavailableError);
  });

  it('gold falls back to the last value, marked stale', async () => {
    fetchMock.mockImplementation(() => json([{ symbol: 'PAXGUSDT', price: '3110.35' }]));
    await usdPrices('GOLD', ['XAU']);
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
    fetchMock.mockImplementation(() => Promise.reject(new Error('down')));
    const r = await usdPrices('GOLD', ['XAU']);
    expect(r.stale).toBe(true);
    expect(r.prices.XAU).toBeCloseTo(3110.35 / GRAMS_PER_TROY_OZ);
  });

  it('caches for 60s and falls back to the last value, marked stale', async () => {
    fetchMock.mockImplementation(() => json([{ symbol: 'BTCUSDT', price: '80000' }]));
    await usdPrices('CRYPTO', ['BTC']);
    await usdPrices('CRYPTO', ['BTC']);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
    fetchMock.mockImplementation(() => Promise.reject(new Error('down')));
    const again = await usdPrices('CRYPTO', ['BTC']);
    expect(again).toEqual({ prices: { BTC: 80000 }, stale: true });
  });

  it('throws when nothing was ever fetched', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('down')));
    await expect(usdPrices('CRYPTO', ['BTC'])).rejects.toBeInstanceOf(PriceUnavailableError);
  });

  it('reads USD→KRW/IDR', async () => {
    fetchMock.mockImplementation(() => json({ result: 'success', rates: { KRW: 1400, IDR: 16000, EUR: 0.9 } }));
    expect((await usdRates()).rates).toEqual({ KRW: 1400, IDR: 16000 });
  });

  it('malformed FX body: stale with cache, throws without', async () => {
    await expect((async () => {
      fetchMock.mockImplementation(() => json({ result: 'success', rates: { KRW: 1400 } }));
      return usdRates();
    })()).rejects.toBeInstanceOf(PriceUnavailableError);
    fetchMock.mockImplementation(() => json({ result: 'success', rates: { KRW: 1400, IDR: 16000 } }));
    await usdRates();
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 3_700_000);
    fetchMock.mockImplementation(() => json({ result: 'success', rates: { KRW: 1400 } }));
    expect(await usdRates()).toEqual({ rates: { KRW: 1400, IDR: 16000 }, stale: true });
  });

  it('non-ok FX response is a failure', async () => {
    fetchMock.mockImplementation(() => json({ result: 'success', rates: { KRW: 1, IDR: 1 } }, 500));
    await expect(usdRates()).rejects.toBeInstanceOf(PriceUnavailableError);
  });
});

describe('asset classes', () => {
  it('rejects prototype keys and knows manual classes', () => {
    expect(isAssetClass('constructor')).toBe(false);
    expect(isAssetClass('__proto__')).toBe(false);
    expect(isManualClass('toString')).toBe(false);
    expect(isManualClass('GOLD')).toBe(true);
    expect(isManualClass('CRYPTO')).toBe(false);
  });
});
