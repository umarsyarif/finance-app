/**
 * Integration scenarios for /api/assets. Real Postgres + Redis; outbound HTTPS (Binance, FX) is mocked.
 * Run: npm run test:int
 */
process.env.TZ = 'Asia/Seoul';
process.env.ASSETS_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64');
jest.setTimeout(30000);

import request from 'supertest';
import app, { ready } from '../src/app';
import prisma from '../src/middleware/prismaMiddleware';
import redisClient from '../src/utils/connectRedis';
import { deleteAllSessions } from '../src/services/user.service';
import * as cryptoBox from '../src/services/crypto-box';
import { resetPriceCache } from '../src/services/assets/prices';
import { resetBinanceCache } from '../src/services/assets/sources';

const run = Date.now();
const emails: string[] = [];
type Agent = ReturnType<typeof request.agent>;

async function newUser(tag: string): Promise<Agent> {
  const email = `assets-${tag}-${run}@example.test`;
  emails.push(email);
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: tag, email, password: 'password123', passwordConfirm: 'password123' });
  expect(res.status).toBe(201);
  return agent;
}

const API_KEY = 'k'.repeat(64);
const API_SECRET = 's'.repeat(64);
const GOLD_USD_PER_G = 3110.35 / 31.1035;
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

let flags = { trading: false, badKey: false, down: false };
const realFetch = global.fetch;

beforeAll(async () => {
  await ready;
});

beforeEach(() => {
  flags = { trading: false, badKey: false, down: false };
  resetPriceCache();
  resetBinanceCache();
  jest.spyOn(global, 'fetch').mockImplementation((input: any, init?: any) => {
    const url = String(typeof input === 'string' ? input : input.url ?? input);
    if (!url.startsWith('https://')) return realFetch(input, init);
    if (flags.down) return Promise.reject(new Error('network down'));
    if (url.includes('apiRestrictions')) {
      if (flags.badKey) return json({ code: -2014, msg: 'API-key format invalid.' }, 401);
      return json({ enableReading: true, enableSpotAndMarginTrading: flags.trading, enableWithdrawals: false });
    }
    if (url.includes('/api/v3/account')) return json({ balances: [{ asset: 'BTC', free: '0.1', locked: '0' }] });
    if (url.includes('get-funding-asset')) return json([]);
    if (url.includes('flexible/position') || url.includes('locked/position')) return json({ rows: [] });
    if (url.includes('ticker/price')) return json([{ symbol: 'PAXGUSDT', price: '3110.35' }, { symbol: 'BTCUSDT', price: '80000' }]);
    if (url.includes('open.er-api.com')) return json({ result: 'success', rates: { KRW: 1400, IDR: 16000 } });
    return Promise.reject(new Error(`unmocked ${url}`));
  });
});

afterEach(() => jest.restoreAllMocks());

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.assetLot.deleteMany({ where: { userId: { in: ids } } });
  await prisma.assetCost.deleteMany({ where: { userId: { in: ids } } });
  await prisma.binanceConnection.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await Promise.all(ids.map((id) => deleteAllSessions(id)));
  await prisma.$disconnect();
  await redisClient.quit();
});

const lot = (over: object = {}) => ({
  assetClass: 'GOLD', symbol: 'XAU', date: '2026-01-10T00:00:00.000Z', quantity: 10, totalPaid: 14000000, currency: 'IDR', ...over,
});

