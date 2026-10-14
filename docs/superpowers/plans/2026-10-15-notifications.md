# Notifications, Push and Bills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In-app notification history + Web Push for a daily "nothing logged" nudge, monthly bill reminders, Shortcut saves and a monthly summary, with bills managed in the app.

**Architecture:** Four additive Prisma models. One `notify()` entry point writes a deduplicated `Notification` row and pushes it with `web-push`. A 60-second in-process scheduler (pure date logic in `schedule.ts`) creates nudges, bill reminders and summaries. The client adds a Notifications page, a Bills page, a Profile settings section, a `push-sw.js` imported into the generated service worker, and `?add=` / `?wallet=` / `?month=` deep links used by notification taps.

**Tech Stack:** Express + Prisma + Zod + Jest/Supertest (backend), `web-push` (new dependency), React + Vite + vite-plugin-pwa + Tailwind + Vitest + Playwright (client).

**Spec:** `docs/superpowers/specs/2026-10-15-notifications-design.md`

## Global Constraints

- Work only in the worktree `/Users/umarsyarif/Documents/Dev/Web/finance-app/.claude/worktrees/notifications` (branch `feat/notifications`). Never touch the main checkout.
- Never print or modify `backend/.env` (a symlink to the main checkout's file holding real secrets).
- No test may call a real push service, Gemini, Binance or exchange-rate API. `web-push` is always mocked in tests.
- Controllers pick body fields explicitly; never spread `req.body` into Prisma (the `validate` middleware keeps unknown keys).
- Every query is scoped by the signed-in user's id; another user's bill/subscription/notification answers 404 (or is silently not touched for push unsubscribe).
- Notification `url` values are built only by the server from these patterns: `/?add=bill:<billId>`, `/?add=new`, `/transactions?wallet=<walletId>`, `/?month=<yyyy-mm>`.
- Notification kinds are exactly `NUDGE`, `BILL`, `SHORTCUT_SAVED`, `MONTHLY_SUMMARY`.
- Dedupe keys: `nudge:<yyyy-mm-dd>`, `bill:<billId>:<yyyy-mm>` (the due month), `tx:<transactionId>`, `summary:<yyyy-mm>` (the summarised month).
- Bills: monthly only; `dayOfMonth` 1–31 clamped to the month's last day; `remindDaysBefore` ∈ {0, 1, 3}; currency KRW | IDR; never auto-record a transaction.
- Settings defaults: `nudgeEnabled` true, `nudgeTime` "21:00", `timezone` "Asia/Seoul", `shortcutEnabled` true, `monthlySummaryEnabled` true. No row = defaults.
- Push logs: `Push failed: <status> <endpoint host>` only — never keys or full endpoints.
- Copy (verbatim): nudge title "Nothing logged today", body "Add today's expenses?"; shortcut title "Saved from Shortcut"; empty list "No notifications yet"; push hints "Add to Home Screen to get push", "Notifications are blocked — allow them in Settings → Finance"; 503 "Push isn't set up"; bill-day hint "Short months use the last day".
- Every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't commit `.claude/`, `.playwright-mcp/`, screenshots, `test-results/`, `playwright-report/`.

**Spec deviation (ruled while planning):** the spec's Shortcut link `/transactions?tx=<id>` becomes `/transactions?wallet=<walletId>` — the Transactions page has no single-transaction view, and opening the right wallet's ledger is what a tap needs. Cost if wrong: the user scrolls to find the row.

**Scheduler scope (ruled while planning):** the tick visits users who have a push subscription, a settings row, or an active bill — not every account (local/e2e DBs hold hundreds of test users). A user who never enabled push nor touched settings nor added a bill gets no nudges or summaries. Cost if wrong: an in-app-only user sees no nudges until they open the settings once.

## Review Focus

1. Timezone edges: a user in UTC+9 at 00:30 local (still the previous UTC date) must be nudged for/checked against the *local* day — pinned in Task 1 (`localParts`/`dayRangeUtc`) and Task 5 (nudge window test).
2. Bill reminder crossing a month: due on the 1st with remind 3 days before fires on the 28th/29th/30th of the previous month, dedupe key uses the *due* month — pinned in Task 1 (`billReminderDue`).
3. Server restart / overlapping ticks never double-notify — pinned in Task 2 (unique dedupe) and Task 5 (two ticks, one row).
4. A dead push subscription (410) is removed and never breaks `notify` or the capture response — pinned in Task 2 and Task 5 (capture still 201 when push throws).
5. Deep link opened twice / back navigation does not reopen the Add sheet (the `?add=` param is removed after opening) — pinned in Task 7.

---

### Task 1: Data model, config and pure schedule logic

**Files:**
- Modify: `backend/prisma/schema.prisma` (add 4 models + back-relations on `User`, `Wallet`, `Category`)
- Create: migration via `npx prisma migrate dev --name notifications` (folder `backend/prisma/migrations/<timestamp>_notifications/`)
- Modify: `backend/config/default.ts`, `backend/config/custom-environment-variables.ts`
- Modify: `backend/package.json` (`web-push` dependency, `@types/web-push` dev dependency)
- Create: `backend/src/services/notifications/schedule.ts`
- Test: `backend/tests/schedule.spec.ts`

**Interfaces:**
- Produces (used by Tasks 2, 5):
  - `localParts(at: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number; ymd: string; ym: string }` (`ymd` = `yyyy-mm-dd`, `ym` = `yyyy-mm`; month 1-based)
  - `dayRangeUtc(ymd: string, timeZone: string): { start: Date; end: Date }` — UTC instants of local midnight and the next local midnight
  - `monthRangeUtc(ym: string, timeZone: string): { start: Date; end: Date }`
  - `dueDay(year: number, month: number, dayOfMonth: number): number` — clamped to the month's last day
  - `billReminderDue(todayYmd: string, dayOfMonth: number, remindDaysBefore: number): string | null` — returns the due month `yyyy-mm` when today is the reminder day for this or next month's due date, else null
  - `previousMonth(ym: string): string`
  - `isValidTimeZone(tz: string): boolean`
  - Prisma models `Notification`, `PushSubscription`, `Bill`, `NotificationSettings` exactly as in the spec.
  - Config keys `vapidPublicKey`, `vapidPrivateKey`, `vapidSubject` (env `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`), default `''`.

- [ ] **Step 1: Schema.** Add to `backend/prisma/schema.prisma` the four models exactly as in the spec's "Data model" block. Add back-relations: in `User` → `notifications Notification[]`, `pushSubscriptions PushSubscription[]`, `bills Bill[]`, `notificationSettings NotificationSettings?`; in `Wallet` → `bills Bill[]`; in `Category` → `bills Bill[]`.

- [ ] **Step 2: Migration.** Run (local Postgres :6500 must be up — `nc -z localhost 6500`):
```bash
cd backend && npx prisma migrate dev --name notifications
```
Expected: a new migration folder containing only `CREATE TABLE` / `CREATE INDEX` / `ALTER TABLE ... ADD CONSTRAINT` statements (no DROP/ALTER of existing columns). Open the SQL and confirm.

- [ ] **Step 3: Config and dependency.**
```bash
cd backend && npm install web-push@^3.6.7 && npm install -D @types/web-push@^3.6.4
```
In `config/default.ts` add `vapidPublicKey: '', vapidPrivateKey: '', vapidSubject: '',` next to `assetsEncryptionKey`. In `config/custom-environment-variables.ts` add `vapidPublicKey: 'VAPID_PUBLIC_KEY', vapidPrivateKey: 'VAPID_PRIVATE_KEY', vapidSubject: 'VAPID_SUBJECT',`.

- [ ] **Step 4: Write the failing tests** `backend/tests/schedule.spec.ts`:
```ts
import { localParts, dayRangeUtc, monthRangeUtc, dueDay, billReminderDue, previousMonth, isValidTimeZone } from '../src/services/notifications/schedule';

describe('schedule', () => {
  it('reads local parts in the given timezone', () => {
    // 2026-10-14T15:30Z is 00:30 on Oct 15 in Seoul
    const p = localParts(new Date('2026-10-14T15:30:00Z'), 'Asia/Seoul');
    expect(p).toMatchObject({ year: 2026, month: 10, day: 15, hour: 0, minute: 30, ymd: '2026-10-15', ym: '2026-10' });
  });

  it('gives the UTC range of a local day and month', () => {
    expect(dayRangeUtc('2026-10-15', 'Asia/Seoul')).toEqual({ start: new Date('2026-10-14T15:00:00Z'), end: new Date('2026-10-15T15:00:00Z') });
    expect(monthRangeUtc('2026-10', 'Asia/Jakarta')).toEqual({ start: new Date('2026-09-30T17:00:00Z'), end: new Date('2026-10-31T17:00:00Z') });
  });

  it('clamps the due day to the month length', () => {
    expect(dueDay(2026, 2, 31)).toBe(28);
    expect(dueDay(2028, 2, 30)).toBe(29);
    expect(dueDay(2026, 4, 31)).toBe(30);
    expect(dueDay(2026, 10, 25)).toBe(25);
  });

  it('finds the reminder day for this or next month', () => {
    expect(billReminderDue('2026-10-25', 25, 0)).toBe('2026-10');
    expect(billReminderDue('2026-10-24', 25, 1)).toBe('2026-10');
    expect(billReminderDue('2026-10-22', 25, 3)).toBe('2026-10');
    expect(billReminderDue('2026-10-23', 25, 3)).toBeNull();
    expect(billReminderDue('2026-02-28', 31, 0)).toBe('2026-02');      // clamped
    expect(billReminderDue('2026-10-29', 1, 3)).toBe('2026-11');      // crosses into next month
    expect(billReminderDue('2026-12-31', 1, 1)).toBe('2027-01');      // crosses the year
  });

  it('steps back a month and validates timezones', () => {
    expect(previousMonth('2026-01')).toBe('2025-12');
    expect(previousMonth('2026-10')).toBe('2026-09');
    expect(isValidTimeZone('Asia/Seoul')).toBe(true);
    expect(isValidTimeZone('Mars/Base')).toBe(false);
  });
});
```

- [ ] **Step 5: Run and confirm it fails.** `cd backend && npx jest tests/schedule.spec.ts` → FAIL (module not found).

- [ ] **Step 6: Implement** `backend/src/services/notifications/schedule.ts`:
```ts
// Pure calendar logic for the notification scheduler (no DB, no clock)
const pad = (n: number) => String(n).padStart(2, '0');

export function localParts(at: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const v = Object.fromEntries(f.formatToParts(at).map((p) => [p.type, p.value]));
  const year = Number(v.year), month = Number(v.month), day = Number(v.day);
  return { year, month, day, hour: Number(v.hour), minute: Number(v.minute), ymd: `${year}-${pad(month)}-${pad(day)}`, ym: `${year}-${pad(month)}` };
}

// UTC instant of local midnight on y-m-d in timeZone (two passes settle DST shifts)
function zonedMidnight(y: number, m: number, d: number, timeZone: string): Date {
  let guess = Date.UTC(y, m - 1, d);
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess -= asUtc - Date.UTC(y, m - 1, d);
  }
  return new Date(guess);
}

const ymdParts = (ymd: string) => ymd.split('-').map(Number) as [number, number, number];

export function dayRangeUtc(ymd: string, timeZone: string) {
  const [y, m, d] = ymdParts(ymd);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return { start: zonedMidnight(y, m, d, timeZone), end: zonedMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timeZone) };
}

export function monthRangeUtc(ym: string, timeZone: string) {
  const [y, m] = ym.split('-').map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  return { start: zonedMidnight(y, m, 1, timeZone), end: zonedMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, 1, timeZone) };
}

export const dueDay = (year: number, month: number, dayOfMonth: number) =>
  Math.min(dayOfMonth, new Date(Date.UTC(year, month, 0)).getUTCDate());

// The due month (yyyy-mm) whose reminder falls on todayYmd, checking this month and next
export function billReminderDue(todayYmd: string, dayOfMonth: number, remindDaysBefore: number): string | null {
  const [y, m, d] = ymdParts(todayYmd);
  const today = Date.UTC(y, m - 1, d);
  for (const offset of [0, 1]) {
    const first = new Date(Date.UTC(y, m - 1 + offset, 1));
    const dy = first.getUTCFullYear(), dm = first.getUTCMonth() + 1;
    const reminder = Date.UTC(dy, dm - 1, dueDay(dy, dm, dayOfMonth)) - remindDaysBefore * 86_400_000;
    if (reminder === today) return `${dy}-${pad(dm)}`;
  }
  return null;
}

export function previousMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const p = new Date(Date.UTC(y, m - 2, 1));
  return `${p.getUTCFullYear()}-${pad(p.getUTCMonth() + 1)}`;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 7: Run and confirm it passes.** `cd backend && npx jest tests/schedule.spec.ts && npx tsc --noEmit` → PASS, no type errors.

- [ ] **Step 8: Commit.**
```bash
git add backend/prisma backend/config backend/package.json backend/package-lock.json backend/src/services/notifications/schedule.ts backend/tests/schedule.spec.ts
git commit -m "feat(notifications): models, VAPID config and calendar logic

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `notify()` and push delivery

**Files:**
- Create: `backend/src/services/notifications/notification.service.ts`
- Test: `backend/tests/notify.spec.ts`

**Interfaces:**
- Consumes: Prisma models from Task 1; config `vapidPublicKey`/`vapidPrivateKey`/`vapidSubject`.
- Produces (used by Tasks 3, 5):
  - `type NotificationKind = 'NUDGE' | 'BILL' | 'SHORTCUT_SAVED' | 'MONTHLY_SUMMARY'`
  - `notify(userId: string, kind: NotificationKind, n: { title: string; body: string; url: string; dedupeKey: string }): Promise<boolean>` — `true` when a new row was created (and push attempted), `false` when the dedupe key already existed. Never throws for push failures; DB errors other than the unique violation propagate.
  - `isPushConfigured(): boolean`
  - `getSettings(userId: string): Promise<{ nudgeEnabled: boolean; nudgeTime: string; timezone: string; shortcutEnabled: boolean; monthlySummaryEnabled: boolean }>` — row or defaults.
  - `SETTINGS_DEFAULTS` constant with the defaults from Global Constraints.

- [ ] **Step 1: Write the failing test** `backend/tests/notify.spec.ts` (Prisma and `web-push` mocked; no DB):
```ts
jest.mock('web-push', () => ({ setVapidDetails: jest.fn(), sendNotification: jest.fn() }));
jest.mock('../src/middleware/prismaMiddleware', () => ({
  __esModule: true,
  default: {
    notification: { create: jest.fn() },
    pushSubscription: { findMany: jest.fn(), delete: jest.fn() },
    notificationSettings: { findUnique: jest.fn() },
  },
}));
jest.mock('config', () => ({
  get: (k: string) => ({ vapidPublicKey: 'pub', vapidPrivateKey: 'priv', vapidSubject: 'mailto:a@b.c' } as Record<string, string>)[k] ?? '',
}));

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
    db.notification.create.mockResolvedValue({ id: 'n1' });
    db.pushSubscription.findMany.mockResolvedValue(subs);
    send.mockResolvedValue({ statusCode: 201 });
  });

  it('stores the row and pushes to every subscription', async () => {
    await expect(notify('u1', 'NUDGE', n)).resolves.toBe(true);
    expect(db.notification.create).toHaveBeenCalledWith({ data: { userId: 'u1', kind: 'NUDGE', ...n } });
    expect(send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(send.mock.calls[0][1])).toEqual({ title: 'T', body: 'B', url: '/?add=new' });
  });

  it('does nothing more when the dedupe key already exists', async () => {
    db.notification.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    await expect(notify('u1', 'NUDGE', n)).resolves.toBe(false);
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
```

- [ ] **Step 2: Run and confirm it fails.** `cd backend && npx jest tests/notify.spec.ts` → FAIL.

- [ ] **Step 3: Implement** `backend/src/services/notifications/notification.service.ts`:
```ts
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
  subject: config.get<string>('vapidSubject') || 'mailto:admin@localhost',
});
export const isPushConfigured = () => Boolean(vapid().publicKey && vapid().privateKey);

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
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { timeout: 5000 });
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
  try {
    await prisma.notification.create({ data: { userId, kind, ...n } });
  } catch (err: any) {
    if (err?.code === 'P2002') return false;
    throw err;
  }
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
```

- [ ] **Step 4: Run and confirm it passes.** `cd backend && npx jest tests/notify.spec.ts && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit.**
```bash
git add backend/src/services/notifications/notification.service.ts backend/tests/notify.spec.ts
git commit -m "feat(notifications): notify() with dedupe and web push delivery

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Notification, settings and push-subscription endpoints

**Files:**
- Create: `backend/src/schemas/notification.schema.ts`, `backend/src/controllers/notification.controller.ts`, `backend/src/routes/notification.routes.ts`, `backend/src/routes/push.routes.ts`
- Modify: `backend/src/app.ts` (mount `/api/notifications` and `/api/push`)
- Test: `backend/tests/notifications.int.ts`

**Interfaces:**
- Consumes: `notify`, `getSettings`, `SETTINGS_DEFAULTS`, `isPushConfigured` (Task 2); `isValidTimeZone` (Task 1).
- Produces (used by client Tasks 6–8):
  - `GET /api/notifications?cursor=<id>` → `{ status, data: { notifications: Array<{ id, kind, title, body, url, readAt: string|null, createdAt: string }>, nextCursor: string|null, unreadCount: number } }`; 30 per page, ordered `createdAt desc, id desc`; `cursor` is the last id of the previous page.
  - `POST /api/notifications/read` body `{ ids: string[] }` (1–100) or `{ all: true }` → `{ status, data: { unreadCount } }`.
  - `GET /api/notifications/settings` → `{ status, data: { settings } }`; `PUT` same path, partial body `{ nudgeEnabled?, nudgeTime? ("HH:mm", 00–23:00–59), timezone? (valid IANA), shortcutEnabled?, monthlySummaryEnabled? }` → upsert → `{ status, data: { settings } }`; invalid timezone → 400 "Unknown timezone".
  - `GET /api/push/key` → `{ status, data: { publicKey } }` or 503 "Push isn't set up".
  - `POST /api/push/subscribe` body `{ endpoint: https URL ≤ 1000, keys: { p256dh ≤ 200, auth ≤ 100 } }` → upsert by endpoint with `userId` = caller (an endpoint moving to another account is reassigned) → 201.
  - `DELETE /api/push/subscribe` body `{ endpoint }` → `deleteMany({ where: { endpoint, userId } })` → 204.

- [ ] **Step 1: Write the failing integration test** `backend/tests/notifications.int.ts`. Copy the header/`newUser`/`afterAll` cleanup pattern from `backend/tests/wallet-balance.int.ts` (prefix emails `notif-`), and in `afterAll` also delete `notification`, `pushSubscription`, `notificationSettings` rows for those users before deleting users (or rely on cascade — the models use `onDelete: Cascade`, so deleting users is enough). Mock web-push at the top: `jest.mock('web-push', () => ({ setVapidDetails: jest.fn(), sendNotification: jest.fn().mockResolvedValue({ statusCode: 201 }) }));`. Scenarios:
  1. **List + unread + paging:** create 32 notifications for user A directly via `notify(userIdA, 'NUDGE', { title: 'T'+i, body: 'B', url: '/?add=new', dedupeKey: 'k'+i })` (get the id with `prisma.user.findUnique({ where: { email } })`). `GET /api/notifications` → 30 items, newest first (`title === 'T31'` first), `unreadCount` 32, `nextCursor` = last item id; `GET ?cursor=<nextCursor>` → 2 items, `nextCursor` null. User B's `GET` → 0 items.
  2. **Read:** `POST /read { ids: [first.id] }` → `unreadCount` 31; that row has `readAt`. `POST /read { all: true }` → 0. User B posting A's id changes nothing (A's unread stays as it was before B's call).
  3. **Settings:** `GET` with no row → defaults `{ nudgeEnabled: true, nudgeTime: '21:00', timezone: 'Asia/Seoul', shortcutEnabled: true, monthlySummaryEnabled: true }`. `PUT { nudgeTime: '20:30', timezone: 'Asia/Jakarta' }` → saved, others default. `PUT { timezone: 'Mars/Base' }` → 400 "Unknown timezone". `PUT { nudgeTime: '25:00' }` → 400. `PUT { userId: 'x', nudgeEnabled: false }` → 200 and the row's `userId` is still A's id.
  4. **Push key:** with `process.env.VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` unset (config default `''`) → `GET /api/push/key` 503 "Push isn't set up".
  5. **Subscribe:** `POST /api/push/subscribe { endpoint: 'https://push.example.test/abc', keys: { p256dh: 'p', auth: 'a' } }` → 201, one row for A. Same endpoint again → still one row. User B posting the same endpoint → row now belongs to B. `DELETE` by A → 204 and B's row is untouched; `DELETE` by B → row gone. `POST` with `endpoint: 'http://insecure'` → 400.

- [ ] **Step 2: Run and confirm it fails.** `cd backend && npm run test:int -- notifications` → FAIL (404 routes).

- [ ] **Step 3: Schemas** `backend/src/schemas/notification.schema.ts`:
```ts
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
```

- [ ] **Step 4: Controller** `backend/src/controllers/notification.controller.ts` — handlers `listNotificationsHandler`, `readNotificationsHandler`, `getSettingsHandler`, `putSettingsHandler`, `pushKeyHandler`, `subscribeHandler`, `unsubscribeHandler`, each `try { … } catch (err) { next(err); }` like `asset.controller.ts`:
```ts
import { Request, Response, NextFunction } from 'express';
import config from 'config';
import prisma from '../middleware/prismaMiddleware';
import AppError from '../utils/appError';
import { getSettings, isPushConfigured, SETTINGS_DEFAULTS } from '../services/notifications/notification.service';
import { isValidTimeZone } from '../services/notifications/schedule';

const uid = (res: Response): string => res.locals.user.id;
const PAGE = 30;
const unread = (userId: string) => prisma.notification.count({ where: { userId, readAt: null } });
const pick = (b: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(keys.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]));

export const listNotificationsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = uid(res);
    const cursor = req.query.cursor as string | undefined;
    const rows = await prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: { id: true, kind: true, title: true, body: true, url: true, readAt: true, createdAt: true },
    });
    const notifications = rows.slice(0, PAGE);
    res.status(200).json({
      status: 'success',
      data: { notifications, nextCursor: rows.length > PAGE ? notifications[PAGE - 1].id : null, unreadCount: await unread(userId) },
    });
  } catch (err) { next(err); }
};

export const readNotificationsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = uid(res);
    const where = req.body.all === true ? { userId, readAt: null } : { userId, readAt: null, id: { in: req.body.ids as string[] } };
    await prisma.notification.updateMany({ where, data: { readAt: new Date() } });
    res.status(200).json({ status: 'success', data: { unreadCount: await unread(userId) } });
  } catch (err) { next(err); }
};

export const getSettingsHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try { res.status(200).json({ status: 'success', data: { settings: await getSettings(uid(res)) } }); } catch (err) { next(err); }
};

export const putSettingsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = pick(req.body, ['nudgeEnabled', 'nudgeTime', 'timezone', 'shortcutEnabled', 'monthlySummaryEnabled']);
    if (data.timezone !== undefined && !isValidTimeZone(data.timezone as string)) throw new AppError(400, 'Unknown timezone');
    const userId = uid(res);
    await prisma.notificationSettings.upsert({ where: { userId }, create: { ...SETTINGS_DEFAULTS, ...data, userId }, update: data });
    res.status(200).json({ status: 'success', data: { settings: await getSettings(userId) } });
  } catch (err) { next(err); }
};

export const pushKeyHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isPushConfigured()) throw new AppError(503, "Push isn't set up");
    res.status(200).json({ status: 'success', data: { publicKey: config.get<string>('vapidPublicKey') } });
  } catch (err) { next(err); }
};

export const subscribeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = uid(res);
    const { endpoint, keys } = req.body as { endpoint: string; keys: { p256dh: string; auth: string } };
    const data = { userId, p256dh: keys.p256dh, auth: keys.auth };
    await prisma.pushSubscription.upsert({ where: { endpoint }, create: { endpoint, ...data }, update: data });
    res.status(201).json({ status: 'success' });
  } catch (err) { next(err); }
};

export const unsubscribeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: req.body.endpoint as string, userId: uid(res) } });
    res.status(204).end();
  } catch (err) { next(err); }
};
```

- [ ] **Step 5: Routes and mount.** `notification.routes.ts`: `router.use(deserializeUser, requireUser)`; `GET /` list; `POST /read`; `GET /settings`; `PUT /settings`. `push.routes.ts`: same middleware; `GET /key` (`validate(object({}))`), `POST /subscribe`, `DELETE /subscribe`. In `app.ts` import both and add `app.use('/api/notifications', notificationRouter); app.use('/api/push', pushRouter);` after `/api/assets`.

- [ ] **Step 6: Run and confirm it passes.** `cd backend && npm run test:int -- notifications && npx jest && npx tsc --noEmit` → PASS.

- [ ] **Step 7: Commit.**
```bash
git add backend/src backend/tests/notifications.int.ts
git commit -m "feat(notifications): list, read, settings and push subscription endpoints

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Bills API and wallet-delete guard

**Files:**
- Create: `backend/src/schemas/bill.schema.ts`, `backend/src/controllers/bill.controller.ts`, `backend/src/routes/bill.routes.ts`
- Modify: `backend/src/app.ts` (mount `/api/bills`), `backend/src/controllers/wallet.controller.ts` (`deleteWalletHandler`)
- Test: `backend/tests/bills.int.ts`

**Interfaces:**
- Produces (used by Tasks 5, 7):
  - `Bill` JSON: `{ id, name, amount: number, currency, walletId: string|null, categoryId: string|null, dayOfMonth, remindDaysBefore, active, createdAt, wallet: { id, name } | null, category: { id, name } | null }`
  - `GET /api/bills` → `{ data: { bills } }` ordered `dayOfMonth asc, name asc`; `POST /api/bills` → 201 `{ data: { bill } }`; `PATCH /api/bills/:id` (partial) → `{ data: { bill } }`; `DELETE /api/bills/:id` → 204; another user's id → 404 "Bill not found".
  - Validation messages: wallet not the caller's → 400 "Wallet not found"; category not the caller's/global, not EXPENSE or a transfer category → 400 "Choose an expense category"; wallet currency ≠ bill currency → 400 "Wallet currency doesn't match".
  - Wallet delete with bills → 400 `Cannot delete wallet with ${n} bill(s)`.

- [ ] **Step 1: Write the failing integration test** `backend/tests/bills.int.ts` (pattern from `wallet-balance.int.ts`, emails prefixed `bills-`; create wallet via `POST /api/wallets { name: 'Cash', currency: 'KRW', balance: 0 }` and an expense category via `POST /api/categories { name: 'Rent', type: 'EXPENSE' }`). Scenarios:
  1. Create `{ name: 'Rent', amount: 500000, currency: 'KRW', walletId, categoryId, dayOfMonth: 25, remindDaysBefore: 1 }` → 201 with `active: true`, `wallet.name === 'Cash'`, `category.name === 'Rent'`. `GET` lists it.
  2. Validation 400s: `dayOfMonth: 0`, `dayOfMonth: 32`, `remindDaysBefore: 2`, `amount: 0`, `currency: 'USD'`, `name: ''`, a 61-char name.
  3. Ownership: user B creating with A's `walletId` → 400 "Wallet not found"; B `PATCH`/`DELETE` A's bill → 404 "Bill not found"; B `GET` → empty list.
  4. An INCOME category → 400 "Choose an expense category"; an IDR wallet on a KRW bill → 400 "Wallet currency doesn't match"; bill with no wallet/category (both omitted) → 201 with `wallet: null`.
  5. `PATCH { active: false, userId: 'x' }` → 200, `active: false`, row still A's.
  6. Wallet guard: `DELETE /api/wallets/<walletId>` while the bill references it → 400 "Cannot delete wallet with 1 bill(s)"; after deleting the bill → 204.

- [ ] **Step 2: Run and confirm it fails.** `cd backend && npm run test:int -- bills` → FAIL.

- [ ] **Step 3: Schema** `backend/src/schemas/bill.schema.ts`:
```ts
import { object, string, number, boolean, z } from 'zod';

const billBody = object({
  name: string().trim().min(1, 'Name is required').max(60),
  amount: number().positive('Amount must be more than 0').lt(1e15, 'Amount is too large'),
  currency: z.enum(['KRW', 'IDR']),
  walletId: string().uuid().nullable().optional(),
  categoryId: string().uuid().nullable().optional(),
  dayOfMonth: number().int().min(1).max(31),
  remindDaysBefore: z.union([z.literal(0), z.literal(1), z.literal(3)]),
  active: boolean().optional(),
});
export const createBillSchema = object({ body: billBody });
export const updateBillSchema = object({ params: object({ id: string() }), body: billBody.partial() });
export const billParamsSchema = object({ params: object({ id: string() }) });
```

- [ ] **Step 4: Controller** `backend/src/controllers/bill.controller.ts`:
```ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../middleware/prismaMiddleware';
import AppError from '../utils/appError';

const uid = (res: Response): string => res.locals.user.id;
const include = { wallet: { select: { id: true, name: true } }, category: { select: { id: true, name: true } } };
const FIELDS = ['name', 'amount', 'currency', 'walletId', 'categoryId', 'dayOfMonth', 'remindDaysBefore', 'active'];
// Explicit pick: the validate middleware keeps unknown keys
const billData = (b: Record<string, unknown>) => Object.fromEntries(FIELDS.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]));

