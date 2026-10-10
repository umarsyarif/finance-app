/**
 * Integration scenarios for "one main wallet per currency".
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
  const email = `main-${tag}-${run}@example.test`;
  emails.push(email);
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: tag, email, password: 'password123', passwordConfirm: 'password123' });
  expect(res.status).toBe(201);
  return agent;
}

const wallet = async (a: Agent, name: string, currency: 'KRW' | 'IDR') => {
  const res = await a.post('/api/wallets').send({ name, currency, balance: 0 });
  expect(res.status).toBe(201);
  return res.body.data.wallet.id as string;
};

// name -> isMain for the user's wallets
const mains = async (a: Agent) => {
  const res = await a.get('/api/wallets');
  return Object.fromEntries(res.body.data.wallets.map((w: { name: string; isMain: boolean }) => [w.name, w.isMain]));
};

beforeAll(async () => {
  await ready;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await Promise.all(ids.map((id) => deleteAllSessions(id)));
  await prisma.$disconnect();
  await redisClient.quit();
});

describe('one main wallet per currency', () => {
  it('the first wallet of each currency becomes main; later ones do not', async () => {
    const u = await newUser('create');
    await wallet(u, 'NH', 'KRW');
    await wallet(u, 'Toss', 'KRW');
    await wallet(u, 'Jago', 'IDR');
    expect(await mains(u)).toEqual({ NH: true, Toss: false, Jago: true });
  });

  it('making a KRW wallet main keeps the IDR main', async () => {
    const u = await newUser('set');
    await wallet(u, 'NH', 'KRW');
    const toss = await wallet(u, 'Toss', 'KRW');
    await wallet(u, 'Jago', 'IDR');
    expect((await u.put(`/api/wallets/${toss}/main`)).status).toBe(200);
    expect(await mains(u)).toEqual({ NH: false, Toss: true, Jago: true });
  });

  it('deleting a main wallet promotes another wallet of that currency', async () => {
    const u = await newUser('delete');
    const nh = await wallet(u, 'NH', 'KRW');
    await wallet(u, 'Toss', 'KRW');
    await wallet(u, 'Jago', 'IDR');
    expect((await u.delete(`/api/wallets/${nh}`)).status).toBe(204);
    expect(await mains(u)).toEqual({ Toss: true, Jago: true });
  });

  it('moving an empty main wallet to another currency rebalances both currencies', async () => {
    const u = await newUser('currency');
    const nh = await wallet(u, 'NH', 'KRW');
    await wallet(u, 'Toss', 'KRW');
    await wallet(u, 'Jago', 'IDR');
    expect((await u.patch(`/api/wallets/${nh}`).send({ currency: 'IDR' })).status).toBe(200);
    expect(await mains(u)).toEqual({ NH: false, Toss: true, Jago: true });
  });
});
