/**
 * Integration scenarios for the wallet balance lock.
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
  const email = `balance-${tag}-${run}@example.test`;
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

describe('wallet balance lock', () => {
  it('lets an empty wallet change its balance', async () => {
    const u = await newUser('empty');
    const id = (await u.post('/api/wallets').send({ name: 'Cash', currency: 'KRW', balance: 1000 })).body.data.wallet.id;
    const res = await u.patch(`/api/wallets/${id}`).send({ balance: 5000 });
    expect(res.status).toBe(200);
    expect(res.body.data.wallet.balance).toBe(5000);
  });

  it('refuses a balance change once the wallet has transactions, but allows other edits', async () => {
    const u = await newUser('used');
    const id = (await u.post('/api/wallets').send({ name: 'Cash', currency: 'KRW', balance: 1000 })).body.data.wallet.id;
    const cat = (await u.post('/api/categories').send({ name: 'Food', type: 'EXPENSE' })).body.data.category.id;
    await u.post('/api/transactions').send({ walletId: id, categoryId: cat, amount: 300, date: '2026-10-05T03:00:00.000Z', description: 'x' });

    const refused = await u.patch(`/api/wallets/${id}`).send({ balance: 99999 });
    expect(refused.status).toBe(400);
    expect(refused.body.message).toBe("Can't change the balance of a wallet with 1 transaction(s). Add an income or expense instead.");
    expect((await u.get(`/api/wallets/${id}`)).body.data.wallet.balance).toBe(700);

    // The wallet form always resends the current balance; an unchanged value must not block other edits
    const renamed = await u.patch(`/api/wallets/${id}`).send({ name: 'Wallet', balance: 700 });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.wallet.name).toBe('Wallet');
  });
});
