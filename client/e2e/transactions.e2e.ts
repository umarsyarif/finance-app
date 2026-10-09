// Scenarios T1–T8 (see SCENARIOS.md)
import { type Page } from '@playwright/test';
import { test, expect, signUp, seedWallet, seedCategory, seedTx, walletBalance, prevMonth, nextMonth, thisMonth } from './helpers';

const monthLabel = (offset: number) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

async function setup(page: Page, tag: string) {
  await signUp(page, tag);
  const wallet = await seedWallet(page, 'KRW', 100000, 'Daily');
  const food = await seedCategory(page, 'EXPENSE', 'Food');
  const refund = await seedCategory(page, 'INCOME', 'Refund');
  const tx = await seedTx(page, wallet, food, 'Lunch', thisMonth(3, 13), 12000);
  await page.goto('/transactions');
  return { wallet, food, refund, tx };
}

const details = (page: Page) => page.getByRole('dialog', { name: 'Transaction Details' });
const row = (page: Page, text: string) => page.locator('#root').getByText(text, { exact: true });

test('T1 details modal shows amount, description, category, wallet and local time', async ({ page }) => {
  await setup(page, 't1');
  await row(page, 'Lunch').click();

  const modal = details(page);
  await expect(modal.getByText('-₩12,000')).toBeVisible();
  await expect(modal.getByText('Lunch')).toBeVisible();
  await expect(modal.getByText('Food')).toBeVisible();
  await expect(modal.getByText('Daily')).toBeVisible();
  await expect(modal.getByText(/13[.:]00/)).toBeVisible();
});

test('T2 details modal contains no placeholder text', async ({ page }) => {
  await setup(page, 't2');
  await row(page, 'Lunch').click();

  await expect(details(page)).not.toContainText('메모');
  await expect(details(page)).not.toContainText('확인');
});

test('T3 edit amount and description updates list and balance', async ({ page }) => {
  const { wallet } = await setup(page, 't3');
  await row(page, 'Lunch').click();
  await details(page).getByRole('button', { name: 'Edit' }).click();

  const sheet = page.getByRole('dialog', { name: 'Edit Transaction' });
  await sheet.getByPlaceholder('Enter description').fill('Dinner');
  await sheet.getByPlaceholder('0.00').fill('15000');
  await sheet.getByRole('button', { name: 'Update Transaction' }).click();

  await expect(row(page, 'Dinner')).toBeVisible();
  await expect(row(page, 'Lunch')).toBeHidden();
  await expect(page.getByText('Lunch', { exact: true })).toHaveCount(0); // no stale details modal
  expect(await walletBalance(page, wallet)).toBe(85000);
});

test('T4 switching to an income category moves the balance', async ({ page }) => {
  const { wallet } = await setup(page, 't4');
  await row(page, 'Lunch').click();
  await details(page).getByRole('button', { name: 'Edit' }).click();

  const sheet = page.getByRole('dialog', { name: 'Edit Transaction' });
  await sheet.getByRole('combobox', { name: 'Category' }).click();
  await page.getByRole('option', { name: 'Refund' }).click();
  await sheet.getByRole('button', { name: 'Update Transaction' }).click();

  await expect(page.getByText('+₩12,000')).toBeVisible();
  expect(await walletBalance(page, wallet)).toBe(112000);
});

test('T5 delete with confirmation removes the row and restores the balance', async ({ page }) => {
  const { wallet } = await setup(page, 't5');
  await row(page, 'Lunch').click();
  await details(page).getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog', { name: 'Delete Transaction' }).getByRole('button', { name: 'Delete' }).click();

  await expect(row(page, 'Lunch')).toBeHidden();
  await expect(page.getByText('No transactions for this month')).toBeVisible();
  await expect(details(page)).toBeHidden(); // no popup left showing the deleted transaction
  expect(await walletBalance(page, wallet)).toBe(100000);
});

test('T6 cancelling delete keeps the row', async ({ page }) => {
  const { wallet } = await setup(page, 't6');
  await row(page, 'Lunch').click();
  await details(page).getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog', { name: 'Delete Transaction' }).getByRole('button', { name: 'Cancel' }).click();

  await expect(row(page, 'Lunch')).toBeVisible();
  expect(await walletBalance(page, wallet)).toBe(88000);
});

test('T7 month navigation shows labels and empty states', async ({ page }) => {
  await setup(page, 't7');
  await expect(page.getByText(monthLabel(0))).toBeVisible();

  await prevMonth(page);
  await expect(page.getByText(monthLabel(-1))).toBeVisible();
  await expect(page.getByText('No transactions for this month')).toBeVisible();

  await nextMonth(page);
  await nextMonth(page);
  await expect(page.getByText(monthLabel(1))).toBeVisible();
  await expect(page.getByText('No transactions for this month')).toBeVisible();
});

test('T8 each month lists only its own transactions', async ({ page }) => {
  const { wallet, food } = await setup(page, 't8');
  const now = new Date();
  await seedTx(page, wallet, food, 'last-month-row', new Date(now.getFullYear(), now.getMonth() - 1, 15, 12).toISOString());
  await page.reload();

  await expect(row(page, 'Lunch')).toBeVisible();
  await expect(row(page, 'last-month-row')).toBeHidden();
  await prevMonth(page);
  await expect(row(page, 'last-month-row')).toBeVisible();
  await expect(row(page, 'Lunch')).toBeHidden();
});
