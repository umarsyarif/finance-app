/**
 * Integration scenarios for wallet transfers.
 * Real Postgres + Redis. Run: npm run test:int
 */
process.env.TZ = 'Asia/Seoul';
jest.setTimeout(30000);

import request from 'supertest';
import app, { ready } from '../src/app';
import prisma from '../src/middleware/prismaMiddleware';
import redisClient from '../src/utils/connectRedis';
import { deleteAllSessions } from '../src/services/user.service';

const run = Date.now();
const emails: string[] = [];
type Agent = ReturnType<typeof request.agent>;

async function newUser(tag: string): Promise<Agent> {
  const email = `xfer-${tag}-${run}@example.test`;
  emails.push(email);
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: tag, email, password: 'password123', passwordConfirm: 'password123' });
  expect(res.status).toBe(201);
  return agent;
}

async function wallet(agent: Agent, currency: 'KRW' | 'IDR', balance: number, name = `${currency}-${Math.random()}`) {
  const res = await agent.post('/api/wallets').send({ name, currency, balance });
  expect(res.status).toBe(201);
  return res.body.data.wallet.id as string;
}

async function balanceOf(agent: Agent, id: string) {
  return (await agent.get(`/api/wallets/${id}`)).body.data.wallet.balance as number;
}

const when = '2026-10-05T03:00:00.000Z';

