import { describe, it, expect } from 'vitest';
import { resolveWalletId, currenciesOf, resolveCurrency } from '@/lib/selection';

const krwMain = { id: 'k1', currency: 'KRW', isMain: true };
const krw2 = { id: 'k2', currency: 'KRW', isMain: false };
const idr = { id: 'i1', currency: 'IDR', isMain: false };

describe('resolveWalletId', () => {
  it('keeps a stored wallet that still exists', () => {
    expect(resolveWalletId([krwMain, krw2, idr], 'i1')).toBe('i1');
  });
  it('falls back to the main wallet when the stored one is gone', () => {
    expect(resolveWalletId([krw2, krwMain], 'deleted')).toBe('k1');
  });
  it('falls back to the first wallet when none is main', () => {
    expect(resolveWalletId([krw2, idr], undefined)).toBe('k2');
  });
  it('is undefined with no wallets', () => {
    expect(resolveWalletId([], 'k1')).toBeUndefined();
  });
});

describe('currenciesOf', () => {
  it('lists KRW before IDR without duplicates', () => {
    expect(currenciesOf([idr, krw2, krwMain])).toEqual(['KRW', 'IDR']);
  });
  it('lists a single currency alone', () => {
    expect(currenciesOf([krw2, krwMain])).toEqual(['KRW']);
  });
});

describe('resolveCurrency', () => {
  it('keeps a stored currency the user still has', () => {
    expect(resolveCurrency([krwMain, idr], 'IDR')).toBe('IDR');
  });
  it("defaults to the main wallet's currency", () => {
    expect(resolveCurrency([idr, { ...krw2, isMain: true }], undefined)).toBe('KRW');
    expect(resolveCurrency([krwMain], 'IDR')).toBe('KRW');
  });
});
