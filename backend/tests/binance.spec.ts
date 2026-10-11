import { sign, checkReadOnly, fetchBalances, BinanceError } from '../src/services/binance.service';

const creds = { apiKey: 'k', apiSecret: 's' };
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
    expect(String(url)).not.toContain('s&');
    expect((init.headers as Record<string, string>)['X-MBX-APIKEY']).toBe('k');
  });

  it.each(['enableSpotAndMarginTrading', 'enableWithdrawals', 'enableInternalTransfer', 'enableMargin', 'enableFutures', 'permitsUniversalTransfer', 'enableVanillaOptions'])(
    'rejects a key with %s', async (perm) => {
      fetchMock.mockImplementation(() => json(restrictions({ [perm]: true })));
      await expect(checkReadOnly(creds)).rejects.toThrow('Use a read-only key: turn off trading, withdrawals and transfers');
    });

  it('rejects a key without reading', async () => {
    fetchMock.mockImplementation(() => json(restrictions({ enableReading: false })));
    await expect(checkReadOnly(creds)).rejects.toBeInstanceOf(BinanceError);
  });

  it('surfaces Binance errors without the secret', async () => {
    fetchMock.mockImplementation(() => json({ code: -2014, msg: 'API-key format invalid.' }, 401));
    await expect(checkReadOnly(creds)).rejects.toThrow('API-key format invalid.');
  });
});

describe('fetchBalances', () => {
  it('sums spot, funding and both Simple Earn kinds, skipping LD tokens', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/v3/account')) return json({ balances: [{ asset: 'BTC', free: '0.1', locked: '0.05' }, { asset: 'LDBTC', free: '9', locked: '0' }] });
      if (u.includes('get-funding-asset')) return json([{ asset: 'BTC', free: '0.01', locked: '0', freeze: '0' }, { asset: 'USDT', free: '50', locked: '0', freeze: '0' }]);
      if (u.includes('flexible/position')) return json({ rows: [{ asset: 'ETH', totalAmount: '1.5' }], total: 1 });
      if (u.includes('locked/position')) return json({ rows: [{ asset: 'ETH', amount: '0.5' }], total: 1 });
      return json({}, 404);
    });
    const balances = await fetchBalances(creds);
    expect(balances.BTC).toBeCloseTo(0.16);
    expect(balances.ETH).toBeCloseTo(2);
    expect(balances.USDT).toBe(50);
    expect(balances.LDBTC).toBeUndefined();
    const funding = fetchMock.mock.calls.find(([u]) => String(u).includes('get-funding-asset'))!;
    expect(funding[1].method).toBe('POST');
  });
});
