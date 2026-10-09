// Scenarios D1–D10 (see SCENARIOS.md)
import { type Page } from '@playwright/test';
import { test, expect, signUp, api, seedWallet, seedCategory, seedTx, txCount, walletBalance, thisMonth } from './helpers';

async function openSheet(page: Page, kind: 'Income' | 'Expense') {
  await page.getByRole('button', { name: `Add ${kind}` }).first().click();
  return page.getByRole('dialog');
}

async function pickCategory(page: Page, sheet: ReturnType<Page['getByRole']>, name: string) {
  await sheet.getByRole('combobox', { name: 'Category' }).click();
  await page.getByRole('option', { name }).click();
}

const heading = (page: Page) => page.locator('h3').first();

test('D1 add income raises balance and income, shows in Recent', async ({ page }) => {
  await signUp(page, 'd1');
  const wallet = await seedWallet(page, 'KRW', 100000);
  await seedCategory(page, 'INCOME', 'Salary');
  await page.goto('/');

  const sheet = await openSheet(page, 'Income');
  await sheet.getByPlaceholder('Enter description').fill('Paycheck');
  await sheet.getByPlaceholder('0.00').fill('50000');
  await pickCategory(page, sheet, 'Salary');
  await sheet.getByRole('button', { name: 'Add Income' }).click();

  await expect(page.getByText('₩150,000')).toBeVisible();
  await expect(page.getByText('+₩50,000').first()).toBeVisible();
  await expect(page.getByText('Paycheck')).toBeVisible();
  expect(await walletBalance(page, wallet)).toBe(150000);
});

test('D2 add expense lowers balance and raises expense, shows in Recent', async ({ page }) => {
  await signUp(page, 'd2');
  const wallet = await seedWallet(page, 'KRW', 100000);
  await seedCategory(page, 'EXPENSE', 'Food');
  await page.goto('/');

  const sheet = await openSheet(page, 'Expense');
  await sheet.getByPlaceholder('Enter description').fill('Bibimbap');
  await sheet.getByPlaceholder('0.00').fill('12000');
  await pickCategory(page, sheet, 'Food');
  await sheet.getByRole('button', { name: 'Add Expense' }).click();

  await expect(page.getByText('₩88,000')).toBeVisible();
  await expect(page.getByText('-₩12,000').first()).toBeVisible();
  await expect(page.getByText('Bibimbap')).toBeVisible();
  expect(await walletBalance(page, wallet)).toBe(88000);
});

test('D3 sheet validates description and amount', async ({ page }) => {
  await signUp(page, 'd3');
  const wallet = await seedWallet(page);
  await seedCategory(page, 'EXPENSE', 'Food');
  await page.goto('/');

  const sheet = await openSheet(page, 'Expense');
  const description = sheet.getByPlaceholder('Enter description');
  const amount = sheet.getByPlaceholder('0.00');
  const isValid = (l: typeof amount) => l.evaluate((el: HTMLInputElement) => el.checkValidity());

  await sheet.getByRole('button', { name: 'Add Expense' }).click();
  expect(await isValid(description)).toBe(false); // browser blocks the empty description

  await description.fill('Negative');
  await amount.fill('-5');
  await sheet.getByRole('button', { name: 'Add Expense' }).click();
  expect(await isValid(amount)).toBe(false); // min="0"

  await amount.fill('0');
  await pickCategory(page, sheet, 'Food');
  await sheet.getByRole('button', { name: 'Add Expense' }).click();
  await expect(sheet.getByText('Valid amount is required')).toBeVisible();

  expect(await txCount(page, wallet)).toBe(0);
});

test('D4 amount above the server cap shows the server message', async ({ page }) => {
  await signUp(page, 'd4');
  const wallet = await seedWallet(page);
  await seedCategory(page, 'EXPENSE', 'Food');
  await page.goto('/');

  const sheet = await openSheet(page, 'Expense');
  await sheet.getByPlaceholder('Enter description').fill('Yacht');
  await sheet.getByPlaceholder('0.00').fill('10000000000000');
  await pickCategory(page, sheet, 'Food');
  await sheet.getByRole('button', { name: 'Add Expense' }).click();

  await expect(sheet.getByText('Amount is too large')).toBeVisible();
  expect(await txCount(page, wallet)).toBe(0);
});

