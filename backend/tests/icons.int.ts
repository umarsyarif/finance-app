/**
 * Integration scenarios for category icons and wallet descriptions.
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
  const email = `icons-${tag}-${run}@example.test`;
  emails.push(email);
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: tag, email, password: 'password123', passwordConfirm: 'password123' });
  expect(res.status).toBe(201);
  return agent;
}

beforeAll(async () => {
  await ready;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.transaction.deleteMany({ where: { wallet: { userId: { in: ids } } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
  await prisma.category.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await Promise.all(ids.map((id) => deleteAllSessions(id)));
  await prisma.$disconnect();
  await redisClient.quit();
});

describe('category icon', () => {
  it('is saved on create, changed and cleared on update, and rejected when malformed', async () => {
    const u = await newUser('cat');
    const created = await u.post('/api/categories').send({ name: 'Food', type: 'EXPENSE', icon: 'utensils' });
    expect(created.status).toBe(201);
    const id = created.body.data.category.id;
    expect(created.body.data.category.icon).toBe('utensils');

    const changed = await u.patch(`/api/categories/${id}`).send({ icon: 'shopping-cart' });
    expect(changed.status).toBe(200);
    expect(changed.body.data.category.icon).toBe('shopping-cart');

    const cleared = await u.patch(`/api/categories/${id}`).send({ icon: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.category.icon).toBeNull();

    expect((await u.post('/api/categories').send({ name: 'Bad', type: 'EXPENSE', icon: '<svg>' })).status).toBe(400);
  });

  it('is included in the category breakdown', async () => {
    const u = await newUser('breakdown');
    const wallet = (await u.post('/api/wallets').send({ name: 'Won', currency: 'KRW', balance: 0 })).body.data.wallet.id;
    const cat = (await u.post('/api/categories').send({ name: 'Coffee', type: 'EXPENSE', icon: 'coffee' })).body.data.category.id;
    await u.post('/api/transactions').send({ walletId: wallet, categoryId: cat, amount: 4500, date: '2026-10-05T03:00:00.000Z', description: 'latte' });

    const res = await u.get(`/api/stats/category-breakdown?walletIds=${wallet}&startDate=2026-09-30T15:00:00.000Z&endDate=2026-10-31T14:59:59.999Z`);
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ categoryName: 'Coffee', icon: 'coffee' });
  });
});

describe('wallet description', () => {
  it('is trimmed on create, updated, cleared with an empty string, and capped at 60 characters', async () => {
    const u = await newUser('wallet');
    const created = await u.post('/api/wallets').send({ name: 'Won', currency: 'KRW', balance: 0, description: '  Shinhan debit  ' });
    expect(created.status).toBe(201);
    const id = created.body.data.wallet.id;
    expect(created.body.data.wallet.description).toBe('Shinhan debit');

    const changed = await u.patch(`/api/wallets/${id}`).send({ description: 'Jago main pocket' });
    expect(changed.status).toBe(200);
    expect(changed.body.data.wallet.description).toBe('Jago main pocket');

    const cleared = await u.patch(`/api/wallets/${id}`).send({ description: '' });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.wallet.description).toBeNull();

    expect((await u.patch(`/api/wallets/${id}`).send({ description: 'x'.repeat(61) })).status).toBe(400);
  });
});
