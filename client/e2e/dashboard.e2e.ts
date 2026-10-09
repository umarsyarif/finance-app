// Scenarios D1–D10 (see SCENARIOS.md)
import { type Page } from '@playwright/test';
import {
  test, expect, signUp, api, seedWallet, seedCategory, seedTx, txCount, walletBalance, thisMonth,
  card, row, openAddSheet, fillTransaction, saveButton,
} from './helpers';

// The wallet card currently selected on the dashboard
const selectedWallet = (page: Page) => page.locator('article[aria-current="true"] h3');

test('D1 add income raises balance and income, shows in Recent', async ({ page }) => {
  await signUp(page, 'd1');
  const wallet = await seedWallet(page, 'KRW', 100000);
  await seedCategory(page, 'INCOME', 'Salary');
  await page.goto('/');

  const sheet = await openAddSheet(page);
  await fillTransaction(sheet, { type: 'Income', description: 'Paycheck', amount: '50000', category: 'Salary' });
  await saveButton(sheet).click();

  await expect(page.getByText('₩150,000')).toBeVisible();
  await expect(page.getByText('+₩50,000').first()).toBeVisible();
  await expect(row(page, 'Paycheck')).toBeVisible();
  expect(await walletBalance(page, wallet)).toBe(150000);
});

test('D2 add expense lowers balance and raises expense, shows in Recent', async ({ page }) => {
  await signUp(page, 'd2');
  const wallet = await seedWallet(page, 'KRW', 100000);
  await seedCategory(page, 'EXPENSE', 'Food');
  await page.goto('/');

  const sheet = await openAddSheet(page);
  await fillTransaction(sheet, { description: 'Bibimbap', amount: '12000', category: 'Food' });
  await saveButton(sheet).click();

  await expect(page.getByText('₩88,000')).toBeVisible();
  await expect(page.getByText('-₩12,000').first()).toBeVisible();
  await expect(row(page, 'Bibimbap')).toBeVisible();
  expect(await walletBalance(page, wallet)).toBe(88000);
});

test('D3 sheet validates description and amount', async ({ page }) => {
  await signUp(page, 'd3');
  const wallet = await seedWallet(page);
  await seedCategory(page, 'EXPENSE', 'Food');
  await page.goto('/');

  const sheet = await openAddSheet(page);
  const description = sheet.getByPlaceholder('What was it for?');
  const amount = sheet.getByLabel('Amount');
  const isValid = (l: typeof amount) => l.evaluate((el: HTMLInputElement) => el.checkValidity());

  await saveButton(sheet).click();
  expect(await isValid(amount)).toBe(false); // browser blocks the empty amount

  await fillTransaction(sheet, { amount: '-5' });
  await saveButton(sheet).click();
  expect(await isValid(amount)).toBe(false); // min="0"

  await fillTransaction(sheet, { amount: '10' });
  expect(await isValid(description)).toBe(false); // empty description still blocks

  await fillTransaction(sheet, { description: 'Zero', amount: '0', category: 'Food' });
  await saveButton(sheet).click();
  await expect(sheet.getByText('Valid amount is required')).toBeVisible();

  expect(await txCount(page, wallet)).toBe(0);
});

test('D4 amount above the server cap shows the server message', async ({ page }) => {
  await signUp(page, 'd4');
  const wallet = await seedWallet(page);
  await seedCategory(page, 'EXPENSE', 'Food');
  await page.goto('/');

  const sheet = await openAddSheet(page);
  await fillTransaction(sheet, { description: 'Yacht', amount: '10000000000000', category: 'Food' });
  await saveButton(sheet).click();

  await expect(sheet.getByText('Amount is too large')).toBeVisible();
  expect(await txCount(page, wallet)).toBe(0);
});

