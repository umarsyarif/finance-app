/**
 * Integration scenarios against real Postgres + Redis (no mocks).
 * Run: npm run test:int   (needs `make infra` and migrated DB)
 *
 * Each scenario checks an invariant that mocked unit tests cannot see:
 * DB rounding, concurrent requests, shared session state, unvalidated bodies.
 */
process.env.TZ = 'Asia/Seoul';

import request from 'supertest';
import app, { ready } from '../src/app';
import prisma from '../src/middleware/prismaMiddleware';
import redisClient from '../src/utils/connectRedis';
import { deleteAllSessions } from '../src/services/user.service';

const run = Date.now();
const emails: string[] = [];

type Agent = ReturnType<typeof request.agent>;

// register + login share one rate-limit bucket (10 / 15 min), so keep users few
async function newUser(tag: string): Promise<Agent> {
  const email = `int-${tag}-${run}@example.test`;
  emails.push(email);
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: tag, email, password: 'password123', passwordConfirm: 'password123' });
  expect(res.status).toBe(201);
  return agent;
}

async function createWallet(agent: Agent, balance: number, currency = 'KRW') {
  const res = await agent.post('/api/wallets').send({ name: `W${Math.random()}`, currency, balance });
  expect(res.status).toBe(201);
  return res.body.data.wallet.id as string;
}

async function createCategory(agent: Agent, type: 'INCOME' | 'EXPENSE') {
  const res = await agent.post('/api/categories').send({ name: `C${Math.random()}`, type });
  expect(res.status).toBe(201);
  return res.body.data.category.id as string;
}

async function createTx(agent: Agent, walletId: string, categoryId: string, amount: number) {
  return agent
    .post('/api/transactions')
    .send({ walletId, categoryId, amount, description: 'int', date: '2026-10-05T12:00:00Z' });
}

async function balanceOf(agent: Agent, walletId: string): Promise<number> {
  const res = await agent.get(`/api/wallets/${walletId}`);
  return res.body.data.wallet.balance;
}

// Ground truth: initial + sum(income) - sum(expense), computed from the rows themselves
async function expectedBalance(walletId: string, initial: number): Promise<number> {
  const txs = await prisma.transaction.findMany({ where: { walletId }, include: { category: true } });
  return txs.reduce(
    (sum, t) => sum + (t.category.type === 'INCOME' ? 1 : -1) * t.amount.toNumber(),
    initial
  );
}

let alice: Agent;
let bob: Agent;

