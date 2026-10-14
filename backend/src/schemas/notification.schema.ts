import { object, string, boolean, array, literal, union } from 'zod';

export const listNotificationsSchema = object({ query: object({ cursor: string().uuid().optional() }) });
export const readNotificationsSchema = object({
  body: union([object({ ids: array(string().uuid()).min(1).max(100) }), object({ all: literal(true) })]),
});
export const putSettingsSchema = object({
  body: object({
    nudgeEnabled: boolean().optional(),
    nudgeTime: string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm').optional(),
    timezone: string().max(64).optional(),
    shortcutEnabled: boolean().optional(),
    monthlySummaryEnabled: boolean().optional(),
  }),
});
const PUSH_HOSTS = ['.googleapis.com', '.push.apple.com', '.notify.windows.com', '.push.services.mozilla.com'];
const isPushHost = (u: string) => {
  try {
    const { protocol, hostname } = new URL(u);
    return protocol === 'https:' && (hostname === 'fcm.googleapis.com' || hostname === 'web.push.apple.com' || PUSH_HOSTS.some((h) => hostname.endsWith(h)));
  } catch { return false; }
};
export const subscribeSchema = object({
  body: object({
    endpoint: string().url().max(1000).refine(isPushHost, 'Unsupported push service'),
    keys: object({ p256dh: string().min(1).max(200), auth: string().min(1).max(100) }),
  }),
});
export const unsubscribeSchema = object({ body: object({ endpoint: string().max(1000) }) });
