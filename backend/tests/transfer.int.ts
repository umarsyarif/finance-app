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
