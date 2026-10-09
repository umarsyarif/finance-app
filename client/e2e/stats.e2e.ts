// Scenarios S1–S7 (see SCENARIOS.md)
import { type Page } from '@playwright/test';
import { test, expect, signUp, seedWallet, seedCategory, seedTx, card, thisMonth } from './helpers';

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
  await expect(page.getByText('Monthly Summary')).toBeVisible();
  return { wallet };
}

const summary = (page: Page, title: string) => card(page, title).filter({ has: page.getByText(title, { exact: true }) });

test('S1 monthly summary matches the month\'s transactions', async ({ page }) => {
  await setup(page, 's1');
  await expect(summary(page, 'Total Income')).toContainText('₩3,000,000');
  await expect(summary(page, 'Total Expenses')).toContainText('₩70,000');
  await expect(summary(page, 'Net Balance')).toContainText('₩2,930,000');
});

test('S2 category breakdown lists expense categories with amounts', async ({ page }) => {
  await setup(page, 's2');
  const breakdown = card(page, 'Category Breakdown');
  await expect(breakdown).toContainText('Food');
  await expect(breakdown).toContainText('₩50,000');
  await expect(breakdown).toContainText('Transport');
  await expect(breakdown).toContainText('₩20,000');
  await expect(breakdown).not.toContainText('Salary');
});

test('S3 custom date range only counts transactions inside it', async ({ page }) => {
  await setup(page, 's3');
  await page.getByRole('button', { name: 'Show Filters' }).click();
  const filters = card(page, 'Apply Filters');
  await filters.getByRole('button').nth(0).click();
  await pickDayInOpenCalendar(page, 3);
  await filters.getByRole('button').nth(1).click();
  await pickDayInOpenCalendar(page, 3);
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect(summary(page, 'Total Income')).toContainText('₩0');
  await expect(summary(page, 'Total Expenses')).toContainText('₩50,000');
});

async function pickDayInOpenCalendar(page: Page, day: number) {
  const grid = page.getByRole('grid').last();
  await grid.getByRole('button', { name: new RegExp(`\\b${day}(st|nd|rd|th)?\\b`) }).filter({ hasNotText: /\d{2}/ }).first().click();
}

test('S4 filtering to another wallet follows its totals and currency', async ({ page }) => {
  await setup(page, 's4');
  const idr = await seedWallet(page, 'IDR', 0, 'Rupiah', false);
  const food = await seedCategory(page, 'EXPENSE', 'Makan');
  await seedTx(page, idr, food, 'nasi', thisMonth(4), 25000);
  await page.reload();

  await page.getByRole('button', { name: 'Show Filters' }).click();
  await page.getByText('Main KRW').first().click(); // open the wallet multi-select
  await page.getByRole('option', { name: /Main KRW/ }).click(); // only one currency at a time
  await page.getByRole('option', { name: /Rupiah/ }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Apply Filters' }).click();

  await expect(summary(page, 'Total Expenses')).toContainText('25,000');
  await expect(summary(page, 'Total Expenses')).not.toContainText('₩');
});

test('S5 clear filters returns to this month and the main wallet', async ({ page }) => {
  await setup(page, 's5');
  await page.getByRole('button', { name: 'Show Filters' }).click();
  const filters = card(page, 'Apply Filters');
  await filters.getByRole('button').nth(0).click();
  await pickDayInOpenCalendar(page, 3);
  await filters.getByRole('button').nth(1).click();
  await pickDayInOpenCalendar(page, 3);
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await expect(summary(page, 'Total Income')).toContainText('₩0');

  await page.getByRole('button', { name: 'Clear Filters' }).click();

  await expect(summary(page, 'Total Income')).toContainText('₩3,000,000');
});

test('S6 switching the trend chart between bar and line', async ({ page }) => {
  await setup(page, 's6');
  const trends = card(page, 'Financial Trends');
  await trends.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Line' }).click();
  await expect(trends.locator('.recharts-line').first()).toBeVisible();

  await trends.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Bar' }).click();
  await expect(trends.locator('.recharts-bar').first()).toBeVisible();
});

test('S7 a user with no transactions sees zeroes, not an error', async ({ page }) => {
  await signUp(page, 's7');
  await page.goto('/stats');
  await expect(page.getByText('Monthly Summary')).toBeVisible();
  await expect(summary(page, 'Total Income')).toContainText('0');
  await expect(page.getByText(/^Error:/)).toHaveCount(0);
});

