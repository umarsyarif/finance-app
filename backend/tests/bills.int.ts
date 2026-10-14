/**
 * Integration scenarios for the bills API and the wallet-delete guard.
 * Real Postgres + Redis.
 */
jest.setTimeout(60000);

import request from 'supertest';
import app, { ready } from '../src/app';
import prisma from '../src/middleware/prismaMiddleware';
import redisClient from '../src/utils/connectRedis';
import { deleteAllSessions } from '../src/services/user.service';

const run = Date.now();
const emails: string[] = [];
type Agent = ReturnType<typeof request.agent>;

async function newUser(tag: string) {
  const email = `bills-${tag}-${run}@example.test`;
  emails.push(email);
  const agent: Agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: tag, email, password: 'password123', passwordConfirm: 'password123' });
  expect(res.status).toBe(201);
  const wallet = (await agent.post('/api/wallets').send({ name: 'Cash', currency: 'KRW', balance: 0 })).body.data.wallet;
  const category = (await agent.post('/api/categories').send({ name: 'Rent', type: 'EXPENSE' })).body.data.category;
  return { agent, walletId: wallet.id as string, categoryId: category.id as string };
}

beforeAll(async () => { await ready; });

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.bill.deleteMany({ where: { userId: { in: ids } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
  await prisma.category.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await Promise.all(ids.map((id) => deleteAllSessions(id)));
  await prisma.$disconnect();
  await redisClient.quit();
});

const base = (u: { walletId: string; categoryId: string }) => ({
  name: 'Rent', amount: 500000, currency: 'KRW', walletId: u.walletId, categoryId: u.categoryId, dayOfMonth: 25, remindDaysBefore: 1,
});

describe('bills', () => {
  it('creates and lists', async () => {
    const u = await newUser('create');
    const res = await u.agent.post('/api/bills').send(base(u));
    expect(res.status).toBe(201);
    const bill = res.body.data.bill;
    expect(bill).toMatchObject({ active: true, amount: 500000, wallet: { name: 'Cash' }, category: { name: 'Rent' } });
    const list = await u.agent.get('/api/bills');
    expect(list.body.data.bills.map((b: any) => b.id)).toEqual([bill.id]);
  });

  it('rejects invalid input', async () => {
    const u = await newUser('invalid');
    for (const bad of [
      { dayOfMonth: 0 }, { dayOfMonth: 32 }, { remindDaysBefore: 2 }, { amount: 0 },
      { currency: 'USD' }, { name: '' }, { name: 'x'.repeat(61) },
    ]) {
      expect((await u.agent.post('/api/bills').send({ ...base(u), ...bad })).status).toBe(400);
    }
  });

  it('scopes by owner', async () => {
    const a = await newUser('own-a');
    const b = await newUser('own-b');
    const bill = (await a.agent.post('/api/bills').send(base(a))).body.data.bill;
    const r = await b.agent.post('/api/bills').send({ ...base(b), walletId: a.walletId });
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('Wallet not found');
    for (const res of [await b.agent.patch(`/api/bills/${bill.id}`).send({ active: false }), await b.agent.delete(`/api/bills/${bill.id}`)]) {
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Bill not found');
    }
    expect((await b.agent.get('/api/bills')).body.data.bills).toEqual([]);
  });

  it('checks category, currency and optional refs', async () => {
    const u = await newUser('refs');
    const income = (await u.agent.post('/api/categories').send({ name: 'Pay', type: 'INCOME' })).body.data.category;
    const r1 = await u.agent.post('/api/bills').send({ ...base(u), categoryId: income.id });
    expect(r1.status).toBe(400);
    expect(r1.body.message).toBe('Choose an expense category');
    const idr = (await u.agent.post('/api/wallets').send({ name: 'Rp', currency: 'IDR', balance: 0 })).body.data.wallet;
    const r2 = await u.agent.post('/api/bills').send({ ...base(u), walletId: idr.id });
    expect(r2.status).toBe(400);
    expect(r2.body.message).toBe("Wallet currency doesn't match");
    const r3 = await u.agent.post('/api/bills').send({ name: 'Gym', amount: 1, currency: 'KRW', dayOfMonth: 1, remindDaysBefore: 0 });
    expect(r3.status).toBe(201);
    expect(r3.body.data.bill.wallet).toBeNull();
  });

  it('ignores unknown fields on patch', async () => {
    const u = await newUser('patch');
    const bill = (await u.agent.post('/api/bills').send(base(u))).body.data.bill;
    const res = await u.agent.patch(`/api/bills/${bill.id}`).send({ active: false, userId: 'x' });
    expect(res.status).toBe(200);
    expect(res.body.data.bill.active).toBe(false);
    expect((await prisma.bill.findUniqueOrThrow({ where: { id: bill.id } })).userId).not.toBe('x');
  });

  it('blocks deleting a wallet that has bills', async () => {
    const u = await newUser('guard');
    const bill = (await u.agent.post('/api/bills').send(base(u))).body.data.bill;
    const r = await u.agent.delete(`/api/wallets/${u.walletId}`);
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('Cannot delete wallet with 1 bill(s)');
    expect((await u.agent.delete(`/api/bills/${bill.id}`)).status).toBe(204);
    expect((await u.agent.delete(`/api/wallets/${u.walletId}`)).status).toBe(204);
  });
});
