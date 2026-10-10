/**
 * Integration scenarios for the profile photo and wallet icon.
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
  const email = `profile-${tag}-${run}@example.test`;
  emails.push(email);
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: tag, email, password: 'password123', passwordConfirm: 'password123' });
  expect(res.status).toBe(201);
  return agent;
}

// A real 1x1 JPEG
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

beforeAll(async () => {
  await ready;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.userAvatar.deleteMany({ where: { userId: { in: ids } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await Promise.all(ids.map((id) => deleteAllSessions(id)));
  await prisma.$disconnect();
  await redisClient.quit();
});

describe('profile photo', () => {
  it('uploads, serves, appears as avatarUpdatedAt on /me, and deletes', async () => {
    const u = await newUser('photo');
    const put = await u.put('/api/users/me/avatar').send({ image: JPEG.toString('base64'), mimeType: 'image/jpeg' });
    expect(put.status).toBe(200);

    const me = (await u.get('/api/users/me')).body.data.user;
    expect(me.avatarUpdatedAt).toBeTruthy();
    expect(me.avatar).toBeUndefined();

    const got = await u.get('/api/users/me/avatar').buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(got.status).toBe(200);
    expect(got.headers['content-type']).toMatch(/image\/jpeg/);
    expect(Buffer.compare(got.body as Buffer, JPEG)).toBe(0);

    expect((await u.delete('/api/users/me/avatar')).status).toBe(204);
    expect((await u.get('/api/users/me/avatar')).status).toBe(404);
    expect((await u.get('/api/users/me')).body.data.user.avatarUpdatedAt).toBeNull();
  });

  it('rejects oversized images and other mime types, and needs a session', async () => {
    const u = await newUser('limits');
    const big = Buffer.alloc(201 * 1024, 1).toString('base64');
    const tooBig = await u.put('/api/users/me/avatar').send({ image: big, mimeType: 'image/jpeg' });
    expect(tooBig.status).toBe(400);
    expect(tooBig.body.message).toContain('Image is too large');
    expect((await u.put('/api/users/me/avatar').send({ image: JPEG.toString('base64'), mimeType: 'image/gif' })).status).toBe(400);
    expect((await request(app).get('/api/users/me/avatar')).status).toBe(401);
  });

  it("never serves another user's photo", async () => {
    const a = await newUser('owner');
    await a.put('/api/users/me/avatar').send({ image: JPEG.toString('base64'), mimeType: 'image/jpeg' });
    const b = await newUser('other');
    expect((await b.get('/api/users/me/avatar')).status).toBe(404);
  });
});

describe('wallet icon', () => {
  it('is saved, changed, cleared, and validated', async () => {
    const u = await newUser('wallet');
    const created = await u.post('/api/wallets').send({ name: 'Bank', currency: 'KRW', balance: 0, icon: 'landmark' });
    expect(created.status).toBe(201);
    expect(created.body.data.wallet.icon).toBe('landmark');
    const id = created.body.data.wallet.id;
    expect((await u.patch(`/api/wallets/${id}`).send({ icon: 'piggy-bank' })).body.data.wallet.icon).toBe('piggy-bank');
    expect((await u.patch(`/api/wallets/${id}`).send({ icon: null })).body.data.wallet.icon).toBeNull();
    expect((await u.patch(`/api/wallets/${id}`).send({ icon: '<x>' })).status).toBe(400);
  });
});