async function ownBill(userId: string, id: string) {
  const bill = await prisma.bill.findFirst({ where: { id, userId } });
  if (!bill) throw new AppError(404, 'Bill not found');
  return bill;
}

// walletId/categoryId must be the caller's (or a global category), expense-only, same currency
async function checkRefs(userId: string, d: { walletId?: string | null; categoryId?: string | null; currency?: string }) {
  if (d.walletId) {
    const w = await prisma.wallet.findFirst({ where: { id: d.walletId, userId } });
    if (!w) throw new AppError(400, 'Wallet not found');
    if (d.currency && w.currency !== d.currency) throw new AppError(400, "Wallet currency doesn't match");
  }
  if (d.categoryId) {
    const c = await prisma.category.findFirst({ where: { id: d.categoryId, OR: [{ userId }, { userId: null }], type: 'EXPENSE', isTransfer: false } });
    if (!c) throw new AppError(400, 'Choose an expense category');
  }
}

export const listBillsHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const bills = await prisma.bill.findMany({ where: { userId: uid(res) }, include, orderBy: [{ dayOfMonth: 'asc' }, { name: 'asc' }] });
    res.status(200).json({ status: 'success', data: { bills } });
  } catch (err) { next(err); }
};

export const createBillHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = uid(res);
    const data = billData(req.body) as any;
    await checkRefs(userId, data);
    const bill = await prisma.bill.create({ data: { ...data, userId }, include });
    res.status(201).json({ status: 'success', data: { bill } });
  } catch (err) { next(err); }
};

