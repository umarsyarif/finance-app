/**
 * Integration scenarios for the notification scheduler (runTick with fixed clocks).
 * Real Postgres + Redis; web-push mocked. Asserts only on its own users' rows.
 */
process.env.TZ = 'Asia/Seoul';
jest.setTimeout(60000);
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({ statusCode: 201 }),
}));

import request from 'supertest';
import app, { ready } from '../src/app';
import prisma from '../src/middleware/prismaMiddleware';
import redisClient from '../src/utils/connectRedis';
import { deleteAllSessions } from '../src/services/user.service';
import { runTick, resetSchedulerState } from '../src/services/notifications/scheduler';

const run = Date.now();
const emails: string[] = [];
const ids: string[] = [];
const tick = (d: Date, only = ids) => runTick(d, only);
type Agent = ReturnType<typeof request.agent>;

async function seedUser(tag: string, opts: { settings?: boolean } = {}) {
  const email = `sched-${tag}-${run}@example.test`;
  emails.push(email);
  const agent: Agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ name: tag, email, password: 'password123', passwordConfirm: 'password123' });
  expect(res.status).toBe(201);
  const userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
  ids.push(userId);
  if (opts.settings !== false) {
    expect((await agent.put('/api/notifications/settings').send({ timezone: 'Asia/Seoul' })).status).toBe(200);
  }
  const mk = async (path: string, body: object, key: string) => {
    const r = await agent.post(path).send(body);
    expect(r.status).toBe(201);
    return r.body.data[key].id as string;
  };
  const walletId = await mk('/api/wallets', { name: 'Cash', currency: 'KRW', balance: 0 }, 'wallet');
  const wallet2Id = await mk('/api/wallets', { name: 'Bank', currency: 'KRW', balance: 0 }, 'wallet');
  const expenseId = await mk('/api/categories', { name: 'Food', type: 'EXPENSE' }, 'category');
  const incomeId = await mk('/api/categories', { name: 'Pay', type: 'INCOME' }, 'category');
  const tx = (categoryId: string, amount: number, date: string) =>
    agent.post('/api/transactions').send({ walletId, categoryId, amount, date }).then((r) => expect(r.status).toBe(201));
  return { agent, userId, walletId, wallet2Id, expenseId, incomeId, tx };
}

const notes = (userId: string, kind?: string) =>
  prisma.notification.findMany({ where: { userId, ...(kind ? { kind: kind as any } : {}) } });

beforeAll(async () => { await ready; });
beforeEach(() => resetSchedulerState());

