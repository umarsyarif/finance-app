import { describe, it, expect } from 'vitest';
import { toSlices } from '@/components/assets/distribution';

const h = (assetClass: string, symbol: string, value: number | null) => ({ assetClass, symbol, value });

describe('toSlices', () => {
  it('groups holdings under 3% into Other and sums to 100', () => {
    const slices = toSlices([h('GOLD', 'XAU', 600), h('CRYPTO', 'BTC', 370), h('CRYPTO', 'DOGE', 20), h('CRYPTO', 'XRP', 10), h('CRYPTO', 'NOPE', null)]);
    expect(slices.map((s) => s.name)).toEqual(['Gold', 'BTC', 'Other']);
    expect(slices.find((s) => s.name === 'Other')!.value).toBe(30);
    expect(Math.round(slices.reduce((s, x) => s + x.pct, 0))).toBe(100);
  });

  it('is empty when there is no value', () => {
    expect(toSlices([h('CRYPTO', 'NOPE', null)])).toEqual([]);
  });
});