export const updateBillHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = uid(res);
    const existing = await ownBill(userId, req.params.id);
    const data = billData(req.body) as any;
    await checkRefs(userId, {
      walletId: data.walletId !== undefined ? data.walletId : existing.walletId,
      categoryId: data.categoryId,
      currency: data.currency ?? existing.currency,
    });
    const bill = await prisma.bill.update({ where: { id: existing.id }, data, include });
    res.status(200).json({ status: 'success', data: { bill } });
  } catch (err) { next(err); }
};

export const deleteBillHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bill = await ownBill(uid(res), req.params.id);
    await prisma.bill.delete({ where: { id: bill.id } });
    res.status(204).end();
  } catch (err) { next(err); }
};
```

- [ ] **Step 5: Routes, mount, wallet guard.** `bill.routes.ts`: `router.use(deserializeUser, requireUser)`; `GET /` (`validate(object({}))`), `POST /`, `PATCH /:id`, `DELETE /:id`. Mount `app.use('/api/bills', billRouter)`. In `deleteWalletHandler`, right after the transaction-count check, add:
```ts
    const billCount = await prisma.bill.count({ where: { walletId } });
    if (billCount > 0) {
      return next(new AppError(400, `Cannot delete wallet with ${billCount} bill(s)`));
    }
```
(import `prisma` from `../middleware/prismaMiddleware` if the controller doesn't already).

- [ ] **Step 6: Run and confirm it passes.** `cd backend && npm run test:int -- bills && npm run test:int -- wallet && npx tsc --noEmit` → PASS.

- [ ] **Step 7: Commit.**
```bash
git add backend/src backend/tests/bills.int.ts
git commit -m "feat(bills): monthly bills API; wallets with bills can't be deleted

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Scheduler and Shortcut-saved notification

