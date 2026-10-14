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