describe('/api/assets', () => {
  it('requires a session', async () => {
    expect((await request(app).get('/api/assets?currency=IDR')).status).toBe(401);
  });

  it('records lots and values the gold holding', async () => {
    const u = await newUser('lots');
    expect((await u.post('/api/assets/lots').send(lot())).status).toBe(201);
    expect((await u.post('/api/assets/lots').send(lot({ date: '2026-02-10T00:00:00.000Z', quantity: -2, totalPaid: -3000000 }))).status).toBe(201);

    const list = await u.get('/api/assets/lots?assetClass=GOLD');
    expect(list.status).toBe(200);
    expect(list.body.data.lots).toHaveLength(2);
    expect(Number(list.body.data.lots[0].quantity)).toBe(-2);

    const pf = await u.get('/api/assets?currency=IDR');
    expect(pf.status).toBe(200);
    const g = pf.body.data.holdings.find((h: any) => h.assetClass === 'GOLD');
    expect(g.quantity).toBe(8);
    expect(g.value).toBeCloseTo(8 * GOLD_USD_PER_G * 16000, 0);
    expect(g.cost).toBeCloseTo(11000000, 0);
  });

  it('validates lots', async () => {
    const u = await newUser('validation');
    for (const bad of [{ assetClass: 'CRYPTO' }, { assetClass: 'STOCKZ' }, { quantity: 0 }, { currency: 'EUR' }]) {
      expect((await u.post('/api/assets/lots').send(lot(bad))).status).toBe(400);
    }
  });

  it("doesn't let another user touch a lot", async () => {
    const a = await newUser('owner');
    const b = await newUser('other');
    const id = (await a.post('/api/assets/lots').send(lot())).body.data.lot.id;
    expect((await b.patch(`/api/assets/lots/${id}`).send({ quantity: 99 })).status).toBe(404);
    expect((await b.delete(`/api/assets/lots/${id}`)).status).toBe(404);
    const row = await prisma.assetLot.findUnique({ where: { id } });
    expect(row?.quantity.toNumber()).toBe(10);
    expect((await a.patch(`/api/assets/lots/${id}`).send({ quantity: 5 })).status).toBe(200);
    expect((await a.delete(`/api/assets/lots/${id}`)).status).toBe(204);
  });

  it('connects Binance with a read-only key only, and never leaks the secret', async () => {
    const u = await newUser('binance');
    const userId = (await prisma.user.findUnique({ where: { email: `assets-binance-${run}@example.test` } }))!.id;

    flags.trading = true;
    const t = await u.put('/api/assets/sources/binance').send({ apiKey: API_KEY, apiSecret: API_SECRET });
    expect(t.status).toBe(400);
    expect(t.body.message).toBe('Use a read-only key: turn off trading, withdrawals and transfers');
    expect(await prisma.binanceConnection.count({ where: { userId } })).toBe(0);

    flags = { ...flags, trading: false, badKey: true };
    const bad = await u.put('/api/assets/sources/binance').send({ apiKey: API_KEY, apiSecret: API_SECRET });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toBe('API-key format invalid.');
    expect(await prisma.binanceConnection.count({ where: { userId } })).toBe(0);

    flags.badKey = false;
    const ok = await u.put('/api/assets/sources/binance').send({ apiKey: API_KEY, apiSecret: API_SECRET });
    expect(ok.status).toBe(200);
    expect(ok.body.data.connected).toBe(true);
    expect(ok.text).not.toContain(API_KEY);
    expect(ok.text).not.toContain(API_SECRET);
    const row = await prisma.binanceConnection.findUnique({ where: { userId } });
    expect(row!.secretEnc).not.toContain(API_SECRET);

    const pf = await u.get('/api/assets?currency=KRW');
    expect(pf.status).toBe(200);
    expect(pf.body.data.holdings.find((h: any) => h.symbol === 'BTC').source).toBe('binance');
    expect(pf.text).not.toContain(API_KEY);
    expect(pf.text).not.toContain(API_SECRET);
  });

  it('stores and clears a per-holding cost', async () => {
    const u = await newUser('costs');
    await u.put('/api/assets/sources/binance').send({ apiKey: API_KEY, apiSecret: API_SECRET });
    expect((await u.put('/api/assets/costs/CRYPTO/BTC').send({ costAmount: 5000, costCurrency: 'USD' })).status).toBe(200);
    const btc = async () => (await u.get('/api/assets?currency=KRW')).body.data.holdings.find((h: any) => h.symbol === 'BTC');
    expect((await btc()).cost).toBeCloseTo(5000 * 1400, 0);
    expect((await u.put('/api/assets/costs/CRYPTO/BTC').send({ costAmount: null })).status).toBe(200);
    expect((await btc()).cost).toBeNull();
    expect((await u.put('/api/assets/costs/NOPE/BTC').send({ costAmount: 1, costCurrency: 'USD' })).status).toBe(400);
  });

  it('disconnects Binance', async () => {
    const u = await newUser('disconnect');
    await u.put('/api/assets/sources/binance').send({ apiKey: API_KEY, apiSecret: API_SECRET });
    expect((await u.get('/api/assets?currency=KRW')).body.data.sources.binance.connected).toBe(true);
    expect((await u.delete('/api/assets/sources/binance')).status).toBe(204);
    expect((await u.get('/api/assets?currency=KRW')).body.data.sources.binance.connected).toBe(false);
  });

  it('answers 503 for Binance when encryption is not configured, gold still works', async () => {
    const u = await newUser('noenc');
    jest.spyOn(cryptoBox, 'isEncryptionConfigured').mockReturnValue(false);
    const res = await u.put('/api/assets/sources/binance').send({ apiKey: API_KEY, apiSecret: API_SECRET });
    expect(res.status).toBe(503);
    expect(res.body.message).toBe("Binance sync isn't set up");
    await u.post('/api/assets/lots').send(lot());
    expect((await u.get('/api/assets?currency=IDR')).status).toBe(200);
  });

  it('answers 503 when prices are down, lots still list', async () => {
    const u = await newUser('down');
    await u.post('/api/assets/lots').send(lot());
    resetPriceCache();
    flags.down = true;
    const res = await u.get('/api/assets?currency=IDR');
    expect(res.status).toBe(503);
    expect(res.body.message).toBe('Prices are unavailable right now');
    expect((await u.get('/api/assets/lots')).status).toBe(200);
  });
});
