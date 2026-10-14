# Notifications, push and recurring bills — design

Date: 2026-10-15 · Status: approved in conversation, pending written-spec review

## Goal

Remind the user to log money and to pay recurring bills, and tell them about things the app did on its own,
through Web Push to the installed PWA plus an in-app history list.

## Scope

In:
- Notifications page: in-app list of past notifications (read/unread), grouped by day, filter chips.
- Web Push to every device the user enabled (iOS 16.4+ installed PWA, Android, desktop).
- Notification kinds:
  - `NUDGE` — daily "nothing logged today" reminder at a user-chosen time.
  - `BILL` — recurring monthly bill reminder (remind only; never records a transaction).
  - `SHORTCUT_SAVED` — a transaction saved through the iOS Shortcut (`POST /api/capture/text`).
  - `MONTHLY_SUMMARY` — last month's income / spending / net per currency, on the 1st.
- Bills: monthly bills managed from Profile → Bills.
- Notification settings in the Profile page.

Out (not now): weekly/yearly bills, auto-recording bills, budgets, price alerts, email notifications.

## Data model (one additive migration)

```prisma
model Notification {
  id        String    @id @default(uuid())
  userId    String
  kind      String    // NUDGE | BILL | SHORTCUT_SAVED | MONTHLY_SUMMARY (validated in code)
  title     String
  body      String
  url       String    // same-origin path, built by the server
  dedupeKey String
  readAt    DateTime?
  createdAt DateTime  @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, dedupeKey])
  @@index([userId, createdAt])
  @@map("notifications")
}

model PushSubscription {
  id        String   @id @default(uuid())
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("push_subscriptions")
}

model Bill {
  id               String  @id @default(uuid())
  userId           String
  name             String  // ≤ 60 chars
  amount           Decimal @db.Decimal(19, 4)
  currency         String  // KRW | IDR
  walletId         String?
  categoryId       String?
  dayOfMonth       Int     // 1–31; short months use their last day
  remindDaysBefore Int     // 0 | 1 | 3
  active           Boolean @default(true)
  createdAt        DateTime @default(now())
  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  wallet   Wallet?   @relation(fields: [walletId], references: [id], onDelete: SetNull)
  category Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  @@map("bills")
}

model NotificationSettings {
  userId                String  @id
  nudgeEnabled          Boolean @default(true)
  nudgeTime             String  @default("21:00") // HH:mm
  timezone              String  @default("Asia/Seoul") // IANA, sent by the browser
  shortcutEnabled       Boolean @default(true)
  monthlySummaryEnabled Boolean @default(true)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("notification_settings")
}
```

A user without a settings row behaves as if the defaults were stored. Deleting a wallet that still has bills
is refused (400, same pattern as a wallet with transactions); the `SetNull` relation only covers deletes that
bypass that check. A bill whose category was deleted still reminds; the prefilled sheet leaves the field empty.

## Backend

### `services/notification.service.ts`

`notify(userId, kind, { title, body, url, dedupeKey })` is the only way to create a notification:
1. Insert the row. A unique-violation on `(userId, dedupeKey)` means it was already sent: return without pushing.
2. Push to each of the user's `PushSubscription`s with `web-push` (5 s timeout each), payload
   `{ title, body, url }`. A 404/410 response deletes that subscription. Other failures are logged as
   `Push failed: <status> <endpoint host>` (never the keys). Push failures never throw to the caller.
3. If `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` are unset, skip step 2 with a one-time warning log.

`url` is built by the server from fixed patterns only: `/?add=bill:<billId>`, `/?add=new`,
`/transactions?tx=<transactionId>`, `/?month=<yyyy-mm>`.

### `services/scheduler.ts`

- Started from `app.ts` after the server is ready; not started when `NODE_ENV=test` or under Jest.
- `setInterval` every 60 s plus one run at startup. A running flag skips a tick while the previous one runs.
- Each tick loads users who have a settings row or an active bill, and per user (own try/catch):
  - **Nudge**: settings `nudgeEnabled`; local now (in `timezone`) ≥ `nudgeTime` on local date D; no
    non-transfer transaction dated within local D; → `notify(NUDGE, dedupeKey "nudge:<D>", url "/?add=new")`.
    Title "Nothing logged today", body "Add today's expenses?".
  - **Bills**: for each active bill, due date in the current local month = `min(dayOfMonth, lastDay)`;
    if local today = due date − `remindDaysBefore` → `notify(BILL, "bill:<id>:<yyyy-mm>", "/?add=bill:<id>")`.
    Title "<name> due <today|tomorrow|Oct 25>", body "<formatted amount> · <wallet name or 'no wallet'>".
    A reminder date that falls in the previous month (e.g. due on the 1st, remind 3 days before) is checked
    against next month's due date too.
  - **Monthly summary**: settings `monthlySummaryEnabled`; local date is the 1st and local time ≥ 09:00 →
    for last local month, per currency with any non-transfer transactions: income, spending, net →
    `notify(MONTHLY_SUMMARY, "summary:<yyyy-mm>", "/?month=<yyyy-mm>")`. No transactions → nothing sent.
- Missed times (server down) are caught up on the next tick on the same local day; a later day never sends
  an older day's nudge.
- Once a day the tick deletes notifications older than 90 days.
- The date logic lives in pure functions (`schedule.ts`: `dueDate`, `reminderDate`, `localParts`) for unit tests.

### Shortcut capture

`POST /api/capture/text`, after saving, calls
`notify(SHORTCUT_SAVED, "tx:<transactionId>", "/transactions?tx=<id>")` when `shortcutEnabled`.
Title "Saved from Shortcut", body "₩12,000 · Food → Cash". The capture response is unchanged and a
notify failure never fails the capture.

