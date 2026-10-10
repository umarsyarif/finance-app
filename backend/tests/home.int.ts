/**
 * Integration scenarios for the Home overview queries.
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
  const email = `home-${tag}-${run}@example.test`;
  emails.push(email);
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: tag, email, password: 'password123', passwordConfirm: 'password123' });
  expect(res.status).toBe(201);
  return agent;
}

const wallet = async (a: Agent, currency: string, name: string) =>
  (await a.post('/api/wallets').send({ name, currency, balance: 0 })).body.data.wallet.id as string;
const category = async (a: Agent, name: string, type: 'INCOME' | 'EXPENSE') =>
  (await a.post('/api/categories').send({ name, type })).body.data.category.id as string;
const tx = async (a: Agent, walletId: string, categoryId: string, amount: number) =>
  expect((await a.post('/api/transactions').send({ walletId, categoryId, amount, date: when, description: 'x' })).status).toBe(201);

const when = '2026-10-05T03:00:00.000Z';
const range = 'startDate=2026-09-30T15:00:00.000Z&endDate=2026-10-31T14:59:59.999Z';

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

describe('category breakdown type', () => {
  it('returns expense categories by default and income categories with type=INCOME', async () => {
    const u = await newUser('breakdown');
    const w = await wallet(u, 'KRW', 'Won');
    await tx(u, w, await category(u, 'Food', 'EXPENSE'), 7000);
    await tx(u, w, await category(u, 'Salary', 'INCOME'), 3_000_000);

    const expense = await u.get(`/api/stats/category-breakdown?walletIds=${w}&${range}`);
    expect(expense.status).toBe(200);
    expect(expense.body.data.map((c: { categoryName: string }) => c.categoryName)).toEqual(['Food']);

    const income = await u.get(`/api/stats/category-breakdown?walletIds=${w}&${range}&type=INCOME`);
    expect(income.status).toBe(200);
    expect(income.body.data.map((c: { categoryName: string }) => c.categoryName)).toEqual(['Salary']);
    expect(income.body.data[0].percentage).toBe(100);

    expect((await u.get(`/api/stats/category-breakdown?type=BOTH`)).status).toBe(400);
  });
});

describe('transactions walletIds', () => {
  it('returns rows from exactly the listed wallets and ignores other users\' wallets', async () => {
    const u = await newUser('multi');
    const a = await wallet(u, 'KRW', 'A');
    const b = await wallet(u, 'KRW', 'B');
    const c = await wallet(u, 'IDR', 'C');
    const food = await category(u, 'Food', 'EXPENSE');
    await tx(u, a, food, 1);
    await tx(u, b, food, 2);
    await tx(u, c, food, 3);

    const other = await newUser('other');
    const foreign = await wallet(other, 'KRW', 'Foreign');
    await tx(other, foreign, await category(other, 'Food', 'EXPENSE'), 99);

    const res = await u.get(`/api/transactions?walletIds=${a},${b},${foreign}&limit=5`);
    expect(res.status).toBe(200);
    const amounts = res.body.data.transactions.map((t: { amount: number }) => t.amount).sort();
    expect(amounts).toEqual([1, 2]);

    const single = await u.get(`/api/transactions?walletId=${c}`);
    expect(single.body.data.transactions.map((t: { amount: number }) => t.amount)).toEqual([3]);
  });
});
