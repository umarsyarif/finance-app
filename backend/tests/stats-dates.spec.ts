process.env.TZ = 'Asia/Seoul';

import { parseRangeDate } from '../src/controllers/stats.controller';

describe('parseRangeDate', () => {
  it('treats a date-only start as local midnight, not UTC midnight', () => {
    expect(parseRangeDate('2026-10-01', false).toISOString()).toBe('2026-09-30T15:00:00.000Z');
  });

  it('treats a date-only end as the end of that local day', () => {
    expect(parseRangeDate('2026-10-31', true).toISOString()).toBe('2026-10-31T14:59:59.999Z');
  });

  it('keeps full timestamps unchanged', () => {
    expect(parseRangeDate('2026-10-01T02:00:00+09:00', false).toISOString()).toBe('2026-09-30T17:00:00.000Z');
  });
});
