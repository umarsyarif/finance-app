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

import crypto from 'crypto';
import request from 'supertest';
import app, { ready } from '../src/app';
import prisma from '../src/middleware/prismaMiddleware';
import redisClient from '../src/utils/connectRedis';
import { deleteAllSessions } from '../src/services/user.service';
import { extractTransaction, AiUnavailableError, AiNotConfiguredError, type AiExtraction } from '../src/services/ai.service';

const mockedExtract = extractTransaction as jest.MockedFunction<typeof extractTransaction>;
const extraction = (over: Partial<AiExtraction> = {}): AiExtraction => ({
  found: true, type: 'EXPENSE', amount: 6500, currency: 'KRW', description: 'Latte',
  date: null, categoryName: 'Coffee', walletName: null, ...over,
});

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

  it('stores the hash, not the token', async () => {
    const token = (await owner.post('/api/users/me/api-token')).body.data.token;
    const row = await prisma.user.findUnique({ where: { email: emails[0] } });
    expect(row?.apiTokenHash).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    expect(row?.apiTokenHash).not.toBe(token);
  });

  it('does not accept a cookie session on the Shortcut endpoint', async () => {
    expect((await owner.post('/api/capture/text').send({ text: 'x' })).status).toBe(401);
  });

  it('records lastUsedAt on successful use', async () => {
    const token = (await owner.post('/api/users/me/api-token')).body.data.token;
    const res = await request(app).post('/api/capture/text').set('Authorization', `Bearer ${token}`).send({ text: 'x' });
    expect(res.status).not.toBe(401);
    expect((await owner.get('/api/users/me/api-token')).body.data.lastUsedAt).not.toBeNull();
  });

  it('is not accepted on a write endpoint', async () => {
    const token = (await owner.post('/api/users/me/api-token')).body.data.token;
    const res = await request(app).post('/api/transactions').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(401);
  });

  it('is revoked when the password changes', async () => {
    const other = await newUser('pw');
    const token = (await other.post('/api/users/me/api-token')).body.data.token;
    const change = await other
      .post('/api/users/me/password')
      .send({ currentPassword: 'password123', newPassword: 'newpassword456', newPasswordConfirm: 'newpassword456' });
    expect(change.status).toBe(200);
    expect((await other.get('/api/users/me/api-token')).body.data.exists).toBe(false);
    const res = await request(app).post('/api/capture/text').set('Authorization', `Bearer ${token}`).send({ text: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('capture', () => {
  let shortcut: Agent;
  let token: string;
  let walletId: string;

  beforeAll(async () => {
    shortcut = await newUser('shortcut');
    walletId = (await shortcut.post('/api/wallets').send({ name: 'KRW Main', currency: 'KRW', balance: 10000 })).body.data.wallet.id;
    await shortcut.put(`/api/wallets/${walletId}/main`);
    await shortcut.post('/api/categories').send({ name: 'Coffee', type: 'EXPENSE' });
    token = (await shortcut.post('/api/users/me/api-token')).body.data.token;
  });

  const sendText = (text = 'STARBUCKS 6,500원 승인') =>
    request(app).post('/api/capture/text').set('Authorization', `Bearer ${token}`).send({ text });

  it('text: saves the transaction and returns a summary', async () => {
    mockedExtract.mockResolvedValueOnce(extraction());
    const res = await sendText();

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Added -₩6,500 Latte · Coffee · KRW Main');
    expect(res.body.data.transaction.amount).toBe(6500);
    const wallet = await shortcut.get(`/api/wallets/${walletId}`);
    expect(wallet.body.data.wallet.balance).toBe(3500);
    expect(mockedExtract).toHaveBeenLastCalledWith({ text: 'STARBUCKS 6,500원 승인' }, expect.objectContaining({ timeZone: 'Asia/Seoul' }));
  });

  it('text: unknown category lands in an auto-created Other', async () => {
    mockedExtract.mockResolvedValueOnce(extraction({ categoryName: 'Pharmacy', description: 'Olive Young' }));
    const res = await sendText();
    expect(res.status).toBe(201);
    expect(res.body.message).toContain('· Other ·');
  });

  it('text: missing amount is a readable 422', async () => {
    mockedExtract.mockResolvedValueOnce(extraction({ amount: null }));
    const res = await sendText();
    expect(res.status).toBe(422);
    expect(res.body.message).toBe("Couldn't find an amount");
  });

  it('text: AI failures are a readable 503', async () => {
    mockedExtract.mockRejectedValueOnce(new AiUnavailableError('boom'));
    expect((await sendText()).body).toEqual({ status: 'error', message: 'AI is unavailable, try again later' });
    mockedExtract.mockRejectedValueOnce(new AiNotConfiguredError('no key'));
    const res = await sendText();
    expect(res.status).toBe(503);
    expect(res.body.message).toBe("AI capture isn't set up");
  });

  it('text: validates the body', async () => {
    const res = await request(app).post('/api/capture/text').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  it('photo: returns a draft and saves nothing', async () => {
    mockedExtract.mockResolvedValueOnce(extraction({ amount: 12000, description: 'Emart' }));
    const before = (await shortcut.get(`/api/transactions?walletId=${walletId}`)).body.data.pagination.total;

    const res = await shortcut.post('/api/capture/photo').send({ image: Buffer.from('fake-jpeg').toString('base64'), mimeType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.data.draft).toMatchObject({ amount: 12000, description: 'Emart', walletId, categoryName: 'Coffee', type: 'EXPENSE' });
    expect(mockedExtract).toHaveBeenLastCalledWith({ image: expect.any(String), mimeType: 'image/jpeg' }, expect.anything());
    const after = (await shortcut.get(`/api/transactions?walletId=${walletId}`)).body.data.pagination.total;
    expect(after).toBe(before);
  });

  it('photo: requires a session, not the API token', async () => {
    const res = await request(app).post('/api/capture/photo').set('Authorization', `Bearer ${token}`)
      .send({ image: 'AAAA', mimeType: 'image/jpeg' });
    expect(res.status).toBe(401);
  });

  it('photo: rejects images over 5 MB and unsupported types', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64');
    expect((await shortcut.post('/api/capture/photo').send({ image: big, mimeType: 'image/jpeg' })).status).toBe(400);
    expect((await shortcut.post('/api/capture/photo').send({ image: 'AAAA', mimeType: 'image/gif' })).status).toBe(400);
  });

  // Keep this last in the block: it uses up the user's hourly budget
  it('limits captures to 30 per hour per user, shared across both endpoints', async () => {
    mockedExtract.mockResolvedValue(extraction({ amount: null })); // 422s: nothing is written
    let last = await sendText();
    for (let i = 0; i < 31 && last.status !== 429; i++) last = await sendText();
    expect(last.status).toBe(429);
    expect(last.body.message).toBe('Too many captures, try again in an hour.');
    const photo = await shortcut.post('/api/capture/photo').send({ image: 'AAAA', mimeType: 'image/jpeg' });
    expect(photo.status).toBe(429);
    mockedExtract.mockReset();
  });
});

// Keep this describe LAST in the file: it exhausts the per-IP budget for failed token attempts
describe('failed token attempts', () => {
  it('are throttled per IP after 20 failures in 15 minutes', async () => {
    let last;
    for (let i = 0; i < 25; i++) {
      last = await request(app).post('/api/capture/text').set('Authorization', `Bearer ft_${'x'.repeat(43)}`).send({ text: 'x' });
      if (last.status === 429) break;
    }
    expect(last!.status).toBe(429);
    expect(last!.body.message).toBe('Too many failed attempts, try again later.');
  });
});
