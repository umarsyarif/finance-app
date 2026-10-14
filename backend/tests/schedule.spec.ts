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
