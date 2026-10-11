import { usdPrices, usdRates, resetPriceCache, PriceUnavailableError, GRAMS_PER_TROY_OZ } from '../src/services/assets/prices';

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
let fetchMock: jest.SpyInstance;
beforeEach(() => { resetPriceCache(); fetchMock = jest.spyOn(global, 'fetch'); });
afterEach(() => fetchMock.mockRestore());

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

  it('retries without unknown symbols when Binance rejects the batch', async () => {
    fetchMock
      .mockImplementationOnce(() => json({ code: -1121, msg: 'Invalid symbol.' }, 400))
      .mockImplementation((url: string) => (decodeURIComponent(String(url)).includes('BTCUSDT')
        ? json({ symbol: 'BTCUSDT', price: '80000' }) : json({ code: -1121, msg: 'Invalid symbol.' }, 400)));
    const { prices } = await usdPrices('CRYPTO', ['BTC', 'NOPE']);
    expect(prices).toEqual({ BTC: 80000, NOPE: null });
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
    (Date.now as jest.Mock).mockRestore();
  });

  it('throws when nothing was ever fetched', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('down')));
    await expect(usdPrices('CRYPTO', ['BTC'])).rejects.toBeInstanceOf(PriceUnavailableError);
  });

  it('reads USD→KRW/IDR', async () => {
    fetchMock.mockImplementation(() => json({ result: 'success', rates: { KRW: 1400, IDR: 16000, EUR: 0.9 } }));
    expect((await usdRates()).rates).toEqual({ KRW: 1400, IDR: 16000 });
  });
});