test('D5 a category created inline is selected and used', async ({ page }) => {
  await signUp(page, 'd5');
  const wallet = await seedWallet(page);
  await page.goto('/');

  const sheet = await openSheet(page, 'Expense');
  await sheet.getByPlaceholder('Enter description').fill('Chips');
  await sheet.getByPlaceholder('0.00').fill('3000');
  await sheet.getByRole('combobox', { name: 'Category' }).click();
  await page.getByPlaceholder('Search categories...').fill('Snacks');
  await page.getByRole('button', { name: 'Create "Snacks"' }).click();

  await expect(sheet.getByRole('combobox', { name: 'Category' })).toHaveText(/Snacks/);
  await sheet.getByRole('button', { name: 'Add Expense' }).click();
  await expect(page.getByText('Chips')).toBeVisible();

  const { data } = await api(page, 'get', `/api/transactions?walletId=${wallet}`);
  expect(data.transactions[0].category.name).toBe('Snacks');
});

test('D6 wallet arrows switch name, balance and Recent list', async ({ page }) => {
  await signUp(page, 'd6');
  const alpha = await seedWallet(page, 'KRW', 1000, 'Alpha');
  const beta = await seedWallet(page, 'KRW', 2000, 'Beta', false);
  const cat = await seedCategory(page, 'EXPENSE');
  await seedTx(page, alpha, cat, 'alpha-row', thisMonth(2));
  await seedTx(page, beta, cat, 'beta-row', thisMonth(2));
  await page.goto('/');
  await expect(heading(page)).toHaveText('Alpha');
  await expect(page.getByText('alpha-row')).toBeVisible();

  await page.getByRole('button', { name: '→' }).click();

  await expect(heading(page)).toHaveText('Beta');
  await expect(page.getByText('₩1,000').first()).toBeVisible();
  await expect(page.getByText('beta-row')).toBeVisible();
  await expect(page.getByText('alpha-row')).toBeHidden();
});

test('D7 add expense while the 2nd wallet is shown saves to that wallet', async ({ page }) => {
  await signUp(page, 'd7');
  const alpha = await seedWallet(page, 'KRW', 1000, 'Alpha');
  const beta = await seedWallet(page, 'KRW', 2000, 'Beta', false);
  await seedCategory(page, 'EXPENSE', 'Food');
  await page.goto('/');
  await page.getByRole('button', { name: '→' }).click();
  await expect(heading(page)).toHaveText('Beta');

  const sheet = await openSheet(page, 'Expense');
  await sheet.getByPlaceholder('Enter description').fill('beta-spend');
  await sheet.getByPlaceholder('0.00').fill('500');
  await pickCategory(page, sheet, 'Food');
  await sheet.getByRole('button', { name: 'Add Expense' }).click();

  await expect.poll(() => txCount(page, beta)).toBe(1);
  expect(await txCount(page, alpha)).toBe(0);
  // The dashboard should stay on the wallet you were using
  await expect(heading(page)).toHaveText('Beta');
  await expect(page.getByText('beta-spend')).toBeVisible();
});

test('D8 double-tapping a wallet chip makes it Main', async ({ page }) => {
  await signUp(page, 'd8');
  await seedWallet(page, 'KRW', 1000, 'Alpha');
  const beta = await seedWallet(page, 'KRW', 2000, 'Beta', false);
  await page.goto('/');

  await page.getByTitle(/^Beta - /).dblclick();

  await expect.poll(async () => (await api(page, 'get', `/api/wallets/${beta}`)).data.wallet.isMain).toBe(true);
  await page.reload();
  await expect(heading(page)).toHaveText('Beta');
  await expect(page.getByText('Main', { exact: true })).toBeVisible();
});

test('D9 "See all transactions" opens the Transactions page', async ({ page }) => {
  await signUp(page, 'd9');
  await seedWallet(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'See all transactions' }).click();
  await expect(page).toHaveURL(/\/transactions$/);
});

test('D10 bottom navigation opens each page', async ({ page }) => {
  await signUp(page, 'd10');
  await seedWallet(page);
  await page.goto('/');
  const nav = (label: string) => page.getByRole('button', { name: label, exact: true }).last();

  await nav('Transactions').click();
  await expect(page).toHaveURL(/\/transactions$/);
  await nav('Stats').click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(page.getByText('Statistics')).toBeVisible();
  await nav('Wallets').click();
  await expect(page).toHaveURL(/\/wallets$/);
  await expect(page.getByText('Wallets & Categories')).toBeVisible();
  await nav('Home').click();
  await expect(page).toHaveURL(/\/$/);
});
