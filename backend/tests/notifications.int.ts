/**
 * Integration scenarios for notification, settings and push-subscription endpoints.
 * Real Postgres + Redis. Run: npm run test:int -- notifications
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
import * as svc from '../src/services/notifications/notification.service';

const run = Date.now();
const emails: string[] = [];
type Agent = ReturnType<typeof request.agent>;

async function newUser(tag: string): Promise<{ agent: Agent; id: string }> {
  const email = `notif-${tag}-${run}@example.test`;
  emails.push(email);
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: tag, email, password: 'password123', passwordConfirm: 'password123' });
  expect(res.status).toBe(201);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { agent, id: user.id };
}

beforeAll(async () => {
  await ready;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.user.deleteMany({ where: { id: { in: ids } } }); // notification tables cascade
  await Promise.all(ids.map((id) => deleteAllSessions(id)));
  await prisma.$disconnect();
  await redisClient.quit();
});

describe('notifications', () => {
  it('lists with paging and unread count, scoped per user', async () => {
    const a = await newUser('list-a');
    const b = await newUser('list-b');
    for (let i = 0; i < 32; i++) {
      await svc.notify(a.id, 'NUDGE', { title: 'T' + i, body: 'B', url: '/?add=new', dedupeKey: 'k' + i });
    }
    const p1 = (await a.agent.get('/api/notifications')).body.data;
    expect(p1.notifications).toHaveLength(30);
    expect(p1.notifications[0].title).toBe('T31');
    expect(p1.unreadCount).toBe(32);
    expect(p1.nextCursor).toBe(p1.notifications[29].id);
    const p2 = (await a.agent.get(`/api/notifications?cursor=${p1.nextCursor}`)).body.data;
    expect(p2.notifications).toHaveLength(2);
    expect(p2.nextCursor).toBeNull();
    expect((await b.agent.get('/api/notifications')).body.data.notifications).toHaveLength(0);
  });

  it('marks read, only for the owner', async () => {
    const a = await newUser('read-a');
    const b = await newUser('read-b');
    for (let i = 0; i < 3; i++) {
      await svc.notify(a.id, 'NUDGE', { title: 'T' + i, body: 'B', url: '/?add=new', dedupeKey: 'k' + i });
    }
    const first = (await a.agent.get('/api/notifications')).body.data.notifications[0];
    const r1 = await a.agent.post('/api/notifications/read').send({ ids: [first.id] });
    expect(r1.body.data.unreadCount).toBe(2);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: first.id } })).readAt).not.toBeNull();
    const other = (await a.agent.get('/api/notifications')).body.data.notifications[0];
    await b.agent.post('/api/notifications/read').send({ ids: [other.id] });
    expect((await a.agent.get('/api/notifications')).body.data.unreadCount).toBe(2);
    expect((await a.agent.post('/api/notifications/read').send({ all: true })).body.data.unreadCount).toBe(0);
  });

  it('reads and updates settings', async () => {
    const a = await newUser('settings');
    const defaults = { nudgeEnabled: true, nudgeTime: '21:00', timezone: 'Asia/Seoul', shortcutEnabled: true, monthlySummaryEnabled: true };
    expect((await a.agent.get('/api/notifications/settings')).body.data.settings).toEqual(defaults);
    const put = await a.agent.put('/api/notifications/settings').send({ nudgeTime: '20:30', timezone: 'Asia/Jakarta' });
    expect(put.status).toBe(200);
    expect(put.body.data.settings).toEqual({ ...defaults, nudgeTime: '20:30', timezone: 'Asia/Jakarta' });
    const bad = await a.agent.put('/api/notifications/settings').send({ timezone: 'Mars/Base' });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toBe('Unknown timezone');
    expect((await a.agent.put('/api/notifications/settings').send({ nudgeTime: '25:00' })).status).toBe(400);
    expect((await a.agent.put('/api/notifications/settings').send({ userId: 'x', nudgeEnabled: false })).status).toBe(200);
    const row = await prisma.notificationSettings.findUniqueOrThrow({ where: { userId: a.id } });
    expect(row.userId).toBe(a.id);
    expect(row.nudgeEnabled).toBe(false);
  });

  it('answers 503 for the push key when VAPID keys are unset', async () => {
    const a = await newUser('key');
    const spy = jest.spyOn(svc, 'isPushConfigured').mockReturnValue(false);
    const res = await a.agent.get('/api/push/key');
    spy.mockRestore();
    expect(res.status).toBe(503);
    expect(res.body.message).toBe("Push isn't set up");
  });

  it('subscribes, reassigns an endpoint and unsubscribes per owner', async () => {
    const a = await newUser('sub-a');
    const b = await newUser('sub-b');
    const endpoint = `https://push.example.test/abc-${run}`;
    const body = { endpoint, keys: { p256dh: 'p', auth: 'a' } };
    expect((await a.agent.post('/api/push/subscribe').send(body)).status).toBe(201);
    expect(await prisma.pushSubscription.count({ where: { userId: a.id } })).toBe(1);
    expect((await a.agent.post('/api/push/subscribe').send(body)).status).toBe(201);
    expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(1);
    expect((await b.agent.post('/api/push/subscribe').send(body)).status).toBe(201);
    expect((await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint } })).userId).toBe(b.id);
    expect((await a.agent.delete('/api/push/subscribe').send({ endpoint })).status).toBe(204);
    expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(1);
    expect((await b.agent.delete('/api/push/subscribe').send({ endpoint })).status).toBe(204);
    expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(0);
    expect((await a.agent.post('/api/push/subscribe').send({ ...body, endpoint: 'http://insecure' })).status).toBe(400);
  });
});