afterAll(async () => {
  await prisma.bill.deleteMany({ where: { userId: { in: ids } } });
  await prisma.transfer.deleteMany({ where: { userId: { in: ids } } });
  await prisma.transaction.deleteMany({ where: { wallet: { userId: { in: ids } } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
  await prisma.category.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await Promise.all(ids.map((id) => deleteAllSessions(id)));
  await prisma.$disconnect();
  await redisClient.quit();
});

describe('scheduler', () => {
  it('nudges at the local time, once', async () => {
    const u = await seedUser('nudge');
    await tick(new Date('2026-10-15T11:59:00Z'));
    expect(await notes(u.userId, 'NUDGE')).toHaveLength(0);
    await tick(new Date('2026-10-15T12:00:00Z'));
    await tick(new Date('2026-10-15T12:00:00Z'));
    const rows = await notes(u.userId, 'NUDGE');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ dedupeKey: 'nudge:2026-10-15', title: 'Nothing logged today', url: '/?add=new' });
  });

  it('skips the nudge when something is logged on the local day', async () => {
    const u = await seedUser('logged');
    await u.tx(u.expenseId, 1000, '2026-10-15T03:00:00Z');
    await tick(new Date('2026-10-15T13:00:00Z'));
    expect(await notes(u.userId, 'NUDGE')).toHaveLength(0);

    // 23:30 KST on the 15th does not count for the 16th (same user: auth rate limit is 10 registrations per file)
    await u.tx(u.expenseId, 1000, '2026-10-15T14:30:00Z');
    await tick(new Date('2026-10-16T13:00:00Z'));
    expect((await notes(u.userId, 'NUDGE')).map((n) => n.dedupeKey)).toEqual(['nudge:2026-10-16']);
  });

  it('respects nudgeEnabled=false', async () => {
    const u = await seedUser('off');
    await u.agent.put('/api/notifications/settings').send({ nudgeEnabled: false });
    await tick(new Date('2026-10-15T13:00:00Z'));
    expect(await notes(u.userId, 'NUDGE')).toHaveLength(0);
  });

  it('reminds about a bill once, only when active and on the right day', async () => {
    const u = await seedUser('bill');
    const b = (await u.agent.post('/api/bills').send({ name: 'Rent', amount: 500000, currency: 'KRW', walletId: u.walletId, categoryId: u.expenseId, dayOfMonth: 25, remindDaysBefore: 1 })).body.data.bill;
    await tick(new Date('2026-10-23T00:00:00Z'));
    expect(await notes(u.userId, 'BILL')).toHaveLength(0);
    await tick(new Date('2026-10-23T15:00:00Z')); // 00:00 KST on the day: too early
    expect(await notes(u.userId, 'BILL')).toHaveLength(0);
    await tick(new Date('2026-10-24T00:00:00Z'));
    const rows = await notes(u.userId, 'BILL');
    expect(rows).toHaveLength(1);
    expect(rows[0].dedupeKey).toBe(`bill:${b.id}:2026-10`);
    expect(rows[0].url).toBe(`/?add=bill:${b.id}`);
    expect(rows[0].title).toContain('Rent');
    expect(rows[0].title).toContain('tomorrow');
    expect(rows[0].body).toContain('₩500,000');
    expect(rows[0].body).toContain('Cash');

    const v = await seedUser('bill-off');
    const vb = (await v.agent.post('/api/bills').send({ name: 'Rent', amount: 500000, currency: 'KRW', walletId: v.walletId, categoryId: v.expenseId, dayOfMonth: 25, remindDaysBefore: 1 })).body.data.bill;
    await v.agent.patch(`/api/bills/${vb.id}`).send({ active: false });
    await tick(new Date('2026-10-24T00:00:00Z'));
    expect(await notes(v.userId, 'BILL')).toHaveLength(0);
  });

  it('reminds across a month boundary, keyed by the due month', async () => {
    const u = await seedUser('billx');
    const b = (await u.agent.post('/api/bills').send({ name: 'Gym', amount: 50000, currency: 'KRW', walletId: u.walletId, categoryId: u.expenseId, dayOfMonth: 1, remindDaysBefore: 3 })).body.data.bill;
    await tick(new Date('2026-10-29T01:00:00Z'));
    expect((await notes(u.userId, 'BILL')).map((n) => n.dedupeKey)).toEqual([`bill:${b.id}:2026-11`]);
  });

  it('sends the monthly summary at 09:00 on the 1st, excluding transfers', async () => {
    const u = await seedUser('sum');
    await u.tx(u.incomeId, 3000000, '2026-09-10T03:00:00Z');
    await u.tx(u.expenseId, 1200000, '2026-09-12T03:00:00Z');
    const tr = await u.agent.post('/api/transfers').send({ fromWalletId: u.walletId, toWalletId: u.wallet2Id, amountSent: 700000, amountReceived: 700000, date: '2026-09-15T03:00:00Z' });
    expect(tr.status).toBe(201);
    const empty = await seedUser('sum-empty');

    await tick(new Date('2026-09-30T23:30:00Z'));
    expect(await notes(u.userId, 'MONTHLY_SUMMARY')).toHaveLength(0);
    await tick(new Date('2026-10-01T00:00:00Z'));
    const rows = await notes(u.userId, 'MONTHLY_SUMMARY');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ dedupeKey: 'summary:2026-09', url: '/?month=2026-09' });
    expect(rows[0].body).toContain('+₩3,000,000');
    expect(rows[0].body).toContain('−₩1,200,000');
    expect(rows[0].body).toContain('net ₩1,800,000');
    expect(await notes(empty.userId, 'MONTHLY_SUMMARY')).toHaveLength(0);
  });

  it('deletes notifications older than 90 days', async () => {
    const u = await seedUser('keep');
    const day = 86_400_000;
    const mk = (key: string, age: number) =>
      prisma.notification.create({ data: { userId: u.userId, kind: 'NUDGE', title: 't', body: 'b', url: '/?add=new', dedupeKey: key, createdAt: new Date(Date.now() - age * day) } });
    await mk('old', 91);
    await mk('recent', 89);
    await tick(new Date('2026-10-15T00:00:00Z'));
    expect((await notes(u.userId)).map((n) => n.dedupeKey)).toEqual(['recent']);
  });

  it('does not visit users without settings, bills or subscriptions', async () => {
    const u = await seedUser('nobody', { settings: false });
    await tick(new Date('2026-10-15T13:00:00Z'));
    expect(await notes(u.userId)).toHaveLength(0);
  });
});