beforeAll(async () => {
  await ready;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.transaction.deleteMany({ where: { wallet: { userId: { in: ids } } } });
  await prisma.transfer.deleteMany({ where: { userId: { in: ids } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
  await prisma.category.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await Promise.all(ids.map((id) => deleteAllSessions(id)));
  await prisma.$disconnect();
  await redisClient.quit();
});

describe('transfer categories', () => {
  it('exist in the database but never show up through the categories API', async () => {
    const u = await newUser('cats');
    const rows = await prisma.category.findMany({ where: { id: { in: ['transfer-out', 'transfer-in'] } } });
    expect(rows.map((r) => [r.id, r.type, r.isTransfer, r.userId])).toEqual(
      expect.arrayContaining([
        ['transfer-out', 'EXPENSE', true, null],
        ['transfer-in', 'INCOME', true, null],
      ])
    );

    const list = await u.get('/api/categories?limit=100');
    expect(list.status).toBe(200);
    const ids = list.body.data.categories.map((c: { id: string }) => c.id);
    expect(ids).not.toContain('transfer-out');
    expect(ids).not.toContain('transfer-in');

    expect((await u.get('/api/categories/transfer-out')).status).toBe(404);
    expect((await u.patch('/api/categories/transfer-out').send({ name: 'x' })).status).toBe(404);
    expect((await u.delete('/api/categories/transfer-in')).status).toBe(404);
  });

  it('cannot be used for a normal transaction', async () => {
    const u = await newUser('cats-tx');
    const w = await wallet(u, 'KRW', 1000);
    const res = await u.post('/api/transactions').send({ walletId: w, categoryId: 'transfer-out', amount: 100, date: when });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Category not found');
    expect(await balanceOf(u, w)).toBe(1000);
  });
});

describe('transfers API', () => {
  let u: Agent;
  let krw: string;
  let krw2: string;
  let idr: string;

  beforeAll(async () => {
    u = await newUser('api');
    krw = await wallet(u, 'KRW', 1_000_000, 'Won bank');
    krw2 = await wallet(u, 'KRW', 0, 'Won cash');
    idr = await wallet(u, 'IDR', 0, 'Rupiah');
  });

  it('creates a cross-currency transfer and moves both balances', async () => {
    const res = await u.post('/api/transfers').send({
      fromWalletId: krw, toWalletId: idr, amountSent: 100_000, amountReceived: 1_150_000, date: when,
    });
    expect(res.status).toBe(201);
    const t = res.body.data.transfer;
    expect(t.from).toMatchObject({ walletId: krw, walletName: 'Won bank', currency: 'KRW', amount: 100_000 });
    expect(t.to).toMatchObject({ walletId: idr, walletName: 'Rupiah', currency: 'IDR', amount: 1_150_000 });
    expect(t.note).toBeNull();
    expect(await balanceOf(u, krw)).toBe(900_000);
    expect(await balanceOf(u, idr)).toBe(1_150_000);

    const rows = await prisma.transaction.findMany({ where: { transferId: t.id }, orderBy: { categoryId: 'desc' } });
    expect(rows.map((r) => [r.categoryId, r.description])).toEqual([
      ['transfer-out', 'Transfer to Rupiah'],
      ['transfer-in', 'Transfer from Won bank'],
    ]);

    const got = await u.get(`/api/transfers/${t.id}`);
    expect(got.status).toBe(200);
    expect(got.body.data.transfer.to.amount).toBe(1_150_000);

    expect((await u.delete(`/api/transfers/${t.id}`)).status).toBe(204);
    expect(await balanceOf(u, krw)).toBe(1_000_000);
    expect(await balanceOf(u, idr)).toBe(0);
    expect(await prisma.transaction.count({ where: { transferId: t.id } })).toBe(0);
    expect(await prisma.transfer.count({ where: { id: t.id } })).toBe(0);
  });

  it('same-currency transfer uses one amount and keeps the note as description', async () => {
    const res = await u.post('/api/transfers').send({
      fromWalletId: krw, toWalletId: krw2, amountSent: 50_000, date: when, note: '  ATM  ',
    });
    expect(res.status).toBe(201);
    const t = res.body.data.transfer;
    expect(t.to.amount).toBe(50_000);
    expect(t.note).toBe('ATM');
    const rows = await prisma.transaction.findMany({ where: { transferId: t.id } });
    expect(rows.every((r) => r.description === 'ATM')).toBe(true);
    expect(await balanceOf(u, krw2)).toBe(50_000);
    await u.delete(`/api/transfers/${t.id}`);
  });

  it.each([
    [{ toWalletId: 'SAME' }, 400, 'Pick two different wallets'],
    [{ toWalletId: 'IDR', amountReceived: undefined }, 400, 'Enter the amount received'],
    [{ toWalletId: 'KRW2', amountReceived: 49_999 }, 400, 'Amounts must match for wallets in the same currency'],
    [{ amountSent: 0 }, 400, 'Amount must be greater than 0'],
    [{ amountSent: 1_000_000_000_000 }, 400, 'Amount is too large'],
    [{ toWalletId: 'nope' }, 404, 'Wallet not found'],
  ])('rejects %j', async (over, status, message) => {
    const ids: Record<string, string> = { SAME: krw, IDR: idr, KRW2: krw2 };
    const body: Record<string, unknown> = { fromWalletId: krw, toWalletId: krw2, amountSent: 50_000, date: when, ...over };
    if (typeof body.toWalletId === 'string' && ids[body.toWalletId]) body.toWalletId = ids[body.toWalletId];
    const res = await u.post('/api/transfers').send(body);
    expect(res.status).toBe(status);
    expect(res.body.message).toContain(message);
    expect(await balanceOf(u, krw)).toBe(1_000_000);
  });

  it('updates amounts and moves to another wallet, keeping every balance right', async () => {
    const t = (await u.post('/api/transfers').send({
      fromWalletId: krw, toWalletId: krw2, amountSent: 10_000, date: when,
    })).body.data.transfer;

    const res = await u.patch(`/api/transfers/${t.id}`).send({
      fromWalletId: krw, toWalletId: idr, amountSent: 20_000, amountReceived: 230_000, date: when, note: 'Exchange',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.transfer.to).toMatchObject({ walletId: idr, amount: 230_000 });
    expect(res.body.data.transfer.note).toBe('Exchange');
    expect(await balanceOf(u, krw)).toBe(980_000);
    expect(await balanceOf(u, krw2)).toBe(0);
    expect(await balanceOf(u, idr)).toBe(230_000);

    await u.delete(`/api/transfers/${t.id}`);
    expect(await balanceOf(u, krw)).toBe(1_000_000);
    expect(await balanceOf(u, idr)).toBe(0);
  });

  it('a rejected update changes nothing', async () => {
    const t = (await u.post('/api/transfers').send({
      fromWalletId: krw, toWalletId: krw2, amountSent: 10_000, date: when,
    })).body.data.transfer;

    const crossNoReceived = await u.patch(`/api/transfers/${t.id}`).send({
      fromWalletId: krw, toWalletId: idr, amountSent: 10_000, date: when,
    });
    expect(crossNoReceived.status).toBe(400);
    expect(crossNoReceived.body.message).toBe('Enter the amount received');

    const same = await u.patch(`/api/transfers/${t.id}`).send({
      fromWalletId: krw, toWalletId: krw, amountSent: 10_000, date: when,
    });
    expect(same.status).toBe(400);

    expect(await balanceOf(u, krw)).toBe(990_000);
    expect(await balanceOf(u, krw2)).toBe(10_000);
    expect(await balanceOf(u, idr)).toBe(0);
    await u.delete(`/api/transfers/${t.id}`);
  });

  it("another user's transfer is not found", async () => {
    const t = (await u.post('/api/transfers').send({
      fromWalletId: krw, toWalletId: krw2, amountSent: 1_000, date: when,
    })).body.data.transfer;
    const other = await newUser('other');
    const otherWallet = await wallet(other, 'KRW', 0);

    expect((await other.get(`/api/transfers/${t.id}`)).status).toBe(404);
    expect((await other.patch(`/api/transfers/${t.id}`).send({
      fromWalletId: otherWallet, toWalletId: krw2, amountSent: 1, date: when,
    })).status).toBe(404);
    expect((await other.delete(`/api/transfers/${t.id}`)).status).toBe(404);
    expect((await other.post('/api/transfers').send({
      fromWalletId: krw, toWalletId: otherWallet, amountSent: 1, date: when,
    })).status).toBe(404);

    expect(await balanceOf(u, krw2)).toBe(1_000);
    await u.delete(`/api/transfers/${t.id}`);
  });

  it('requires a session', async () => {
    expect((await request(app).post('/api/transfers').send({})).status).toBe(401);
  });
});
