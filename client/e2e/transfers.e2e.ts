// Scenarios TR1–TR5 (see SCENARIOS.md)
import { type Page } from '@playwright/test';
import { test, expect, signUp, seedWallet, seedCategory, seedTx, walletBalance, api, card, openAddSheet, row, thisMonth } from './helpers';

const sheet = (page: Page) => page.getByRole('dialog').first();

async function pickIn(page: Page, label: string, option: string) {
  await sheet(page).getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option }).click();
}

async function startTransfer(page: Page) {
  await openAddSheet(page);
  await sheet(page).getByRole('button', { name: 'Transfer', exact: true }).click();
}

test('TR1 KRW → IDR through the sheet', async ({ page }) => {
  await signUp(page, 'tr1');
  const krw = await seedWallet(page, 'KRW', 1_000_000, 'Won');
  const idr = await seedWallet(page, 'IDR', 0, 'Rupiah', false);
  const before = await api(page, 'get', `/api/stats/monthly-summary?walletIds=${krw}`);
  await page.goto('/');

  await startTransfer(page);
  await pickIn(page, 'From wallet', 'Won');
  await pickIn(page, 'To wallet', 'Rupiah');
  await sheet(page).getByLabel('Amount', { exact: true }).fill('100000');
  await sheet(page).getByLabel('Received (IDR)').fill('1150000');
  await expect(sheet(page).getByText('1 KRW = 11.5 IDR')).toBeVisible();
  await sheet(page).getByRole('button', { name: 'Save transfer' }).click();
  await expect(sheet(page)).toBeHidden();

  expect(await walletBalance(page, krw)).toBe(900_000);
  expect(await walletBalance(page, idr)).toBe(1_150_000);
  await page.goto('/transactions');
  await expect(row(page, 'Transfer to Rupiah')).toBeVisible();

  const after = await api(page, 'get', `/api/stats/monthly-summary?walletIds=${krw}`);
  expect(after.data).toMatchObject({ income: before.data.income, expense: before.data.expense });
});

test('TR2 same-currency transfer has one amount field', async ({ page }) => {
  await signUp(page, 'tr2');
  const bank = await seedWallet(page, 'KRW', 200_000, 'Bank');
  const cash = await seedWallet(page, 'KRW', 0, 'Cash', false);
  await page.goto('/');

  await startTransfer(page);
  await pickIn(page, 'From wallet', 'Bank');
  await pickIn(page, 'To wallet', 'Cash');
  await expect(sheet(page).getByLabel(/Received/)).toHaveCount(0);
  await sheet(page).getByLabel('Amount', { exact: true }).fill('50000');
  await sheet(page).getByRole('button', { name: 'Save transfer' }).click();
  await expect(sheet(page)).toBeHidden();

  expect(await walletBalance(page, bank)).toBe(150_000);
  expect(await walletBalance(page, cash)).toBe(50_000);
});

async function seedTransfer(page: Page) {
  const krw = await seedWallet(page, 'KRW', 1_000_000, 'Won');
  const idr = await seedWallet(page, 'IDR', 0, 'Rupiah', false);
  await api(page, 'post', '/api/transfers', {
    fromWalletId: krw, toWalletId: idr, amountSent: 100_000, amountReceived: 1_150_000, date: thisMonth(3),
  });
  return { krw, idr };
}

test('TR3 edit a transfer from the details sheet', async ({ page }) => {
  await signUp(page, 'tr3');
  const { krw, idr } = await seedTransfer(page);
  await page.goto('/transactions');

  await row(page, 'Transfer to Rupiah').click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await sheet(page).getByLabel('Amount', { exact: true }).fill('200000');
  await sheet(page).getByLabel('Received (IDR)').fill('2300000');
  await sheet(page).getByRole('button', { name: 'Save transfer' }).click();
  await expect(sheet(page)).toBeHidden();

  expect(await walletBalance(page, krw)).toBe(800_000);
  expect(await walletBalance(page, idr)).toBe(2_300_000);
});

test('TR4 delete a transfer from the details sheet', async ({ page }) => {
  await signUp(page, 'tr4');
  const { krw, idr } = await seedTransfer(page);
  await page.goto('/transactions');

  await row(page, 'Transfer to Rupiah').click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog', { name: 'Delete transfer?' }).getByRole('button', { name: 'Delete' }).click();

  await expect(row(page, 'Transfer to Rupiah')).toHaveCount(0);
  await card(page, 'Rupiah').scrollIntoViewIfNeeded();
  await expect(row(page, 'Transfer from Won')).toHaveCount(0);
  expect(await walletBalance(page, krw)).toBe(1_000_000);
  expect(await walletBalance(page, idr)).toBe(0);
});

test('TR5 income/expense chips hide transfers', async ({ page }) => {
  await signUp(page, 'tr5');
  const { krw } = await seedTransfer(page);
  const cat = await seedCategory(page, 'EXPENSE', 'Food');
  await seedTx(page, krw, cat, 'Lunch', thisMonth(4));
  await page.goto('/transactions');

  await expect(row(page, 'Transfer to Rupiah')).toBeVisible();
  await page.getByRole('radio', { name: /Expense/ }).click();
  await expect(row(page, 'Lunch')).toBeVisible();
  await expect(row(page, 'Transfer to Rupiah')).toHaveCount(0);
  await card(page, 'Rupiah').scrollIntoViewIfNeeded();
  await page.getByRole('radio', { name: /Income/ }).click();
  await expect(row(page, 'Transfer from Won')).toHaveCount(0);
  await page.getByRole('radio', { name: /All/ }).click();
  await expect(row(page, 'Transfer from Won')).toBeVisible();
});
