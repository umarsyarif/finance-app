// Scenarios H1–H12 (see SCENARIOS.md)
import { type Page } from '@playwright/test';
import { test, expect, signUp, seedWallet, seedCategory, seedTx, thisMonth, prevMonth, card, row, openAddSheet, fillTransaction, saveButton } from './helpers';

const total = (page: Page) => page.getByRole('region', { name: 'Total' });
const summary = (page: Page) => page.locator('section', { has: page.getByRole('heading', { name: 'Summary' }) });
const latest = (page: Page) => page.locator('section', { has: page.getByRole('heading', { name: 'Latest' }) });
const currencyGroup = (page: Page) => page.getByRole('radiogroup', { name: 'Currency' });

// KRW user with a month of data: income 3,000,000, expenses 50,000 + 20,000
async function setup(page: Page, tag: string) {
  await signUp(page, tag);
  const wallet = await seedWallet(page, 'KRW', 100000, 'Main KRW');
  const salary = await seedCategory(page, 'INCOME', 'Salary');
  const food = await seedCategory(page, 'EXPENSE', 'Food');
  const transport = await seedCategory(page, 'EXPENSE', 'Transport');
  await seedTx(page, wallet, salary, 'pay', thisMonth(2), 3000000);
  await seedTx(page, wallet, food, 'lunch', thisMonth(3), 50000);
  await seedTx(page, wallet, transport, 'bus', thisMonth(5), 20000);
  await page.goto('/');
  await expect(summary(page)).toBeVisible();
  return { wallet };
}

// A KRW wallet and an IDR wallet, each with one expense this month
async function setupTwoCurrencies(page: Page, tag: string) {
  await signUp(page, tag);
  const krw = await seedWallet(page, 'KRW', 1001000, 'Won');
  const idr = await seedWallet(page, 'IDR', 525000, 'Rupiah', false);
  const cat = await seedCategory(page, 'EXPENSE', 'Food');
  await seedTx(page, krw, cat, 'krw-row', thisMonth(2), 1000);
  await seedTx(page, idr, cat, 'idr-row', thisMonth(2), 25000);
  await page.goto('/');
  await expect(total(page)).toBeVisible();
  return { krw, idr };
}

test('H1 toggling the currency switches total, cards, Latest and Summary', async ({ page }) => {
  await setupTwoCurrencies(page, 'h1');
  await expect(total(page)).toContainText('₩1,000,000');
  await expect(card(page, 'Won')).toBeVisible();
  await expect(row(page, 'krw-row')).toBeVisible();

  await currencyGroup(page).getByRole('radio', { name: 'IDR' }).click();

  await expect(total(page)).toContainText(/Rp\s500,000/);
  await expect(card(page, 'Rupiah')).toBeVisible();
  await expect(card(page, 'Won')).toHaveCount(0);
  await expect(row(page, 'idr-row')).toBeVisible();
  await expect(latest(page)).not.toContainText('krw-row');
  await expect(summary(page)).toContainText(/-Rp\s25,000/);
  await expect(summary(page)).not.toContainText('₩');
});

test('H2 tapping a Home card opens that wallet on Transactions', async ({ page }) => {
  await signUp(page, 'h2');
  const alpha = await seedWallet(page, 'KRW', 1000, 'Alpha');
  const beta = await seedWallet(page, 'KRW', 2000, 'Beta', false);
  const cat = await seedCategory(page, 'EXPENSE');
  await seedTx(page, alpha, cat, 'alpha-row', thisMonth(2));
  await seedTx(page, beta, cat, 'beta-row', thisMonth(2));
  await page.goto('/');

  await card(page, 'Beta').click();

  await expect(page).toHaveURL(/\/transactions$/);
  await expect(row(page, 'beta-row')).toBeVisible();
  await expect(row(page, 'alpha-row')).toBeHidden();
});

