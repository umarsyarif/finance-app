// Scenarios S1–S7 (see SCENARIOS.md)
import { type Page } from '@playwright/test';
import { test, expect, signUp, seedWallet, seedCategory, seedTx, thisMonth, prevMonth, openAddSheet, fillTransaction, saveButton } from './helpers';

async function setup(page: Page, tag: string) {
  await signUp(page, tag);
  const wallet = await seedWallet(page, 'KRW', 100000, 'Main KRW');
  const salary = await seedCategory(page, 'INCOME', 'Salary');
  const food = await seedCategory(page, 'EXPENSE', 'Food');
  const transport = await seedCategory(page, 'EXPENSE', 'Transport');
  await seedTx(page, wallet, salary, 'pay', thisMonth(2), 3000000);
  await seedTx(page, wallet, food, 'lunch', thisMonth(3), 50000);
  await seedTx(page, wallet, transport, 'bus', thisMonth(5), 20000);
  await page.goto('/stats');
  await expect(summary(page)).toBeVisible();
  return { wallet };
}

const summary = (page: Page) => page.getByRole('region', { name: 'Monthly summary' });
const breakdown = (page: Page) => page.locator('section', { has: page.getByRole('heading', { name: 'Where it went' }) });

test('S1 monthly summary matches the month\'s transactions', async ({ page }) => {
  await setup(page, 's1');
  await expect(summary(page)).toContainText('₩2,930,000');
  await expect(summary(page)).toContainText('+₩3,000,000');
  await expect(summary(page)).toContainText('-₩70,000');
});

test('S2 breakdown lists expense categories with amounts and shares', async ({ page }) => {
  await setup(page, 's2');
  await expect(breakdown(page)).toContainText('Food');
  await expect(breakdown(page)).toContainText('-₩50,000');
  await expect(breakdown(page)).toContainText('71% of spending');
  await expect(breakdown(page)).toContainText('Transport');
  await expect(breakdown(page)).not.toContainText('Salary');
});

test('S3 the previous month has its own (empty) numbers', async ({ page }) => {
  await setup(page, 's3');
  await prevMonth(page);
  await expect(summary(page)).toContainText('₩0');
  await expect(page.getByText('No expenses this month.')).toBeVisible();
});

test('S4 the wallet picker switches totals and currency', async ({ page }) => {
  await setup(page, 's4');
  const idr = await seedWallet(page, 'IDR', 0, 'Rupiah', false);
  const makan = await seedCategory(page, 'EXPENSE', 'Makan');
  await seedTx(page, idr, makan, 'nasi', thisMonth(4), 25000);
  await page.reload();

  await page.getByRole('combobox', { name: 'Wallet' }).click();
  await page.getByRole('option', { name: /Rupiah/ }).click();

  await expect(summary(page)).toContainText('-Rp 25,000');
  await expect(summary(page)).not.toContainText('₩');
});

test('S5 the yearly chart draws income and expense bars', async ({ page }) => {
  await setup(page, 's5');
  await expect(page.getByRole('heading', { name: `${new Date().getFullYear()} by month` })).toBeVisible();
  // Bars for months without data have zero height; this month has both an income and an expense bar
  await expect.poll(() => page.locator('.recharts-bar-rectangle path').evaluateAll(
    (paths) => paths.filter((p) => p.getBoundingClientRect().height > 0).length
  )).toBeGreaterThanOrEqual(2);
});

test('S6 adding a transaction from the + sheet updates the stats', async ({ page }) => {
  await setup(page, 's6');
  const sheet = await openAddSheet(page);
  await fillTransaction(sheet, { description: 'taxi', amount: '30000', category: 'Transport' });
  await saveButton(sheet).click();

  await expect(summary(page)).toContainText('-₩100,000');
});

test('S7 a user with no transactions sees zeroes, not an error', async ({ page }) => {
  await signUp(page, 's7');
  await page.goto('/stats');
  await expect(summary(page)).toContainText('₩0');
  await expect(page.getByText('No expenses this month.')).toBeVisible();
});
