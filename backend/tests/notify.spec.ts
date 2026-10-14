jest.mock('web-push', () => ({ setVapidDetails: jest.fn(), sendNotification: jest.fn() }));
jest.mock('../src/middleware/prismaMiddleware', () => ({
  __esModule: true,
  default: {
    notification: { createMany: jest.fn() },
    pushSubscription: { findMany: jest.fn(), delete: jest.fn() },
    notificationSettings: { findUnique: jest.fn() },
  },
}));
const mockCfg: Record<string, string> = { vapidPublicKey: 'pub', vapidPrivateKey: 'priv', vapidSubject: 'mailto:a@b.c' };
jest.mock('config', () => ({ get: (k: string) => mockCfg[k] ?? '' }));

import webpush from 'web-push';
import prisma from '../src/middleware/prismaMiddleware';
import { notify, getSettings, SETTINGS_DEFAULTS } from '../src/services/notifications/notification.service';

const db = prisma as any;
const send = webpush.sendNotification as jest.Mock;
const n = { title: 'T', body: 'B', url: '/?add=new', dedupeKey: 'nudge:2026-10-15' };
const subs = [
  { id: 's1', endpoint: 'https://fcm.googleapis.com/x', p256dh: 'p', auth: 'a' },
  { id: 's2', endpoint: 'https://web.push.apple.com/y', p256dh: 'p', auth: 'a' },
];

describe('notify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCfg.vapidSubject = 'mailto:a@b.c';
    db.notification.createMany.mockResolvedValue({ count: 1 });
    db.pushSubscription.findMany.mockResolvedValue(subs);
    send.mockResolvedValue({ statusCode: 201 });
  });

  it('stores the row and pushes to every subscription', async () => {
    await expect(notify('u1', 'NUDGE', n)).resolves.toBe(true);
    expect(db.notification.createMany).toHaveBeenCalledWith({ data: [{ userId: 'u1', kind: 'NUDGE', ...n }], skipDuplicates: true });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][2]).toMatchObject({ TTL: 43200 });
    expect(JSON.parse(send.mock.calls[0][1])).toEqual({ title: 'T', body: 'B', url: '/?add=new' });
  });

  it('does nothing more when the dedupe key already exists', async () => {
    db.notification.createMany.mockResolvedValue({ count: 0 });
    await expect(notify('u1', 'NUDGE', n)).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('stores the row but skips push when the VAPID subject is unset', async () => {
    mockCfg.vapidSubject = '';
    await expect(notify('u1', 'NUDGE', n)).resolves.toBe(true);
    expect(db.notification.createMany).toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('deletes a gone subscription and keeps going', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 })).mockResolvedValueOnce({ statusCode: 201 });
    await expect(notify('u1', 'NUDGE', n)).resolves.toBe(true);
    expect(db.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('logs other push failures without keys and never throws', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    send.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500 }));
    await expect(notify('u1', 'NUDGE', n)).resolves.toBe(true);
    expect(log).toHaveBeenCalledWith('Push failed: 500 fcm.googleapis.com');
    expect(db.pushSubscription.delete).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('returns stored settings or the defaults', async () => {
    db.notificationSettings.findUnique.mockResolvedValueOnce(null);
    await expect(getSettings('u1')).resolves.toEqual(SETTINGS_DEFAULTS);
    db.notificationSettings.findUnique.mockResolvedValueOnce({ userId: 'u1', ...SETTINGS_DEFAULTS, nudgeTime: '20:00' });
    await expect(getSettings('u1')).resolves.toEqual({ ...SETTINGS_DEFAULTS, nudgeTime: '20:00' });
  });
});
