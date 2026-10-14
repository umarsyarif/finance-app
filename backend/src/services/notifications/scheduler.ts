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
  if (local.hour < 9) return;
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
  if (await prisma.notification.findFirst({ where: { userId, dedupeKey: `summary:${ym}` }, select: { id: true } })) return;
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
// onlyUserIds (tests) narrows the visit (still only scheduled users) and the retention sweep to those users
export async function runTick(now = new Date(), onlyUserIds?: string[]) {
  // Retention uses the real clock, never the tick's (a test clock must not wipe real rows)
  if (Date.now() - lastCleanup > 86_400_000) {
    lastCleanup = Date.now();
    await prisma.notification.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86_400_000) }, ...(onlyUserIds ? { userId: { in: onlyUserIds } } : {}) } });
  }
  for (const userId of (await scheduledUserIds()).filter((id) => !onlyUserIds || onlyUserIds.includes(id))) {
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

export const resetSchedulerState = () => { lastCleanup = 0; };
