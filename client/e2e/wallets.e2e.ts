// Scenarios W1–W11 (see SCENARIOS.md)
import { type Page } from '@playwright/test';
import { test, expect, API, signUp, api, seedWallet, seedCategory, seedTx, walletBalance, card, thisMonth } from './helpers';

const editButton = (page: Page, text: string) => card(page, text).getByRole('button').first();
const deleteButton = (page: Page, text: string) => card(page, text).getByRole('button').nth(1);

async function confirmDelete(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
}

async function openCategories(page: Page) {
  await page.goto('/wallets');
  await page.getByRole('tab', { name: 'Categories' }).click();
}

test('W1 create an IDR wallet', async ({ page }) => {
  await signUp(page, 'w1');
  await page.goto('/wallets');
  await page.getByRole('button', { name: 'Add Wallet' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Wallet Name').fill('Travel');
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: 'IDR - Indonesian Rupiah' }).click();
  await dialog.getByLabel('Initial Balance').fill('250000');
  await dialog.getByRole('button', { name: 'Create Wallet' }).click();

  await expect(card(page, 'Travel')).toContainText('IDR');
  await expect(card(page, 'Travel')).toContainText('250,000');
});

test('W2 renaming a wallet keeps its balance', async ({ page }) => {
  await signUp(page, 'w2');
  const wallet = await seedWallet(page, 'KRW', 100000, 'Old Name');
  const cat = await seedCategory(page, 'EXPENSE');
  await seedTx(page, wallet, cat, 'spend', thisMonth(2), 1000);
  await page.goto('/wallets');

  await editButton(page, 'Old Name').click();
  await page.getByRole('dialog').getByLabel('Wallet Name').fill('New Name');
  await page.getByRole('dialog').getByRole('button', { name: 'Update Wallet' }).click();

  await expect(card(page, 'New Name')).toBeVisible();
  expect(await walletBalance(page, wallet)).toBe(99000);
});

test('W3 changing currency of a wallet with transactions is refused', async ({ page }) => {
  await signUp(page, 'w3');
  const wallet = await seedWallet(page, 'KRW', 0, 'Won');
  const cat = await seedCategory(page, 'EXPENSE');
  await seedTx(page, wallet, cat, 'spend', thisMonth(2));
  await page.goto('/wallets');

  await editButton(page, 'Won').click();
  await page.getByRole('dialog').getByRole('combobox').click();
  await page.getByRole('option', { name: 'IDR - Indonesian Rupiah' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Update Wallet' }).click();

  await expect(page.getByText(/Cannot change currency/)).toBeVisible();
  expect((await api(page, 'get', `/api/wallets/${wallet}`)).data.wallet.currency).toBe('KRW');
});

test('W4 delete an empty wallet', async ({ page }) => {
  await signUp(page, 'w4');
  await seedWallet(page, 'KRW', 0, 'Disposable');
  await page.goto('/wallets');

  await deleteButton(page, 'Disposable').click();
  await confirmDelete(page);

  await expect(card(page, 'Disposable')).toHaveCount(0);
});

test('W5 deleting a wallet with transactions explains why it failed', async ({ page }) => {
  await signUp(page, 'w5');
  const wallet = await seedWallet(page, 'KRW', 0, 'Busy');
  const cat = await seedCategory(page, 'EXPENSE');
  await seedTx(page, wallet, cat, 'spend', thisMonth(2));
  await page.goto('/wallets');

  await deleteButton(page, 'Busy').click();
  await confirmDelete(page);

  await expect(page.getByText(/Cannot delete wallet with 1 existing transaction/)).toBeVisible();
  await expect(card(page, 'Busy')).toBeVisible();
});

test('W6 create an income category', async ({ page }) => {
  await signUp(page, 'w6');
  await openCategories(page);
  await page.getByRole('button', { name: 'Add Category' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Category Name').fill('Bonus');
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Income' }).click();
  await dialog.getByRole('button', { name: 'Create Category' }).click();

  await expect(card(page, 'Bonus')).toContainText(/income/i);
});

test('W7 rename a category', async ({ page }) => {
  await signUp(page, 'w7');
  await seedCategory(page, 'EXPENSE', 'Groceries');
  await openCategories(page);

  await editButton(page, 'Groceries').click();
  await page.getByRole('dialog').getByLabel('Category Name').fill('Supermarket');
  await page.getByRole('dialog').getByRole('button', { name: 'Update Category' }).click();

  await expect(card(page, 'Supermarket')).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: 'Categories' }).click();
  await expect(card(page, 'Supermarket')).toBeVisible();
});

test('W8 flipping the type of a category in use is refused', async ({ page }) => {
  await signUp(page, 'w8');
  const wallet = await seedWallet(page);
  const cat = await seedCategory(page, 'EXPENSE', 'Rent');
  await seedTx(page, wallet, cat, 'rent', thisMonth(1));
  await openCategories(page);

  await editButton(page, 'Rent').click();
  await page.getByRole('dialog').getByRole('combobox').click();
  await page.getByRole('option', { name: 'Income' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Update Category' }).click();

  await expect(page.getByText(/Cannot change the type/)).toBeVisible();
});

test('W9 deleting a category in use is refused', async ({ page }) => {
  await signUp(page, 'w9');
  const wallet = await seedWallet(page);
  const cat = await seedCategory(page, 'EXPENSE', 'Utilities');
  await seedTx(page, wallet, cat, 'power', thisMonth(1));
  await openCategories(page);

  await deleteButton(page, 'Utilities').click();
  await confirmDelete(page);

  await expect(page.getByText(/Cannot delete category/)).toBeVisible();
  await expect(card(page, 'Utilities')).toBeVisible();
});

test('W10 delete an unused category', async ({ page }) => {
  await signUp(page, 'w10');
  const id = await seedCategory(page, 'EXPENSE', 'Unused');
  await openCategories(page);

  await deleteButton(page, 'Unused').click();
  await confirmDelete(page);

  await expect(card(page, 'Unused')).toHaveCount(0);
  expect((await page.request.get(`${API}/api/categories/${id}`)).status()).toBe(404);
});

test('W11 "Add Wallet" after editing a wallet starts with an empty form', async ({ page }) => {
  await signUp(page, 'w11');
  await seedWallet(page, 'KRW', 5000, 'Existing');
  await page.goto('/wallets');

  await editButton(page, 'Existing').click();
  await expect(page.getByRole('dialog').getByLabel('Wallet Name')).toHaveValue('Existing');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add Wallet' }).click();

  await expect(page.getByRole('dialog').getByLabel('Wallet Name')).toHaveValue('');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Create Wallet' })).toBeVisible();
});