test('H3 swiping the Transactions cards switches the list', async ({ page }) => {
  await signUp(page, 'h3');
  const alpha = await seedWallet(page, 'KRW', 1000, 'Alpha');
  const beta = await seedWallet(page, 'KRW', 2000, 'Beta', false);
  const cat = await seedCategory(page, 'EXPENSE');
  await seedTx(page, alpha, cat, 'alpha-row', thisMonth(2));
  await seedTx(page, beta, cat, 'beta-row', thisMonth(2));
  await page.goto('/transactions');
  await expect(row(page, 'alpha-row')).toBeVisible();

  await card(page, 'Beta').scrollIntoViewIfNeeded();

  await expect(row(page, 'beta-row')).toBeVisible();
  await expect(row(page, 'alpha-row')).toBeHidden();
});

test('H4 the Home month switcher drives only the Summary', async ({ page }) => {
  await setup(page, 'h4');
  const prev = new Date();
  prev.setMonth(prev.getMonth() - 1, 1);
  await expect(total(page)).toContainText('₩');
  const before = await total(page).innerText();

  await prevMonth(page);

  await expect(summary(page)).toContainText(`No transactions in ${prev.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
  expect(await total(page).innerText()).toBe(before);
  await expect(row(page, 'lunch')).toBeVisible();
});

test('H5 /stats redirects to Home', async ({ page }) => {
  await setup(page, 'h5');
  await page.goto('/stats');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Summary' })).toBeVisible();
});

test('H6 the chosen wallet survives a reload of Transactions', async ({ page }) => {
  const { idr } = await setupTwoCurrencies(page, 'h6');
  expect(idr).toBeTruthy();
  await currencyGroup(page).getByRole('radio', { name: 'IDR' }).click();
  await card(page, 'Rupiah').click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(row(page, 'idr-row')).toBeVisible();

  await page.reload();

  await expect(row(page, 'idr-row')).toBeVisible();
  await expect(row(page, 'krw-row')).toBeHidden();
});

test('H7 no Currency toggle with a single currency', async ({ page }) => {
  await setup(page, 'h7');
  await expect(currencyGroup(page)).toHaveCount(0);
});

test('H8 income is listed under the Summary income bars', async ({ page }) => {
  await setup(page, 'h8');
  const income = summary(page).locator('div', { has: page.getByRole('heading', { name: 'Income', level: 3 }) }).last();
  await expect(income).toContainText('Salary');
  await expect(income).toContainText('+₩3,000,000');
});

test('H9 summary numbers match the month\'s transactions', async ({ page }) => {
  await setup(page, 'h9');
  await expect(summary(page)).toContainText('₩2,930,000');
  await expect(summary(page)).toContainText('+₩3,000,000');
  await expect(summary(page)).toContainText('-₩70,000');
  await expect(summary(page)).toContainText('71% of spending');
});

test('H10 the yearly chart draws income and expense bars', async ({ page }) => {
  await setup(page, 'h10');
  await expect(page.getByRole('heading', { name: `${new Date().getFullYear()} by month` })).toBeVisible();
  // Bars for months without data have zero height; this month has both an income and an expense bar
  await expect.poll(() => page.locator('.recharts-bar-rectangle path').evaluateAll(
    (paths) => paths.filter((p) => p.getBoundingClientRect().height > 0).length
  )).toBeGreaterThanOrEqual(2);
});

test('H11 adding from the + sheet updates the Summary without a reload', async ({ page }) => {
  await setup(page, 'h11');
  const sheet = await openAddSheet(page);
  await fillTransaction(sheet, { description: 'taxi', amount: '30000', category: 'Transport' });
  await saveButton(sheet).click();

  await expect(summary(page)).toContainText('-₩100,000');
  await expect(row(page, 'taxi')).toBeVisible();
});

test('H12 a user with no transactions sees the empty state and zeroes', async ({ page }) => {
  await signUp(page, 'h12');
  await seedWallet(page, 'KRW', 0);
  await page.goto('/');
  await expect(page.getByText('No transactions yet. Tap + to add one.')).toBeVisible();
  await expect(summary(page)).toContainText('₩0');
  await expect(summary(page)).toContainText('No transactions in');
});