**Files:**
- Create: `backend/src/services/notifications/scheduler.ts`
- Modify: `backend/src/app.ts` (start the scheduler only when listening), `backend/src/controllers/capture.controller.ts`, `backend/src/services/capture.service.ts` (export `money`)
- Test: `backend/tests/scheduler.int.ts`; extend `backend/tests/capture.int.ts`

**Interfaces:**
- Consumes: `notify`, `getSettings` (Task 2); `localParts`, `dayRangeUtc`, `monthRangeUtc`, `billReminderDue`, `previousMonth` (Task 1); Bill model (Task 4).
- Produces:
  - `runTick(now?: Date): Promise<void>` — one pass (exported for tests).
  - `startScheduler(): void` — runs `runTick()` now and every 60 s; a running flag skips overlapping ticks.
  - `money(amount: number, currency: string): string` exported from `capture.service.ts`.

- [ ] **Step 1: Write the failing integration test** `backend/tests/scheduler.int.ts` (real DB; `jest.mock('web-push', …)` as in Task 3; emails prefixed `sched-`). Helper `seedUser(tag)` registers via API and returns `{ agent, userId }`; give each user a settings row via `PUT /api/notifications/settings { timezone: 'Asia/Seoul' }` so the tick visits them. Wallet + EXPENSE category + INCOME category via API. Fixed clocks are `Date`s passed to `runTick(now)`. Scenarios (assert on `prisma.notification.findMany({ where: { userId } })`):
  1. **Nudge timing:** `runTick(new Date('2026-10-15T11:59:00Z'))` (20:59 KST) → no NUDGE. `runTick(new Date('2026-10-15T12:00:00Z'))` (21:00 KST) → one NUDGE, `dedupeKey 'nudge:2026-10-15'`, title "Nothing logged today", url `/?add=new`. Run the same tick again → still one row.
  2. **Nudge skipped when logged:** user with a transaction dated `2026-10-15T03:00:00Z` (12:00 KST) → `runTick(new Date('2026-10-15T13:00:00Z'))` → no NUDGE. A transaction dated `2026-10-14T14:30:00Z` (23:30 KST on the 14th) does **not** count for the 15th.
  3. **Nudge disabled:** `PUT settings { nudgeEnabled: false }` → no NUDGE at 22:00 KST.
  4. **Bill reminder:** bill `{ dayOfMonth: 25, remindDaysBefore: 1, amount: 500000, currency: 'KRW', walletId }` → `runTick(new Date('2026-10-24T00:00:00Z'))` (09:00 KST Oct 24) → one BILL, `dedupeKey 'bill:<id>:2026-10'`, url `/?add=bill:<id>`, title contains "Rent" and "tomorrow", body contains "₩500,000" and "Cash". Inactive bill → nothing. `runTick` on Oct 23 → nothing.
  5. **Bill across months:** bill `{ dayOfMonth: 1, remindDaysBefore: 3 }` → `runTick(new Date('2026-10-29T00:00:00Z'))` → BILL with key `bill:<id>:2026-11`.
  6. **Monthly summary:** user with Sept KST transactions: income 3,000,000 and expense 1,200,000 in a KRW wallet → `runTick(new Date('2026-09-30T23:30:00Z'))` (08:30 KST Oct 1) → no summary; `runTick(new Date('2026-10-01T00:00:00Z'))` (09:00 KST) → one MONTHLY_SUMMARY, key `summary:2026-09`, url `/?month=2026-09`, body contains "+₩3,000,000", "−₩1,200,000" (or the sign/format `money()` gives) and net "₩1,800,000". A transfer between two wallets in Sept is excluded. A user with no September transactions gets no summary.
  7. **Retention:** after `resetSchedulerState()`, a notification row with `createdAt` 91 days before the real `Date.now()` is deleted by the next tick; one 89 days old stays.
  8. **Who is visited:** a registered user with no settings row, no bill and no push subscription gets nothing at 22:00 KST.

  Extend `backend/tests/capture.int.ts` (Gemini already mocked there): after a successful `POST /api/capture/text`, the user has one SHORTCUT_SAVED notification with `dedupeKey 'tx:<transaction.id>'`, title "Saved from Shortcut", url `/transactions?wallet=<walletId>`. With `PUT settings { shortcutEnabled: false }` the next capture still answers 201 and creates no notification. With `jest.spyOn(notificationService, 'notify').mockRejectedValueOnce(new Error('db down'))` the capture still answers 201.