beforeAll(async () => {
  await ready;
  alice = await newUser('alice');
  bob = await newUser('bob');
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.transaction.deleteMany({ where: { wallet: { userId: { in: ids } } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
  await prisma.category.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await Promise.all(ids.map(deleteAllSessions));
  await prisma.$disconnect();
  await redisClient.quit();
});

describe('wallet balance invariant', () => {
  it('holds across create, edit amount, flip category type, move wallet, delete', async () => {
    const w1 = await createWallet(alice, 1000);
    const w2 = await createWallet(alice, 500);
    const inc = await createCategory(alice, 'INCOME');
    const exp = await createCategory(alice, 'EXPENSE');

    const t1 = (await createTx(alice, w1, exp, 100)).body.data.transaction.id;
    const t2 = (await createTx(alice, w1, inc, 250)).body.data.transaction.id;
    await alice.patch(`/api/transactions/${t1}`).send({ amount: 40 });
    await alice.patch(`/api/transactions/${t2}`).send({ categoryId: exp });
    await alice.patch(`/api/transactions/${t1}`).send({ walletId: w2, categoryId: inc, amount: 70 });
    await alice.delete(`/api/transactions/${t2}`);

    expect(await balanceOf(alice, w1)).toBeCloseTo(await expectedBalance(w1, 1000), 4);
    expect(await balanceOf(alice, w2)).toBeCloseTo(await expectedBalance(w2, 500), 4);
  });

  it('refuses to flip the type of a category that has transactions', async () => {
    const w = await createWallet(alice, 1000);
    const cat = await createCategory(alice, 'EXPENSE');
    await createTx(alice, w, cat, 300);

    const res = await alice.patch(`/api/categories/${cat}`).send({ type: 'INCOME' });

    expect(res.status).toBe(400);
    expect(await balanceOf(alice, w)).toBeCloseTo(await expectedBalance(w, 1000), 4);
  });

  it('holds under concurrent creates on one wallet', async () => {
    const w = await createWallet(alice, 0);
    const exp = await createCategory(alice, 'EXPENSE');
    await Promise.all(Array.from({ length: 20 }, () => createTx(alice, w, exp, 7)));
    expect(await balanceOf(alice, w)).toBeCloseTo(-140, 4);
  });

  it('holds under concurrent edits of the same transaction', async () => {
    const w = await createWallet(alice, 1000);
    const exp = await createCategory(alice, 'EXPENSE');
    const t = (await createTx(alice, w, exp, 100)).body.data.transaction.id;

    await Promise.all([10, 20, 30, 40, 50].map((amount) =>
      alice.patch(`/api/transactions/${t}`).send({ amount })
    ));

    expect(await balanceOf(alice, w)).toBeCloseTo(await expectedBalance(w, 1000), 4);
  });

  it('holds under concurrent deletes of the same transaction', async () => {
    const w = await createWallet(alice, 1000);
    const exp = await createCategory(alice, 'EXPENSE');
    const t = (await createTx(alice, w, exp, 100)).body.data.transaction.id;

    const results = await Promise.all(Array.from({ length: 5 }, () => alice.delete(`/api/transactions/${t}`)));

    expect(results.map((r) => r.status).sort()).toEqual([204, 404, 404, 404, 404]);
    expect(await balanceOf(alice, w)).toBeCloseTo(1000, 4);
  });
});

describe('money precision', () => {
  it('sums 0.1 + 0.2 exactly', async () => {
    const w = await createWallet(alice, 0);
    const inc = await createCategory(alice, 'INCOME');
    await createTx(alice, w, inc, 0.1);
    await createTx(alice, w, inc, 0.2);
    expect(await balanceOf(alice, w)).toBe(0.3);
  });

  it('keeps balance consistent with stored (rounded) amounts beyond 4 decimals', async () => {
    const w = await createWallet(alice, 0);
    const exp = await createCategory(alice, 'EXPENSE');
    const t = (await createTx(alice, w, exp, 0.00005)).body.data.transaction.id;
    await alice.delete(`/api/transactions/${t}`);
    expect(await balanceOf(alice, w)).toBe(0);
  });

  it('rejects an amount beyond DECIMAL(19,4) with 400, not 500', async () => {
    const w = await createWallet(alice, 0);
    const exp = await createCategory(alice, 'EXPENSE');
    const res = await createTx(alice, w, exp, 1e16);
    expect(res.status).toBe(400);
  });
});

describe('wallets', () => {
  it('has exactly one main wallet after concurrent set-main calls', async () => {
    const ids = await Promise.all([1, 2, 3, 4].map(() => createWallet(bob, 0)));
    await Promise.all(ids.map((id) => bob.put(`/api/wallets/${id}/main`)));
    const res = await bob.get('/api/wallets/user');
    const mains = res.body.data.wallets.filter((w: { isMain: boolean }) => w.isMain);
    expect(mains).toHaveLength(1);
  });

  it('rejects a malformed reorder body with 400, not 500', async () => {
    const res = await bob.put('/api/wallets/order').send({});
    expect(res.status).toBe(400);
  });

  it('does not let a transaction move between wallets of different currencies', async () => {
    const krw = await createWallet(bob, 0, 'KRW');
    const idr = await createWallet(bob, 0, 'IDR');
    const exp = await createCategory(bob, 'EXPENSE');
    const t = (await createTx(bob, krw, exp, 5000)).body.data.transaction.id;
    const res = await bob.patch(`/api/transactions/${t}`).send({ walletId: idr });
    expect(res.status).toBe(400);
  });

  it('does not let a wallet with transactions change currency', async () => {
    const w = await createWallet(bob, 0, 'KRW');
    const exp = await createCategory(bob, 'EXPENSE');
    await createTx(bob, w, exp, 5000);
    const res = await bob.patch(`/api/wallets/${w}`).send({ currency: 'IDR' });
    expect(res.status).toBe(400);
  });
});

describe('query validation', () => {
  it.each(['limit=0', 'page=0', 'limit=-1', 'page=abc'])('GET /api/transactions?%s is 400, not 500', async (q) => {
    const res = await alice.get(`/api/transactions?${q}`);
    expect(res.status).toBe(400);
  });

  it('rejects oversized page sizes instead of loading everything', async () => {
    expect((await alice.get('/api/transactions?limit=100000')).status).toBe(400);
    expect((await alice.get('/api/transactions?limit=1000')).status).toBe(200);
  });
});

describe('sessions', () => {
  it('logging out on one device keeps the other device signed in', async () => {
    const email = emails[1]; // bob
    const phone = request.agent(app);
    expect((await phone.post('/api/auth/login').send({ email, password: 'password123' })).status).toBe(200);

    await bob.get('/api/auth/logout');

    expect((await phone.get('/api/users/me')).status).toBe(200);
  });

  it('treats email case-insensitively on register and login', async () => {
    const dup = await request(app)
      .post('/api/auth/register')
      .send({ name: 'x', email: emails[0].toUpperCase(), password: 'password123', passwordConfirm: 'password123' });
    expect(dup.status).toBe(409);

    const login = await request(app).post('/api/auth/login').send({ email: emails[0].toUpperCase(), password: 'password123' });
    expect(login.status).toBe(200);
  });
});
