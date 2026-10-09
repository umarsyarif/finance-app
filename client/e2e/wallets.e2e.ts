// Scenarios W1–W11 (see SCENARIOS.md)
import { type Page } from '@playwright/test';
import { test, expect, API, signUp, api, seedWallet, seedCategory, seedTx, walletBalance, card, thisMonth } from './helpers';

const sheet = (page: Page) => page.getByRole('dialog');

async function confirmDelete(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
}

async function openCategories(page: Page) {
  await page.goto('/wallets');
  await page.getByRole('radio', { name: /Categories/ }).click();
}

async function pickOption(page: Page, name: string) {
  await sheet(page).getByRole('combobox').click();
  await page.getByRole('option', { name }).click();
}

test('W1 create an IDR wallet', async ({ page }) => {
  await signUp(page, 'w1');
  await page.goto('/wallets');
  await page.getByRole('button', { name: 'Add wallet' }).click();

  await sheet(page).getByLabel('Wallet Name').fill('Travel');
  await pickOption(page, 'IDR - Indonesian Rupiah');
  await sheet(page).getByLabel('Starting balance').fill('250000');
  await sheet(page).getByRole('button', { name: 'Create wallet' }).click();

  await expect(card(page, 'Travel')).toContainText('IDR');
  await expect(card(page, 'Travel')).toContainText('Rp 250,000');
});

test('W2 renaming a wallet keeps its balance', async ({ page }) => {
  await signUp(page, 'w2');
  const wallet = await seedWallet(page, 'KRW', 100000, 'Old Name');
  const cat = await seedCategory(page, 'EXPENSE');
  await seedTx(page, wallet, cat, 'spend', thisMonth(2), 1000);
  await page.goto('/wallets');

  await page.getByRole('button', { name: 'Edit Old Name' }).click();
  await sheet(page).getByLabel('Wallet Name').fill('New Name');
  await sheet(page).getByRole('button', { name: 'Save changes' }).click();

  await expect(card(page, 'New Name')).toBeVisible();
  expect(await walletBalance(page, wallet)).toBe(99000);
});

test('W3 changing currency of a wallet with transactions is refused', async ({ page }) => {
  await signUp(page, 'w3');
  const wallet = await seedWallet(page, 'KRW', 0, 'Won');
  const cat = await seedCategory(page, 'EXPENSE');
  await seedTx(page, wallet, cat, 'spend', thisMonth(2));
  await page.goto('/wallets');

  await page.getByRole('button', { name: 'Edit Won' }).click();
  await pickOption(page, 'IDR - Indonesian Rupiah');
  await sheet(page).getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText(/Cannot change currency/)).toBeVisible();
  expect((await api(page, 'get', `/api/wallets/${wallet}`)).data.wallet.currency).toBe('KRW');
});

test('W4 delete an empty wallet', async ({ page }) => {
  await signUp(page, 'w4');
  await seedWallet(page, 'KRW', 0, 'Disposable');
  await page.goto('/wallets');

  await page.getByRole('button', { name: 'Delete Disposable' }).click();
  await confirmDelete(page);

  await expect(card(page, 'Disposable')).toHaveCount(0);
});

test('W5 deleting a wallet with transactions explains why it failed', async ({ page }) => {
  await signUp(page, 'w5');
  const wallet = await seedWallet(page, 'KRW', 0, 'Busy');
  const cat = await seedCategory(page, 'EXPENSE');
  await seedTx(page, wallet, cat, 'spend', thisMonth(2));
  await page.goto('/wallets');

  await page.getByRole('button', { name: 'Delete Busy' }).click();
  await confirmDelete(page);

  await expect(page.getByText(/Cannot delete wallet with 1 existing transaction/)).toBeVisible();
  await expect(card(page, 'Busy')).toBeVisible();
});

