import config from 'config';
import webpush from 'web-push';
import prisma from '../../middleware/prismaMiddleware';

export type NotificationKind = 'NUDGE' | 'BILL' | 'SHORTCUT_SAVED' | 'MONTHLY_SUMMARY';
export const SETTINGS_DEFAULTS = {
  nudgeEnabled: true, nudgeTime: '21:00', timezone: 'Asia/Seoul', shortcutEnabled: true, monthlySummaryEnabled: true,
};

const vapid = () => ({
  publicKey: config.get<string>('vapidPublicKey'),
  privateKey: config.get<string>('vapidPrivateKey'),
  subject: config.get<string>('vapidSubject'),
});
export const isPushConfigured = () => Object.values(vapid()).every(Boolean);

let warned = false;
const host = (endpoint: string) => { try { return new URL(endpoint).host; } catch { return 'invalid-endpoint'; } };

async function push(userId: string, payload: { title: string; body: string; url: string }) {
  if (!isPushConfigured()) {
    if (!warned) console.warn('Push is not configured (VAPID keys unset); notifications are in-app only');
    warned = true;
    return;
  }
  const { publicKey, privateKey, subject } = vapid();
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { timeout: 5000, TTL: 43200 });
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      } else {
        console.error(`Push failed: ${err?.statusCode ?? 'error'} ${host(s.endpoint)}`);
      }
    }
  }));
}

// The only way to create a notification: stored once per dedupeKey, then pushed to every device
export async function notify(userId: string, kind: NotificationKind, n: { title: string; body: string; url: string; dedupeKey: string }) {
  // skipDuplicates: no unique-violation error (and Postgres log line) on every repeat tick
  const { count } = await prisma.notification.createMany({ data: [{ userId, kind, ...n }], skipDuplicates: true });
  if (count === 0) return false;
  try {
    await push(userId, { title: n.title, body: n.body, url: n.url });
  } catch (err) {
    console.error('Push failed: unexpected', (err as Error)?.message);
  }
  return true;
}

export async function getSettings(userId: string) {
  const row = await prisma.notificationSettings.findUnique({ where: { userId } });
  if (!row) return { ...SETTINGS_DEFAULTS };
  const { userId: _u, ...settings } = row;
  return settings;
}