- [ ] **Step 2: Run and confirm it fails.** `cd backend && npm run test:int -- scheduler` → FAIL.

- [ ] **Step 3: Implement** `backend/src/services/notifications/scheduler.ts`:
```ts
import prisma from '../../middleware/prismaMiddleware';
import { money } from '../capture.service';
import { getSettings, notify } from './notification.service';
import { localParts, dayRangeUtc, monthRangeUtc, billReminderDue, previousMonth, dueDay } from './schedule';

const RETENTION_DAYS = 90;
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const shortDate = (ym: string, day: number) =>
  new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, day)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

// Users worth visiting: anyone with a device, settings or an active bill (not every test account)
const scheduledUserIds = async () => {
  const [subs, settings, bills] = await Promise.all([
    prisma.pushSubscription.findMany({ select: { userId: true }, distinct: ['userId'] }),
    prisma.notificationSettings.findMany({ select: { userId: true } }),
    prisma.bill.findMany({ where: { active: true }, select: { userId: true }, distinct: ['userId'] }),
  ]);
  return [...new Set([...subs, ...settings, ...bills].map((r) => r.userId))];
};

const nonTransfer = (userId: string) => ({ wallet: { userId }, category: { isTransfer: false } });

async function nudge(userId: string, now: Date, s: Awaited<ReturnType<typeof getSettings>>) {
  if (!s.nudgeEnabled) return;
  const local = localParts(now, s.timezone);
  if (local.hour * 60 + local.minute < minutes(s.nudgeTime)) return;
  const { start, end } = dayRangeUtc(local.ymd, s.timezone);
  const logged = await prisma.transaction.count({ where: { ...nonTransfer(userId), date: { gte: start, lt: end } } });
  if (logged > 0) return;
  await notify(userId, 'NUDGE', { title: 'Nothing logged today', body: "Add today's expenses?", url: '/?add=new', dedupeKey: `nudge:${local.ymd}` });
}

async function bills(userId: string, now: Date, timezone: string) {
  const local = localParts(now, timezone);
  const rows = await prisma.bill.findMany({ where: { userId, active: true }, include: { wallet: { select: { name: true } } } });
  for (const b of rows) {
    const dueMonth = billReminderDue(local.ymd, b.dayOfMonth, b.remindDaysBefore);
    if (!dueMonth) continue;
    const when = b.remindDaysBefore === 0 ? 'today' : b.remindDaysBefore === 1 ? 'tomorrow'
      : shortDate(dueMonth, dueDay(Number(dueMonth.slice(0, 4)), Number(dueMonth.slice(5, 7)), b.dayOfMonth));
    await notify(userId, 'BILL', {
      title: `${b.name} due ${when}`,
      body: `${money(b.amount.toNumber(), b.currency)} · ${b.wallet?.name ?? 'no wallet'}`,
      url: `/?add=bill:${b.id}`,
      dedupeKey: `bill:${b.id}:${dueMonth}`,
    });
  }
}

async function summary(userId: string, now: Date, s: Awaited<ReturnType<typeof getSettings>>) {
  if (!s.monthlySummaryEnabled) return;
  const local = localParts(now, s.timezone);
  if (local.day !== 1 || local.hour < 9) return;
  const ym = previousMonth(local.ym);
  const { start, end } = monthRangeUtc(ym, s.timezone);
  const txs = await prisma.transaction.findMany({
    where: { ...nonTransfer(userId), date: { gte: start, lt: end } },
    select: { amount: true, wallet: { select: { currency: true } }, category: { select: { type: true } } },
  });
  if (txs.length === 0) return;
  const per = new Map<string, { income: number; spending: number }>();
  for (const t of txs) {
    const row = per.get(t.wallet.currency) ?? { income: 0, spending: 0 };
    if (t.category.type === 'INCOME') row.income += t.amount.toNumber(); else row.spending += t.amount.toNumber();
    per.set(t.wallet.currency, row);
  }
  const body = [...per.entries()]
    .map(([cur, r]) => `${cur}: +${money(r.income, cur)} in, −${money(r.spending, cur)} out, net ${money(r.income - r.spending, cur)}`)
    .join(' · ');
  const monthName = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  await notify(userId, 'MONTHLY_SUMMARY', { title: `${monthName} summary`, body, url: `/?month=${ym}`, dedupeKey: `summary:${ym}` });
}

let lastCleanup = 0;
export async function runTick(now = new Date()) {
  // Retention uses the real clock, never the tick's (a test clock must not wipe real rows)
  if (Date.now() - lastCleanup > 86_400_000) {
    lastCleanup = Date.now();
    await prisma.notification.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86_400_000) } } });
  }
  for (const userId of await scheduledUserIds()) {
    try {
      const s = await getSettings(userId);
      await nudge(userId, now, s);
      await bills(userId, now, s.timezone);
      await summary(userId, now, s);
    } catch (err) {
      console.error('Scheduler failed for a user:', (err as Error)?.message);
    }
  }
}

let running = false;
export function startScheduler() {
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runTick(); } catch (err) { console.error('Scheduler tick failed:', (err as Error)?.message); } finally { running = false; }
  };
  tick();
  setInterval(tick, 60_000).unref();
}
```
Note for the test: the retention block runs on the first `runTick` call and then at most daily; in scenario 7 call a fresh import or reset by testing retention in the first tick of the file, or export `resetSchedulerState()` that sets `lastCleanup = 0` and call it in `beforeEach`. Add that export:
```ts
export const resetSchedulerState = () => { lastCleanup = 0; };
```

- [ ] **Step 4: Start it with the server.** In `backend/src/app.ts`, inside the existing `if (require.main === module)` block's `app.listen` callback, after the log line, add `startScheduler();` with `import { startScheduler } from './services/notifications/scheduler';`. Tests import `app` without listening, so Jest never starts it.