test('W6 create an income category', async ({ page }) => {
  await signUp(page, 'w6');
  await openCategories(page);
  await page.getByRole('button', { name: 'Add category' }).click();

  await sheet(page).getByLabel('Category Name').fill('Bonus');
  await pickOption(page, 'Income');
  await sheet(page).getByRole('button', { name: 'Create category' }).click();

  await expect(card(page, 'Bonus')).toContainText('Income');
});

test('W7 rename a category', async ({ page }) => {
  await signUp(page, 'w7');
  await seedCategory(page, 'EXPENSE', 'Groceries');
  await openCategories(page);

  await page.getByRole('button', { name: 'Edit Groceries' }).click();
  await sheet(page).getByLabel('Category Name').fill('Supermarket');
  await sheet(page).getByRole('button', { name: 'Save changes' }).click();

  await expect(card(page, 'Supermarket')).toBeVisible();
  await page.reload();
  await page.getByRole('radio', { name: /Categories/ }).click();
  await expect(card(page, 'Supermarket')).toBeVisible();
});

test('W8 flipping the type of a category in use is refused', async ({ page }) => {
  await signUp(page, 'w8');
  const wallet = await seedWallet(page);
  const cat = await seedCategory(page, 'EXPENSE', 'Rent');
  await seedTx(page, wallet, cat, 'rent', thisMonth(1));
  await openCategories(page);

  await page.getByRole('button', { name: 'Edit Rent' }).click();
  await pickOption(page, 'Income');
  await sheet(page).getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText(/Cannot change the type/)).toBeVisible();
});

test('W9 deleting a category in use is refused', async ({ page }) => {
  await signUp(page, 'w9');
  const wallet = await seedWallet(page);
  const cat = await seedCategory(page, 'EXPENSE', 'Utilities');
  await seedTx(page, wallet, cat, 'power', thisMonth(1));
  await openCategories(page);

  await page.getByRole('button', { name: 'Delete Utilities' }).click();
  await confirmDelete(page);

  await expect(page.getByText(/Cannot delete category/)).toBeVisible();
  await expect(card(page, 'Utilities')).toBeVisible();
});

test('W10 delete an unused category', async ({ page }) => {
  await signUp(page, 'w10');
  const id = await seedCategory(page, 'EXPENSE', 'Unused');
  await openCategories(page);

  await page.getByRole('button', { name: 'Delete Unused' }).click();
  await confirmDelete(page);

  await expect(card(page, 'Unused')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: /Categories/ })).toHaveAttribute('aria-checked', 'true');
  expect((await page.request.get(`${API}/api/categories/${id}`)).status()).toBe(404);
});

test('W11 "Add wallet" after editing a wallet starts with an empty form', async ({ page }) => {
  await signUp(page, 'w11');
  await seedWallet(page, 'KRW', 5000, 'Existing');
  await page.goto('/wallets');

  await page.getByRole('button', { name: 'Edit Existing' }).click();
  await expect(sheet(page).getByLabel('Wallet Name')).toHaveValue('Existing');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add wallet' }).click();

  await expect(sheet(page).getByLabel('Wallet Name')).toHaveValue('');
  await expect(sheet(page).getByRole('button', { name: 'Create wallet' })).toBeVisible();
});

test('W12 renaming an IDR wallet keeps its currency', async ({ page }) => {
  await signUp(page, 'w12');
  const wallet = await seedWallet(page, 'IDR', 50000, 'Jakarta');
  await page.goto('/wallets');

  await page.getByRole('button', { name: 'Edit Jakarta' }).click();
  await expect(sheet(page).getByRole('combobox')).toHaveText(/IDR/);
  await sheet(page).getByLabel('Wallet Name').fill('Jakarta Daily');
  await sheet(page).getByRole('button', { name: 'Save changes' }).click();

  await expect(card(page, 'Jakarta Daily')).toContainText('IDR');
  expect((await api(page, 'get', `/api/wallets/${wallet}`)).data.wallet.currency).toBe('IDR');
});