### Endpoints (session auth: `deserializeUser` + `requireUser`)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/notifications?cursor=` | newest first, 30 per page; `{ notifications, nextCursor, unreadCount }` |
| POST | `/api/notifications/read` | `{ ids: string[] }` or `{ all: true }` |
| GET | `/api/notifications/settings` | defaults when no row |
| PUT | `/api/notifications/settings` | partial; `nudgeTime` HH:mm; `timezone` must be a valid IANA zone |
| GET | `/api/push/key` | `{ publicKey }`; 503 "Push isn't set up" when unset |
| POST | `/api/push/subscribe` | `{ endpoint, keys: { p256dh, auth } }`; upsert by endpoint, owned by the caller |
| DELETE | `/api/push/subscribe` | `{ endpoint }`; deletes only the caller's row |
| GET/POST | `/api/bills` | list / create |
| PATCH/DELETE | `/api/bills/:id` | owner only, else 404 |

Controllers pick fields explicitly (the `validate` middleware keeps unknown keys). Bill validation: name
1–60, amount > 0 and < 1e15, currency KRW|IDR, dayOfMonth 1–31, remindDaysBefore ∈ {0,1,3}, walletId and
categoryId (if given) must belong to the user (or be a global category) and the category must be EXPENSE.

### Config

`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` address) in `backend/.env`, mapped through
`config/custom-environment-variables.ts`. Generated once with `npx web-push generate-vapid-keys`.

## Client

### Push plumbing

- `vite.config.ts`: `workbox.importScripts: ['push-sw.js']`; `client/public/push-sw.js` handles
  `push` (show notification with title, body, app icon, badge, `data.url`) and `notificationclick`
  (focus an open window and navigate to `data.url`, else open one; only same-origin paths).
- `services/push.service.ts`: `isSupported()`, `status()` (`unsupported | needs-install | denied | off | on`),
  `subscribe()` (permission → `/api/push/key` → `pushManager.subscribe` → `POST /api/push/subscribe`),
  `unsubscribe()`. Logout calls `unsubscribe()` for this device.

### Notifications page (`/notifications`)

Follows `docs/design/stitch/notifications.png`, adapted:
- Reached from a bell in the Home header with a lime dot when `unreadCount > 0`; back arrow; not a nav tab.
- Header: "Notifications", "N unread", mark-all-read button, settings button → Profile notification section.
- Filter chips with counts: All · Reminders (NUDGE, BILL) · Activity (SHORTCUT_SAVED, MONTHLY_SUMMARY).
- Grouped Today / Yesterday / dates; cards with icon tile, title, unread dot, time, body, one action:
  - BILL → "Record payment" (`/?add=bill:<id>`)
  - NUDGE → "Add expense" (`/?add=new`)
  - SHORTCUT_SAVED → "View" (`/transactions?tx=<id>`)
  - MONTHLY_SUMMARY → "See month" (`/?month=<yyyy-mm>`)
- Opening a card or its action marks it read. Infinite scroll by cursor.
- Empty state "No notifications yet" (+ "Turn on push in Profile" when push is off).
- Not carried over from the mockup: budget, exchange-rate, salary, backup cards, Dismiss, preferences card.
- The unread count refreshes on app foreground and after the global sheet saves.

### Profile → Notifications section

- Push on this device: "Enable push" / on-off switch; `needs-install` → "Add to Home Screen to get push";
  `denied` → "Notifications are blocked — allow them in Settings → Finance".
- Daily reminder switch + `<input type="time">`; Shortcut saves switch; Monthly summary switch.
- On load the client sends its `Intl.DateTimeFormat().resolvedOptions().timeZone` if it differs.

### Bills (`/bills`, from Profile → "Bills")

- Cards: name, amount, "Every month on the 25th · remind 1 day before", wallet.
- Add / edit sheet: name, amount, currency, wallet, category (expense), day of month (1–31, hint "Short
  months use the last day"), remind (due day / 1 day before / 3 days before), active; delete via confirmation.

### Prefilled add

`/?add=bill:<id>` opens the global Add Transaction sheet prefilled with the bill's amount, wallet, category,
description = bill name, date = today; the user still taps Save. `/?add=new` opens it empty. The query
parameter is removed after opening.

## Testing

No real push service in any test (`web-push` mocked).
- Backend unit (`*.spec.ts`): `schedule.ts` (clamped due date, 0/1/3-day reminders incl. previous-month
  reminder, nudge time in timezone, summary on the 1st 09:00), `notify` dedupe and 410 cleanup.
- Integration (`*.int.ts`): bills CRUD + ownership + foreign wallet/category refused; notifications list,
  read, read-all; settings validation; subscribe/unsubscribe ownership; Shortcut capture creates a
  notification (AI mocked); one scheduler tick with a fixed clock; wallet with bills can't be deleted.
- Vitest: Notifications page (groups, filters, mark read, actions), bill form, Profile toggles and push
  states (push service stubbed), prefilled sheet from `?add=bill:`.
- Playwright: N1 list + mark all read (`GET /api/notifications` and `POST /api/notifications/read` mocked
  with `page.route`, like the assets scenarios; no test-only server endpoint),
  N2 create a bill then open `/?add=bill:<id>` and see it prefilled, N3 Profile settings persist.

## Deploy

- Migration is additive; applied by the service's `prisma migrate deploy` on start.
- Generate VAPID keys once, add the three variables to the VPS `backend/.env`.
- The scheduler starts with the backend; no new service.
