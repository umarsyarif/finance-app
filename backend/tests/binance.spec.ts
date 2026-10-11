import { sign, checkReadOnly, fetchBalances, BinanceError } from '../src/services/binance.service';

const creds = { apiKey: 'k', apiSecret: 'SECRET-xyz-123' };
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
let fetchMock: jest.SpyInstance;

beforeEach(() => {
  fetchMock = jest.spyOn(global, 'fetch');
});
afterEach(() => fetchMock.mockRestore());

describe('sign', () => {
  it('is HMAC-SHA256 hex of the query', () => {
    // Binance docs example
    expect(sign('symbol=LTCBTC&side=BUY&type=LIMIT&timeInForce=GTC&quantity=1&price=0.1&recvWindow=5000&timestamp=1499827319559',
      'NhqPtmdSJYdKjVHjA7PZj4Mge3R5YNiP1e3UZjInClVN65XAbvqqM6A7H5fATj0j'))
      .toBe('c8db56825ae71d6d79447849e617115f4a920fa2acdcab2b053c4b2838bd6b71');
  });
});

describe('checkReadOnly', () => {
  const restrictions = (over: Record<string, boolean>) => ({
    enableReading: true, enableSpotAndMarginTrading: false, enableWithdrawals: false, enableInternalTransfer: false,
    enableMargin: false, enableFutures: false, permitsUniversalTransfer: false, enableVanillaOptions: false, ...over,
  });

  it('accepts a read-only key and sends the API key header, never the secret', async () => {
    fetchMock.mockImplementation(() => json(restrictions({})));
    await expect(checkReadOnly(creds)).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/sapi/v1/account/apiRestrictions');
    expect(String(url)).toMatch(/signature=[0-9a-f]{64}/);
    expect(String(url)).not.toContain('SECRET-xyz-123');
    expect(JSON.stringify(init)).not.toContain('SECRET-xyz-123');
    expect((init.headers as Record<string, string>)['X-MBX-APIKEY']).toBe('k');
  });

  it.each(['enableSpotAndMarginTrading', 'enableWithdrawals', 'enableInternalTransfer', 'enableMargin', 'enableFutures', 'permitsUniversalTransfer', 'enableVanillaOptions', 'enablePortfolioMarginTrading'])(
    'rejects a key with %s', async (perm) => {
      fetchMock.mockImplementation(() => json(restrictions({ [perm]: true })));
      await expect(checkReadOnly(creds)).rejects.toThrow('Use a read-only key: turn off trading, withdrawals and transfers');
    });

  it('accepts enableFixReadOnly', async () => {
    fetchMock.mockImplementation(() => json(restrictions({ enableFixReadOnly: true })));
    await expect(checkReadOnly(creds)).resolves.toBeUndefined();
  });

  it('rejects a key without reading', async () => {
    fetchMock.mockImplementation(() => json(restrictions({ enableReading: false })));
    await expect(checkReadOnly(creds)).rejects.toBeInstanceOf(BinanceError);
  });

  it('surfaces Binance errors without the secret', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockImplementation(() => json({ code: -2014, msg: 'API-key format invalid.' }, 401));
    await expect(checkReadOnly(creds)).rejects.toThrow('API-key format invalid.');
    expect(err).toHaveBeenCalledWith('Binance request failed: /sapi/v1/account/apiRestrictions 401 API-key format invalid.');
    expect(JSON.stringify(err.mock.calls)).not.toContain('SECRET-xyz-123');
    err.mockRestore();
  });
});

describe('fetchBalances', () => {
  const route = (over: Record<string, (u: URL) => Promise<Response>> = {}) => (url: string) => {
    const u = new URL(String(url));
    const h = { spot: '/api/v3/account', fund: 'get-funding-asset', flex: 'flexible/position', lock: 'locked/position' };
    const key = Object.keys(h).find((k) => u.pathname.includes((h as Record<string, string>)[k]))!;
    const base: Record<string, (u: URL) => Promise<Response>> = {
      spot: () => json({ balances: [] }), fund: () => json([]), flex: () => json({ rows: [], total: 0 }), lock: () => json({ rows: [], total: 0 }), ...over,
    };
    return base[key](u);
  };

  it('sums spot, funding and both Simple Earn kinds, skipping mirrored LD tokens', async () => {
    fetchMock.mockImplementation(route({
      spot: () => json({ balances: [{ asset: 'BTC', free: '0.1', locked: '0.05' }, { asset: 'LDBTC', free: '9', locked: '0' }] }),
      fund: () => json([{ asset: 'BTC', free: '0.01', locked: '0', freeze: '0' }, { asset: 'USDT', free: '50', locked: '0', freeze: '0' }]),
      flex: () => json({ rows: [{ asset: 'ETH', totalAmount: '1.5' }, { asset: 'BTC', totalAmount: '0' }], total: 2 }),
      lock: () => json({ rows: [{ asset: 'ETH', amount: '0.5' }], total: 1 }),
    }));
    const balances = await fetchBalances(creds);
    expect(balances.BTC).toBeCloseTo(0.16);
    expect(balances.ETH).toBeCloseTo(2);
    expect(balances.USDT).toBe(50);
    expect(balances.LDBTC).toBeUndefined();
    const funding = fetchMock.mock.calls.find(([u]) => String(u).includes('get-funding-asset'))!;
    expect(funding[1].method).toBe('POST');
  });

  it('skips LD<coin> only when a flexible Earn row for <coin> exists', async () => {
    fetchMock.mockImplementation(route({
      spot: () => json({ balances: [{ asset: 'LDO', free: '3', locked: '0' }, { asset: 'LDBTC', free: '9', locked: '0' }] }),
      flex: () => json({ rows: [{ asset: 'BTC', totalAmount: '9' }], total: 1 }),
    }));
    const balances = await fetchBalances(creds);
    expect(balances.LDO).toBe(3);
    expect(balances.LDBTC).toBeUndefined();
    expect(balances.BTC).toBe(9);
  });

  it('paginates Simple Earn until total rows are collected', async () => {
    const row = (i: number) => ({ asset: 'ETH', totalAmount: '1', i });
    fetchMock.mockImplementation(route({
      flex: (u) => json(u.searchParams.get('current') === '1'
        ? { rows: Array.from({ length: 100 }, (_, i) => row(i)), total: 150 }
        : { rows: Array.from({ length: 50 }, (_, i) => row(i)), total: 150 }),
    }));
    const balances = await fetchBalances(creds);
    expect(balances.ETH).toBe(150);
    const flexCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes('flexible/position'));
    expect(flexCalls).toHaveLength(2);
  });

  it('tolerates missing fields and unexpected bodies', async () => {
    fetchMock.mockImplementation(route({
      spot: () => json({}),
      fund: () => json({ code: 1 }),
    }));
    expect(await fetchBalances(creds)).toEqual({});
    fetchMock.mockImplementation(route({ fund: () => json([{ asset: 'USDT', free: '5' }]) }));
    expect((await fetchBalances(creds)).USDT).toBe(5);
  });
});