- [ ] **Step 5: Shortcut notification.** In `capture.service.ts` change `const money =` to `export const money =`. In `captureTextHandler`, after `createTransaction(...)` and before `res.status(201)…`, add:
```ts
    // Never fails the capture: a missing push or DB hiccup must not lose the Shortcut's response
    try {
      const settings = await getSettings(res.locals.user.id);
      if (settings.shortcutEnabled) {
        const sign = draft.type === 'INCOME' ? '+' : '−';
        await notify(res.locals.user.id, 'SHORTCUT_SAVED', {
          title: 'Saved from Shortcut',
          body: `${sign}${money(draft.amount, draft.currency)} · ${draft.categoryName} → ${draft.walletName}`,
          url: `/transactions?wallet=${draft.walletId}`,
          dedupeKey: `tx:${transaction.id}`,
        });
      }
    } catch (err) {
      console.error('Shortcut notification failed:', (err as Error)?.message);
    }
```
with imports `import { getSettings, notify } from '../services/notifications/notification.service';` and `money` added to the existing `capture.service` import. (For the capture test's `jest.spyOn` to work, call through the module object: `import * as notifications from '../services/notifications/notification.service'` and use `notifications.notify` / `notifications.getSettings`.)

- [ ] **Step 6: Run and confirm it passes.** `cd backend && npm run test:int -- scheduler && npm run test:int -- capture && npx jest && npx tsc --noEmit` → PASS.

- [ ] **Step 7: Commit.**
```bash
git add backend/src backend/tests/scheduler.int.ts backend/tests/capture.int.ts
git commit -m "feat(notifications): scheduler for nudges, bill reminders and monthly summary; Shortcut-saved notice

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Client push plumbing and Profile notification settings

**Files:**
- Create: `client/public/push-sw.js`, `client/src/services/push.service.ts`, `client/src/components/notification-settings.tsx`
- Modify: `client/vite.config.ts` (`workbox.importScripts`), `client/src/contexts/auth.context.tsx` (`logout` unsubscribes), `client/src/pages/Profile.tsx` (Notifications section + "Bills" row under Money)
- Test: `client/src/test/NotificationSettings.test.tsx`, `client/src/test/pushService.test.ts`

**Interfaces:**
- Consumes: `GET/PUT /api/notifications/settings`, `GET /api/push/key`, `POST/DELETE /api/push/subscribe` (Task 3).
- Produces (used by Task 8): `push.service.ts` exports
  - `type PushStatus = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'`
  - `pushStatus(): Promise<PushStatus>`
  - `subscribePush(): Promise<void>` (throws `Error` with a user-facing message)
  - `unsubscribePush(): Promise<void>` (never throws)

- [ ] **Step 1: Service worker addon** `client/public/push-sw.js`:
```js
// Imported by the generated service worker (vite.config.ts workbox.importScripts)
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'Finance', body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Finance', {
    body: data.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || '/';
  // Same-origin paths only
  const url = new URL(raw.startsWith('/') ? raw : '/', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
    if (open) { await open.focus(); return open.navigate(url); }
    return self.clients.openWindow(url);
  })());
});
```
In `vite.config.ts` `workbox` add `importScripts: ['push-sw.js'],`.

- [ ] **Step 2: Write the failing tests.**
`client/src/test/pushService.test.ts` — stub `navigator.serviceWorker`, `window.PushManager`, `Notification`, `matchMedia` and axios (`vi.mock('@/lib/axios', …)` as in `ManualClassCard.test.tsx`):
  1. No `PushManager` → `pushStatus()` resolves `'unsupported'`.
  2. iOS user agent (`iPhone`), `matchMedia('(display-mode: standalone)').matches === false`, `navigator.standalone` undefined → `'needs-install'`.
  3. `Notification.permission === 'denied'` → `'denied'`.
  4. `pushManager.getSubscription()` resolves null → `'off'`; resolves a subscription → `'on'`.
  5. `subscribePush()` with permission granted: calls `GET /api/push/key`, `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: <Uint8Array> })`, then `POST /api/push/subscribe` with `subscription.toJSON()`'s `{ endpoint, keys }`.
  6. `subscribePush()` when `Notification.requestPermission()` resolves `'denied'` → rejects with message "Notifications are blocked — allow them in Settings → Finance".
  7. `unsubscribePush()` calls `subscription.unsubscribe()` and `DELETE /api/push/subscribe` with `{ data: { endpoint } }`; with no subscription it resolves without calling axios.

`client/src/test/NotificationSettings.test.tsx` — mock `@/services/push.service` and axios:
  1. Renders "Daily reminder" switch checked, time input "21:00", "Shortcut saves" and "Monthly summary" switches from `GET /api/notifications/settings`.
  2. Toggling "Daily reminder" sends `PUT /api/notifications/settings { nudgeEnabled: false }`; changing the time and blurring sends `{ nudgeTime: '20:30' }`.
  3. On load, when the browser timezone (`vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')` → `{ timeZone: 'Asia/Jakarta' }`) differs from the stored one, it sends `PUT { timezone: 'Asia/Jakarta' }` once; equal → no PUT.
  4. Push status `'needs-install'` shows "Add to Home Screen to get push"; `'denied'` shows "Notifications are blocked — allow them in Settings → Finance"; `'off'` shows an "Enable push" button which calls `subscribePush` and then shows the switch on; a `subscribePush` rejection shows its message in `role="alert"`.

- [ ] **Step 3: Run and confirm they fail.** `cd client && npx vitest run src/test/pushService.test.ts src/test/NotificationSettings.test.tsx` → FAIL.

- [ ] **Step 4: Implement** `client/src/services/push.service.ts`:
```ts
import axios from '@/lib/axios';

export type PushStatus = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';
export const BLOCKED = 'Notifications are blocked — allow them in Settings → Finance';

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const subscription = async () => {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
};

const keyBytes = (base64url: string) => {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export async function pushStatus(): Promise<PushStatus> {
  if (isIos() && !isStandalone()) return 'needs-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return (await subscription()) ? 'on' : 'off';
}

export async function subscribePush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(BLOCKED);
  const { data } = await axios.get('/api/push/key');
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(data.data.publicKey) });
  const { endpoint, keys } = sub.toJSON();
  await axios.post('/api/push/subscribe', { endpoint, keys });
}

export async function unsubscribePush(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;
    const sub = await subscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await axios.delete('/api/push/subscribe', { data: { endpoint } });
  } catch {
    // Logging out or turning push off must not fail on a flaky push service
  }
}
```
(Order of checks: the test for `'unsupported'` must not use an iOS user agent.)

- [ ] **Step 5: Implement** `client/src/components/notification-settings.tsx` — a `section` with `aria-label="Notifications"` styled like Profile's Preferences card (`rounded-[24px] bg-card p-5 shadow-resting space-y-4`), using `Switch` from `@/components/ui/switch`, `Input` (`type="time"`, `aria-label="Reminder time"`), and rows:
  - "Push on this device" — by `pushStatus()`: `'on'` → `Switch` checked (`aria-label="Push on this device"`; off → `unsubscribePush()` then status `'off'`); `'off'` → `PillButton`/`Button` "Enable push" (calls `subscribePush()`, then `'on'`; on error show `err.message` in `<p role="alert">`); `'needs-install'` → muted text "Add to Home Screen to get push"; `'denied'` → muted text with `BLOCKED`; `'unsupported'` → "This browser can't receive push".
  - "Daily reminder" switch (`aria-label="Daily reminder"`) + time input (shown when enabled; sends on `blur` when the value changed).
  - "Shortcut saves" switch, "Monthly summary" switch.
  - Each change sends `axios.put('/api/notifications/settings', { <field>: value })` and updates local state from the response's `data.settings`; on failure revert and show `toast.error(apiMessage(err) ?? "Couldn't save")` (Profile already uses `sonner`'s `toast`).
  - On mount: `GET /api/notifications/settings`; then if `Intl.DateTimeFormat().resolvedOptions().timeZone` is set and differs from `settings.timezone`, `PUT { timezone }`.
- In `Profile.tsx`: add `<SectionLabel>Notifications</SectionLabel><NotificationSettings />` after the Preferences section; in the Money section add `<Row icon={Receipt} title="Bills" subtitle="Monthly reminders" onClick={() => navigate('/bills')} />` (import `Receipt` from `lucide-react`).
- In `auth.context.tsx` `logout`: before `axios.get('/api/auth/logout')`, `await unsubscribePush();` (it needs the session cookie, so it must run first).

- [ ] **Step 6: Run and confirm they pass.** `cd client && npx vitest run && npx tsc --noEmit -p tsconfig.app.json && npx eslint src/services/push.service.ts src/components/notification-settings.tsx src/pages/Profile.tsx` → PASS (existing Profile tests may need a `vi.mock('@/services/push.service', …)` returning `'unsupported'`; add it to them if they now fail on `navigator.serviceWorker`).

- [ ] **Step 7: Commit.**
```bash
git add client/public/push-sw.js client/vite.config.ts client/src
git commit -m "feat(client): push subscription, service worker push handler, Profile notification settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Bills page and deep links (`?add=`, `?wallet=`, `?month=`)

**Files:**
- Create: `client/src/pages/Bills.tsx`, `client/src/components/bills/bill-form.tsx`, `client/src/hooks/use-bills.ts`
- Modify: `client/src/Router.tsx` (`bills` route), `client/src/components/app-layout.tsx` (handle `?add=`), `client/src/components/finance/add-transaction-sheet.tsx` and `transaction-form.tsx` (accept an initial draft), `client/src/pages/Transactions.tsx` (`?wallet=`), `client/src/pages/Dashboard.tsx` (`?month=`)
- Test: `client/src/test/Bills.test.tsx`, `client/src/test/DeepLinks.test.tsx`

**Interfaces:**
- Consumes: `/api/bills` (Task 4); `useWallets`, `useCategories`, `FilterChips`, `ConfirmationModal`, `Sheet`, `PageTitle`, `PillButton`, `formatCurrency`; `TransactionDraft` and `applyDraft` from `use-transaction-form.ts`.
- Produces:
  - `useBills(): { bills: Bill[]; loading: boolean; error: string | null; refetch: () => Promise<void> }`
  - `TransactionForm` prop `initialDraft?: TransactionDraft` (applied once on mount through `applyDraft`), `AddTransactionSheet` prop `initialDraft?: TransactionDraft`.

- [ ] **Step 1: Write the failing tests.**
`client/src/test/Bills.test.tsx` (axios, `useWallets`, `useCategories` mocked; render inside `MemoryRouter`):
  1. Lists bills from `GET /api/bills`: "Rent", "₩500,000", "Every month on the 25th · remind 1 day before", "Cash". Day 1 → "1st", 2 → "2nd", 3 → "3rd", 22 → "22nd"; `remindDaysBefore` 0 → "remind on the due day", 3 → "remind 3 days before".
  2. "Add bill" → sheet → fill Name "Phone", Amount 55000, Currency KRW, Wallet "Cash", Category "Bills", Day 3, Remind "1 day before" → Save → `axios.post('/api/bills', { name: 'Phone', amount: 55000, currency: 'KRW', walletId: 'w1', categoryId: 'c1', dayOfMonth: 3, remindDaysBefore: 1, active: true })`, then refetch.
  3. The Day field shows the hint "Short months use the last day".
  4. Tap a bill → edit sheet prefilled; change amount → `axios.patch('/api/bills/b1', objectContaining({ amount: 510000 }))`. Delete → confirmation → `axios.delete('/api/bills/b1')`.
  5. Wallet choices are filtered to the bill's currency; changing currency clears a wallet of the other currency.
  6. A server 400 message shows inline in `role="alert"`.
  7. Empty list shows "No bills yet" and the "Add bill" button.

`client/src/test/DeepLinks.test.tsx` (render `AppLayout` routes in a `MemoryRouter` with `initialEntries`, axios mocked):
  1. `/?add=bill:b1` → `GET /api/bills` is called, the Add transaction sheet opens with amount "500000", description "Rent", the bill's wallet and category selected, type Expense; the URL no longer contains `add=` (assert via a location probe component).
  2. `/?add=bill:missing` (bill not in the list) → the sheet opens empty and `toast` shows "That bill no longer exists".
  3. `/?add=new` → the sheet opens empty.
  4. `/transactions?wallet=w2` → `setSelectedWalletId('w2')` effect: the persisted `selected_wallet` becomes `w2` and the param is removed.
  5. `/?month=2026-09` → Home's month switcher shows "September 2026"; invalid `?month=abc` → current month.

- [ ] **Step 2: Run and confirm they fail.** `cd client && npx vitest run src/test/Bills.test.tsx src/test/DeepLinks.test.tsx` → FAIL.

- [ ] **Step 3: Initial draft in the form.** In `transaction-form.tsx` add prop `initialDraft?: TransactionDraft`; after `useTransactionForm(...)`:
```tsx
  // Prefill once (e.g. from a bill reminder); the user still taps Save
  useEffect(() => {
    if (initialDraft) applyDraft(initialDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```
and pass `type: initialDraft?.type ?? initialType` into the `type` state initialiser. `AddTransactionSheet` gets `initialDraft?: TransactionDraft` and renders `<TransactionForm … initialDraft={initialDraft} />`.

- [ ] **Step 4: Deep links in the shell.** In `app-layout.tsx`:
```tsx
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState<TransactionDraft | undefined>();
  const add = searchParams.get('add');
  useEffect(() => {
    if (!add) return;
    const next = new URLSearchParams(searchParams);
    next.delete('add');
    setSearchParams(next, { replace: true }); // a second render or Back must not reopen it
    if (add === 'new') { setDraft(undefined); setIsAddOpen(true); return; }
    const billId = add.startsWith('bill:') ? add.slice(5) : null;
    if (!billId) return;
    axios.get('/api/bills').then(({ data }) => {
      const bill = (data.data.bills as Bill[]).find((b) => b.id === billId);
      if (!bill) toast.error('That bill no longer exists');
      setDraft(bill ? { type: 'EXPENSE', amount: bill.amount, description: bill.name, date: new Date().toISOString(), walletId: bill.walletId ?? '', categoryId: bill.categoryId ?? '' } : undefined);
      setIsAddOpen(true);
    }).catch(() => setIsAddOpen(true));
  }, [add]); // eslint-disable-line react-hooks/exhaustive-deps
```
pass `initialDraft={draft}` to `AddTransactionSheet`, and clear `draft` when the sheet closes (`onOpenChange={(o) => { setIsAddOpen(o); if (!o) setDraft(undefined); }}`). The footer "+" keeps opening it empty. (Check how `TransactionForm` stores `date` — the photo-capture flow passes the server's ISO instant to `applyDraft`, so an ISO string is accepted; if the date input then shows wrongly, convert the same way the capture flow's draft is handled.)
In `Transactions.tsx`: read `?wallet=`; when present, `setSelectedWalletId(wallet)` and remove the param (`replace: true`).
In `Dashboard.tsx`: initialise `month` from `?month=` when it matches `/^\d{4}-(0[1-9]|1[0-2])$/` (`new Date(year, month - 1, 1)`), else `new Date()`; remove the param after reading.

- [ ] **Step 5: Bills page.** `use-bills.ts` follows `use-portfolio.ts`'s shape (`{ bills, loading, error, refetch }`, `GET /api/bills`). `Bills.tsx`: `PageTitle` eyebrow "Money", title "Bills", action `PillButton` "Add bill"; list of cards (`rounded-[24px] bg-card p-5 shadow-resting`, button role, `aria-label={bill.name}`): name + amount (`formatCurrency(amount, currency)`), caption `Every month on the ${ordinal(day)} · ${remindText}`, wallet name or "No wallet", a muted "Paused" badge when `!active`; empty state "No bills yet". `bill-form.tsx` in a bottom `Sheet` (same classes as `AddTransactionSheet`): Name (`maxLength 60`), Amount (number), Currency `FilterChips` KRW/IDR, Wallet select (wallets of that currency + "No wallet"), Category select (EXPENSE, non-transfer categories + "No category"), Day of month (number 1–31, hint "Short months use the last day"), Remind `FilterChips` "On the due day"/"1 day before"/"3 days before" (0/1/3), Active `Switch`; Save posts or patches (explicit fields as in test 2), Delete via `ConfirmationModal`. Register `<Route path="bills" element={<Bills />} />` in `Router.tsx`.

- [ ] **Step 6: Run and confirm they pass.** `cd client && npx vitest run && npx tsc --noEmit -p tsconfig.app.json && npx eslint src/pages/Bills.tsx src/components/bills src/components/app-layout.tsx src/hooks/use-bills.ts` → PASS.

- [ ] **Step 7: Commit.**
```bash
git add client/src
git commit -m "feat(client): Bills page, prefilled add from a bill, wallet and month deep links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Notifications page and header bell

**Files:**
- Create: `client/src/pages/Notifications.tsx`, `client/src/components/notifications/notification-card.tsx`, `client/src/hooks/use-notifications.ts`, `client/src/hooks/use-unread-count.ts`
- Modify: `client/src/Router.tsx` (`notifications` route), `client/src/components/app-header.tsx` (bell), `client/src/components/app-layout.tsx` (pass `dataVersion` to header)
- Test: `client/src/test/Notifications.test.tsx`, `client/src/test/AppHeaderBell.test.tsx`

**Interfaces:**
- Consumes: `GET /api/notifications`, `POST /api/notifications/read` (Task 3); `pushStatus` (Task 6).
- Produces:
  - `useNotifications(): { items: AppNotification[]; unreadCount: number; loading: boolean; error: string | null; hasMore: boolean; loadMore: () => Promise<void>; markRead: (ids: string[] | 'all') => Promise<void> }`
  - `useUnreadCount(refreshKey: number): number` — fetches on mount, on `refreshKey` change and on `visibilitychange` to visible.
  - `AppNotification = { id; kind: 'NUDGE' | 'BILL' | 'SHORTCUT_SAVED' | 'MONTHLY_SUMMARY'; title; body; url; readAt: string | null; createdAt: string }`

- [ ] **Step 1: Write the failing tests.**
`client/src/test/Notifications.test.tsx` (axios + push service mocked, `MemoryRouter`, `vi.setSystemTime(new Date('2026-10-15T10:00:00+09:00'))`):
  1. Groups: items created today, yesterday and Oct 10 render under "Today", "Yesterday" and "Oct 10"; the header shows "3 unread".
  2. Each kind shows its action: BILL "Record payment", NUDGE "Add expense", SHORTCUT_SAVED "View", MONTHLY_SUMMARY "See month"; unread items show a dot (`aria-label="Unread"`).
  3. Tapping an action calls `POST /api/notifications/read { ids: [id] }` and navigates to the item's `url` (location probe shows `/?add=bill:b1`).
  4. "Mark all read" (`aria-label="Mark all read"`) calls `POST /api/notifications/read { all: true }` and the dots disappear.
  5. Chips "All 4", "Reminders 2", "Activity 2"; choosing Reminders shows only BILL and NUDGE.
  6. `nextCursor` present → scrolling to the sentinel (mock `IntersectionObserver` and trigger it) requests `GET /api/notifications?cursor=<id>` and appends.
  7. Empty list → "No notifications yet"; with push status `'off'` also "Turn on push in Profile".
  8. The settings button (`aria-label="Notification settings"`) navigates to `/profile`.

`client/src/test/AppHeaderBell.test.tsx`: unreadCount 2 → bell link `aria-label="Notifications, 2 unread"` with a dot; 0 → `aria-label="Notifications"`, no dot; clicking goes to `/notifications`; a `visibilitychange` to visible refetches.

- [ ] **Step 2: Run and confirm they fail.** `cd client && npx vitest run src/test/Notifications.test.tsx src/test/AppHeaderBell.test.tsx` → FAIL.

- [ ] **Step 3: Implement.**
  - `use-unread-count.ts`: `GET /api/notifications` → `data.data.unreadCount`; errors keep the last value.
  - `app-header.tsx`: accept `refreshKey: number` (from `AppLayout`'s `dataVersion`); before `ModeToggle` render a `Link` to `/notifications` with a `Bell` icon (lucide), `aria-label` per test, and a lime dot (`size-2 rounded-full bg-lime absolute top-2 right-2`) when count > 0, styled like the existing round header buttons.
  - `use-notifications.ts`: first page on mount; `loadMore` with `cursor`; `markRead` posts and updates `readAt` locally and `unreadCount` from the response.
  - `notification-card.tsx`: follows the mockup card (`docs/design/stitch/notifications.png`) — `rounded-[24px] bg-card p-5 shadow-resting`; icon tile (`size-12 rounded-[16px]`): BILL `Receipt` on `bg-muted`, NUDGE `PencilLine` on `bg-lime-soft`, SHORTCUT_SAVED `ArrowDownLeft` on `bg-muted`, MONTHLY_SUMMARY `ChartColumn` on `bg-muted`; title (truncate), unread dot, time (`HH:mm` 24h, `en-GB`); body (amount text in the body is plain); action pill (dark pill `bg-foreground text-background` for BILL/NUDGE, muted pill for the others) labelled per Step 1. The whole card is a button that marks read and navigates; the action does the same.
  - `Notifications.tsx`: back link (`ChevronLeft`, to `/`), title "Notifications", subtitle `${unreadCount} unread` (or "All caught up"), round buttons "Mark all read" (`CheckCheck`) and "Notification settings" (`SlidersHorizontal`, to `/profile`); `FilterChips` All/Reminders/Activity with counts of loaded items; groups by local date of `createdAt` ("Today", "Yesterday", else `MMM d`) with the date on the right (`MMM d`); an `IntersectionObserver` sentinel calls `loadMore` when `hasMore`; empty state text per test.
  - Register `<Route path="notifications" element={<Notifications />} />`.

- [ ] **Step 4: Run and confirm they pass.** `cd client && npx vitest run && npx tsc --noEmit -p tsconfig.app.json && npx eslint src/pages/Notifications.tsx src/components/notifications src/hooks/use-notifications.ts src/hooks/use-unread-count.ts src/components/app-header.tsx` → PASS.

- [ ] **Step 5: Commit.**
```bash
git add client/src
git commit -m "feat(client): Notifications page and header bell with unread count

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: End-to-end scenarios and docs

**Files:**
- Create: `client/e2e/notifications.e2e.ts`
- Modify: `client/e2e/SCENARIOS.md`, `CLAUDE.md`, `client/playwright.config.ts` (backend env: `VAPID_PUBLIC_KEY: ''`, `VAPID_PRIVATE_KEY: ''` so a developer's local keys never reach a push service from e2e)

**Interfaces:** consumes the UI from Tasks 6–8 and `client/e2e/helpers.ts` (`signUp`, `api`, `seedWallet`, `seedCategory`).

- [ ] **Step 1: Scenarios** in `client/e2e/notifications.e2e.ts` (read `helpers.ts` and `assets.e2e.ts` first):

| ID | Scenario | Expected |
|---|---|---|
| N1 | `GET /api/notifications` mocked via `page.route` (predicate `url.pathname === '/api/notifications'`) with a BILL (unread, today), a SHORTCUT_SAVED (read, yesterday); `POST /api/notifications/read` mocked and recorded | Home bell shows "Notifications, 1 unread"; the page shows "Today"/"Yesterday", "Record payment" and "View"; "Mark all read" posts `{ all: true }` |
| N2 | Seed wallet "Cash" (KRW) + expense category via API; create a bill through the Bills page UI (Profile → Bills → Add bill); then `page.goto('/?add=bill:<id>')` (id from `GET /api/bills` via `api`) | Bills list shows the bill and caption; the Add transaction sheet opens with the bill's amount and name, wallet "Cash"; saving creates a transaction (`txCount` 1) |
| N3 | Profile → Notifications: turn "Daily reminder" off, set time 20:30, turn "Monthly summary" off; reload | `GET /api/notifications/settings` (real) returns the saved values and the switches show them |

- [ ] **Step 2: Run.** `cd client && npx playwright test e2e/notifications.e2e.ts`, then the full `npm run test:e2e`. All must pass; fix app bugs rather than weakening assertions. Ports 8010/5180 must be free; never kill processes you didn't start.

- [ ] **Step 3: Docs.**
  - `SCENARIOS.md`: add a "Notifications (`notifications.e2e.ts`)" table for N1–N3 and the file in the Files list.
  - `CLAUDE.md`:
    - Backend architecture: "`services/notifications/` — `notify()` is the only way to create a notification (deduped by `(userId, dedupeKey)`, then pushed with `web-push`; 404/410 subscriptions deleted); `scheduler.ts` runs every 60 s in the server process (started only when listening) for daily nudges, bill reminders and the monthly summary, using the pure calendar logic in `schedule.ts`; notifications older than 90 days are deleted. Never call a real push service in tests."
    - Data model: "`Notification` / `PushSubscription` / `Bill` / `NotificationSettings` → in-app history, per-device push endpoints, monthly bills (remind only), per-user settings (defaults when no row)".
    - Frontend: "`/notifications` (bell on Home), `/bills` (Profile → Bills), notification settings in Profile; `public/push-sw.js` is imported into the generated service worker; deep links `/?add=new|bill:<id>`, `/transactions?wallet=<id>`, `/?month=<yyyy-mm>`".
    - Key Conventions: "`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` enable push (`npx web-push generate-vapid-keys`); unset → in-app only, `GET /api/push/key` 503".

- [ ] **Step 4: Commit.**
```bash
git add client/e2e client/playwright.config.ts CLAUDE.md
git commit -m "test(e2e): notifications N1-N3; docs for notifications, push and bills

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
