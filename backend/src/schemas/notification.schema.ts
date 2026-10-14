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
export const subscribeSchema = object({
  body: object({
    endpoint: string().url().max(1000).refine((u) => u.startsWith('https://'), 'Push endpoint must be https'),
    keys: object({ p256dh: string().min(1).max(200), auth: string().min(1).max(100) }),
  }),
});
export const unsubscribeSchema = object({ body: object({ endpoint: string().max(1000) }) });
