process.env.TZ = 'Asia/Seoul';

import { buildPrompt, parseExtraction, AiUnavailableError } from '../src/services/ai.service';

const ctx = {
  wallets: [{ id: 'w1', name: 'KRW Main', currency: 'KRW', isMain: true }],
  categories: [{ id: 'c1', name: 'Food', type: 'EXPENSE' as const }],
  now: new Date('2026-10-10T03:00:00.000Z'),
  timeZone: 'Asia/Seoul',
};

describe('buildPrompt', () => {
  it('lists wallets, categories and the local time', () => {
    const prompt = buildPrompt(ctx);
    expect(prompt).toContain('KRW Main (KRW, main)');
    expect(prompt).toContain('Food (EXPENSE)');
    expect(prompt).toContain('2026-10-10 12:00:00');
    expect(prompt).toContain('Asia/Seoul');
  });
});

describe('parseExtraction', () => {
  const valid = {
    found: true, type: 'EXPENSE', amount: 6500, currency: 'KRW', description: 'Starbucks',
    date: '2026-10-10T08:15:00', categoryName: 'Food', walletName: null,
  };

  it('accepts the expected JSON', () => {
    expect(parseExtraction(JSON.stringify(valid))).toEqual(valid);
  });

  it('rejects empty, non-JSON or wrongly shaped replies as AI unavailable', () => {
    expect(() => parseExtraction(undefined)).toThrow(AiUnavailableError);
    expect(() => parseExtraction('not json')).toThrow(AiUnavailableError);
    expect(() => parseExtraction(JSON.stringify({ ...valid, type: 'TRANSFER' }))).toThrow(AiUnavailableError);
  });
});