test('D5 a category created inline is selected and used', async ({ page }) => {
  await signUp(page, 'd5');
  const wallet = await seedWallet(page);
  await page.goto('/');

  const sheet = await openAddSheet(page);
  await fillTransaction(sheet, { description: 'Chips', amount: '3000' });
  await sheet.getByRole('button', { name: 'New' }).click();
  await sheet.getByLabel('New category name').fill('Snacks');
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();

  await expect(sheet.getByRole('button', { name: 'Snacks' })).toHaveAttribute('aria-pressed', 'true');
  await saveButton(sheet).click();
  await expect(row(page, 'Chips')).toBeVisible();

  const { data } = await api(page, 'get', `/api/transactions?walletId=${wallet}`);
  expect(data.transactions[0].category.name).toBe('Snacks');
});

test('D6 swiping to another wallet switches its balance and Recent list', async ({ page }) => {
  await signUp(page, 'd6');
  const alpha = await seedWallet(page, 'KRW', 1000, 'Alpha');
  const beta = await seedWallet(page, 'KRW', 2000, 'Beta', false);
  const cat = await seedCategory(page, 'EXPENSE');
  await seedTx(page, alpha, cat, 'alpha-row', thisMonth(2));
  await seedTx(page, beta, cat, 'beta-row', thisMonth(2));
  await page.goto('/');
  await expect(selectedWallet(page)).toHaveText('Alpha');
  await expect(row(page, 'alpha-row')).toBeVisible();

  await card(page, 'Beta').scrollIntoViewIfNeeded();

  await expect(selectedWallet(page)).toHaveText('Beta');
  await expect(row(page, 'beta-row')).toBeVisible();
  await expect(row(page, 'alpha-row')).toBeHidden();
});

test('D7 adding from the 2nd wallet saves there and stays on it', async ({ page }) => {
  await signUp(page, 'd7');
  const alpha = await seedWallet(page, 'KRW', 1000, 'Alpha');
  const beta = await seedWallet(page, 'KRW', 2000, 'Beta', false);
  await seedCategory(page, 'EXPENSE', 'Food');
  await page.goto('/');
  await card(page, 'Beta').scrollIntoViewIfNeeded();
  await expect(selectedWallet(page)).toHaveText('Beta');

  const sheet = await openAddSheet(page);
  await fillTransaction(sheet, { description: 'beta-spend', amount: '500', category: 'Food' });
  await saveButton(sheet).click();

  await expect.poll(() => txCount(page, beta)).toBe(1);
  expect(await txCount(page, alpha)).toBe(0);
  await expect(selectedWallet(page)).toHaveText('Beta');
  await expect(row(page, 'beta-spend')).toBeVisible();
});

test('D8 long-pressing a wallet card makes it Main', async ({ page }) => {
  await signUp(page, 'd8');
  await seedWallet(page, 'KRW', 1000, 'Alpha');
  const beta = await seedWallet(page, 'KRW', 2000, 'Beta', false);
  await page.goto('/');
  const betaCard = card(page, 'Beta');
  await betaCard.scrollIntoViewIfNeeded();

  await betaCard.dispatchEvent('pointerdown');
  await page.waitForTimeout(700);
  await betaCard.dispatchEvent('pointerup');

  await expect.poll(async () => (await api(page, 'get', `/api/wallets/${beta}`)).data.wallet.isMain).toBe(true);
  await page.reload();
  await expect(selectedWallet(page)).toHaveText('Beta');
  await expect(card(page, 'Beta').getByText('Main', { exact: true })).toBeVisible();
});

test('D9 "See all transactions" opens the Transactions page', async ({ page }) => {
  await signUp(page, 'd9');
  await seedWallet(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'See all transactions' }).click();
  await expect(page).toHaveURL(/\/transactions$/);
});

test('D10 bottom navigation opens each page', async ({ page }) => {
  await signUp(page, 'd10');
  await seedWallet(page);
  await page.goto('/');
  const nav = (label: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: label });

  await nav('Transactions').click();
  await expect(page).toHaveURL(/\/transactions$/);
  await nav('Stats').click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
  await nav('Wallets').click();
  await expect(page).toHaveURL(/\/wallets$/);
  await expect(page.getByRole('heading', { name: 'Wallets' })).toBeVisible();
  await nav('Home').click();
  await expect(page).toHaveURL(/\/$/);
});
