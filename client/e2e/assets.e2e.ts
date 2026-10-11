// Scenarios AS1–AS5 (see SCENARIOS.md). GET /api/assets and the Binance PUT are mocked: the real ones call the internet.
import type { Page, Request } from '@playwright/test';
import { test, expect, signUp, seedWallet } from './helpers';

type H = { assetClass: string; symbol: string; quantity: number; unit: string | null; value: number | null; cost: number | null; gain: number | null; gainPct: number | null; source: string };
const gold = (grams: number, value: number): H => ({ assetClass: 'GOLD', symbol: 'XAU', quantity: grams, unit: 'g', value, cost: null, gain: null, gainPct: null, source: 'manual' });
const btc: H = { assetClass: 'CRYPTO', symbol: 'BTC', quantity: 0.5, unit: null, value: 3000000, cost: null, gain: null, gainPct: null, source: 'binance' };
const portfolio = (currency: string, holdings: H[], connected = false) => ({
  currency,
  total: { value: holdings.reduce((s, h) => s + (h.value ?? 0), 0), cost: null, gain: null, gainPct: null },
  holdings,
  sources: { binance: { connected, lastSyncedAt: connected ? new Date().toISOString() : null, error: null } },
  stale: false,
});

// Serves the current `state.body` for GET /api/assets only (not /api/assets/lots...) and records each request
async function mockPortfolio(page: Page, state: { body: (currency: string) => unknown }) {
  const gets: Request[] = [];
  await page.route((url) => url.pathname === '/api/assets', (route) => {
    gets.push(route.request());
    const currency = new URL(route.request().url()).searchParams.get('currency') ?? 'KRW';
    return route.fulfill({ json: { status: 'success', data: state.body(currency) } });
  });
  return gets;
}

test('AS1 nav shows Assets; Profile opens Wallets & categories', async ({ page }) => {
  await signUp(page, 'as1');
  await mockPortfolio(page, { body: (c) => portfolio(c, []) });
  await seedWallet(page, 'KRW', 1000, 'Bank');
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const l of ['Home', 'Transactions', 'Assets', 'Profile']) await expect(nav.getByRole('link', { name: l })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Wallets' })).toHaveCount(0);
  await page.goto('/profile');
  await page.getByRole('button', { name: /Wallets & categories/ }).click();
  await expect(page).toHaveURL(/\/wallets$/);
  await expect(page.getByLabel('Bank', { exact: true })).toBeVisible();
});

test('AS2 add two purchases, sell one gram, delete a lot', async ({ page }) => {
  await signUp(page, 'as2');
  const state = { body: (c: string) => portfolio(c, []) };
  const gets = await mockPortfolio(page, state);
  const posts: Record<string, unknown>[] = [];
  page.on('request', (r) => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/assets/lots') posts.push(r.postDataJSON()); });

  await page.goto('/assets');
  const card = page.getByRole('region', { name: 'Gold' });
  await expect(card).toContainText('No gold yet');

  const add = async (side: 'Buy' | 'Sell', grams: string, total: string, mockGrams: number, mockValue: number) => {
    await card.getByRole('button', { name: 'Add purchase' }).click();
    const sheet = page.getByRole('dialog', { name: 'Add purchase' });
    await sheet.getByRole('radio', { name: side, exact: true }).click();
    await sheet.getByLabel('Grams').fill(grams);
    await sheet.getByLabel(side === 'Sell' ? 'Total received' : 'Total paid').fill(total);
    state.body = (c) => portfolio(c, [gold(mockGrams, mockValue)]);
    await sheet.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(sheet).toBeHidden();
  };
  await add('Buy', '5', '500000', 5, 600000);
  await add('Buy', '5', '510000', 10, 1200000);
  await add('Sell', '1', '125000', 9, 1080000);

  expect(posts.map((p) => [p.assetClass, p.symbol, p.quantity, p.totalPaid, p.currency])).toEqual([
    ['GOLD', 'XAU', 5, 500000, 'KRW'],
    ['GOLD', 'XAU', 5, 510000, 'KRW'],
    ['GOLD', 'XAU', -1, -125000, 'KRW'],
  ]);
  await expect(card).toContainText('9 g');
  await expect(card).toContainText('1,080,000');

  await card.getByRole('button', { name: /Gold/ }).first().click();
  const list = page.getByRole('dialog', { name: 'Purchases' });
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await expect(list).toContainText('−1 g');
  expect(await list.getByRole('button', { name: 'Delete' }).count()).toBe(3);

  const before = gets.length;
  state.body = (c) => portfolio(c, [gold(8, 960000)]);
  await list.getByRole('button', { name: 'Delete' }).first().click();
  await page.getByRole('dialog').filter({ hasText: 'Delete entry' }).getByRole('button', { name: 'Delete' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect.poll(() => gets.length).toBeGreaterThan(before);
  await page.keyboard.press('Escape');
  await expect(card).toContainText('8 g');
});

test('AS3 Gold and BTC in the cards and the legend', async ({ page }) => {
  await signUp(page, 'as3');
  await mockPortfolio(page, { body: (c) => portfolio(c, [gold(10, 1000000), btc], true) });
  await page.goto('/assets');
  const crypto = page.getByRole('region', { name: 'Crypto' });
  await expect(crypto).toContainText('BTC');
  await expect(crypto).toContainText('3,000,000');
  const legend = page.getByRole('region', { name: 'Distribution' });
  await expect(legend).toContainText('Gold');
  await expect(legend).toContainText('25%');
  await expect(legend).toContainText('BTC');
  await expect(legend).toContainText('75%');
});

test('AS4 toggling KRW to IDR requests IDR and shows Rp', async ({ page }) => {
  await signUp(page, 'as4');
  await seedWallet(page, 'KRW', 1000, 'Won');
  await seedWallet(page, 'IDR', 1000, 'Jago');
  const gets = await mockPortfolio(page, { body: (c) => portfolio(c, [gold(10, c === 'IDR' ? 15000000 : 1000000)]) });
  await page.goto('/assets');
  await expect(page.getByRole('region', { name: 'Total assets' })).toContainText('1,000,000');
  await page.getByRole('radio', { name: 'IDR' }).click();
  await expect.poll(() => gets.some((r) => new URL(r.url()).searchParams.get('currency') === 'IDR')).toBe(true);
  await expect(page.getByRole('region', { name: 'Total assets' })).toContainText('Rp');
  await expect(page.getByRole('region', { name: 'Total assets' })).toContainText('15,000,000');
});

test('AS5 connect sheet shows instructions and a rejected key clears the secret', async ({ page }) => {
  await signUp(page, 'as5');
  await mockPortfolio(page, { body: (c) => portfolio(c, []) });
  await page.route((url) => url.pathname === '/api/assets/sources/binance', (route) =>
    route.fulfill({ status: 400, json: { status: 'fail', message: 'Use a read-only key: turn off trading, withdrawals and transfers' } }));
  await page.goto('/assets');
  await page.getByRole('button', { name: 'Connect Binance' }).click();
  const sheet = page.getByRole('dialog', { name: 'Connect Binance' });
  await expect(sheet).toContainText('Enable Reading');
  await expect(sheet).toContainText('43.155.186.108');
  await sheet.getByLabel('API key').fill('somekey');
  await sheet.getByLabel('API secret').fill('somesecret');
  await sheet.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(sheet.getByRole('alert')).toHaveText('Use a read-only key: turn off trading, withdrawals and transfers');
  await expect(sheet.getByLabel('API secret')).toHaveValue('');
  await expect(sheet.getByLabel('API key')).toHaveValue('somekey');
});
