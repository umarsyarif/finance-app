/**
 * Integration scenarios for personal API tokens and AI capture.
 * Real Postgres + Redis; the Gemini call (extractTransaction) is mocked.
 * Run: npm run test:int
 */
process.env.TZ = 'Asia/Seoul';

jest.mock('../src/services/ai.service', () => ({
  ...jest.requireActual('../src/services/ai.service'),
  extractTransaction: jest.fn(),
}));

import request from 'supertest';
import app, { ready } from '../src/app';
import prisma from '../src/middleware/prismaMiddleware';
import redisClient from '../src/utils/connectRedis';
import { deleteAllSessions } from '../src/services/user.service';

const run = Date.now();
const emails: string[] = [];
type Agent = ReturnType<typeof request.agent>;

async function newUser(tag: string): Promise<Agent> {
  const email = `cap-${tag}-${run}@example.test`;
  emails.push(email);
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: tag, email, password: 'password123', passwordConfirm: 'password123' });
  expect(res.status).toBe(201);
  return agent;
}

let owner: Agent;

beforeAll(async () => {
  await ready;
  owner = await newUser('owner');
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

describe('personal API token', () => {
  it('starts with no token', async () => {
    const res = await owner.get('/api/users/me/api-token');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ exists: false, createdAt: null, lastUsedAt: null });
  });

  it('issues a token once and only stores its hash', async () => {
    const res = await owner.post('/api/users/me/api-token');
    expect(res.status).toBe(201);
    expect(res.body.data.token).toMatch(/^ft_[A-Za-z0-9_-]{43}$/);

    const status = await owner.get('/api/users/me/api-token');
    expect(status.body.data.exists).toBe(true);
    expect(JSON.stringify((await owner.get('/api/users/me')).body)).not.toContain('apiTokenHash');
  });

  it('is not accepted on normal endpoints', async () => {
    const { body } = await owner.post('/api/users/me/api-token');
    const res = await request(app).get('/api/wallets').set('Authorization', `Bearer ${body.data.token}`);
    expect(res.status).toBe(401);
  });

  it('regenerating invalidates the previous token, revoking invalidates all', async () => {
    const first = (await owner.post('/api/users/me/api-token')).body.data.token;
    const second = (await owner.post('/api/users/me/api-token')).body.data.token;
    const send = (token: string) =>
      request(app).post('/api/capture/text').set('Authorization', `Bearer ${token}`).send({ text: 'x' });

    expect((await send(first)).status).toBe(401);
    expect((await send(second)).status).not.toBe(401);

    expect((await owner.delete('/api/users/me/api-token')).status).toBe(204);
    expect((await send(second)).status).toBe(401);
  });

  it('rejects a missing or malformed token', async () => {
    expect((await request(app).post('/api/capture/text').send({ text: 'x' })).status).toBe(401);
    const res = await request(app).post('/api/capture/text').set('Authorization', 'Bearer nope').send({ text: 'x' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid or missing API token');
  });
});
