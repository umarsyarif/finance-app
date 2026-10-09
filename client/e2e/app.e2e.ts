/**
 * End-to-end scenarios: real browser, real API, real Postgres/Redis.
 * Run: npm run test:e2e   (needs `make infra` and a migrated DB)
 *
 * Each scenario checks behavior the mocked vitest suites cannot see:
 * cookies and token refresh, browser timezone, offline mode, double taps,
 * data left behind across users.
 */
import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:8010';
let ipSeed = 0;

// Each sign-up comes from a distinct client IP so the auth rate limiter (10 / 15 min) doesn't trip
async function signUp(page: Page, tag: string) {
  const email = `e2e-${tag}-${Date.now()}@example.test`;
  const res = await page.request.post(`${API}/api/auth/register`, {
    data: { name: tag, email, password: 'password123', passwordConfirm: 'password123' },
    headers: { 'X-Forwarded-For': `10.0.${++ipSeed}.${Date.now() % 250}` },
  });
  expect(res.status()).toBe(201);
  return email;
}

async function api<T = any>(page: Page, method: 'get' | 'post' | 'patch' | 'put', path: string, data?: object): Promise<T> {
  const res = await page.request[method](`${API}${path}`, { data });
  expect(res.ok(), `${method.toUpperCase()} ${path} -> ${res.status()}`).toBeTruthy();
  return res.json();
}

async function seedWallet(page: Page, currency = 'KRW', balance = 100000) {
  const { data } = await api(page, 'post', '/api/wallets', { name: `Main ${currency}`, currency, balance });
  await api(page, 'put', `/api/wallets/${data.wallet.id}/main`);
  return data.wallet.id as string;
}

async function seedCategory(page: Page, type: 'INCOME' | 'EXPENSE', name = `Cat ${type}`) {
  const { data } = await api(page, 'post', '/api/categories', { name, type });
  return data.category.id as string;
}

async function seedTx(page: Page, walletId: string, categoryId: string, description: string, date: string, amount = 1000) {
  const { data } = await api(page, 'post', '/api/transactions', { walletId, categoryId, amount, description, date });
  return data.transaction.id as string;
}

async function txCount(page: Page, walletId: string) {
  const { data } = await api(page, 'get', `/api/transactions?walletId=${walletId}&limit=1000`);
  return data.pagination.total as number;
}

const prevMonth = (page: Page) => page.locator('button:has(svg.lucide-chevron-left)').first().click();

async function logOutViaUi(page: Page) {
  await page.locator('header').getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
}

test('stays signed in after the access token cookie expires', async ({ page, context }) => {
  await signUp(page, 'refresh');
  await seedWallet(page);
  await page.goto('/');
  await expect(page.getByText('Current Balance')).toBeVisible();

  await context.clearCookies({ name: 'access_token' }); // what the browser does after 2h
  await page.reload();

  await expect(page.getByText('Current Balance')).toBeVisible();
  await expect(page).not.toHaveURL(/\/login/);
});

test('double-tapping Add Expense creates exactly one transaction', async ({ page }) => {
  await signUp(page, 'dbltap');
  const wallet = await seedWallet(page);
  await seedCategory(page, 'EXPENSE', 'Food');
  await page.goto('/');

  await page.getByRole('button', { name: 'Add Expense' }).first().click();
  const sheet = page.getByRole('dialog');
  await sheet.getByPlaceholder('Enter description').fill('Coffee');
  await sheet.getByPlaceholder('0.00').fill('4500');
  await sheet.getByRole('combobox', { name: 'Category' }).click();
  await page.getByRole('option', { name: 'Food' }).click();
  await sheet.getByRole('button', { name: 'Add Expense' }).dblclick();

  await expect(page.getByText('Coffee').first()).toBeVisible();
  await page.waitForTimeout(1000);
  expect(await txCount(page, wallet)).toBe(1);
});

test('saving an edit without changes keeps the date, time and amount', async ({ page }) => {
  await signUp(page, 'edit');
  const wallet = await seedWallet(page);
  const cat = await seedCategory(page, 'EXPENSE');
  const id = await seedTx(page, wallet, cat, 'edit-me', '2026-10-05T03:07:00.000Z', 1234.5);
  await page.goto('/transactions');

  await page.getByText('edit-me').click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Update Transaction' }).click();
  await expect(page.getByRole('button', { name: 'Update Transaction' })).toBeHidden();

  const { data } = await api(page, 'get', `/api/transactions/${id}`);
  expect(data.transaction.date).toBe('2026-10-05T03:07:00.000Z');
  expect(data.transaction.amount).toBe(1234.5);
});

test('Transactions page shows every transaction of a busy month', async ({ page }) => {
  await signUp(page, 'busy');
  const wallet = await seedWallet(page);
  const cat = await seedCategory(page, 'EXPENSE');
  for (let i = 0; i < 105; i++) {
    await seedTx(page, wallet, cat, `bulk-${i}`, `2026-10-0${1 + (i % 8)}T05:00:00.000Z`, 10);
  }
  await page.goto('/transactions');

  await expect(page.getByText(/^bulk-\d+$/)).toHaveCount(100);
  await page.getByRole('button', { name: 'Load more' }).click();

  await expect(page.getByText(/^bulk-\d+$/)).toHaveCount(105);
  await expect(page.getByRole('button', { name: 'Load more' })).toBeHidden();
});

test('offline: browsing to another month does not show this month\'s transactions', async ({ page, context }) => {
  await signUp(page, 'offline');
  const wallet = await seedWallet(page);
  const cat = await seedCategory(page, 'EXPENSE');
  await seedTx(page, wallet, cat, 'oct-only', '2026-10-05T05:00:00.000Z');
  await page.goto('/transactions');
  await expect(page.getByText('oct-only')).toBeVisible();

  await context.setOffline(true);
  await prevMonth(page);

  await expect(page.getByText('September 2026')).toBeVisible();
  await expect(page.getByText('oct-only')).toBeHidden();
  await context.setOffline(false);
});

test('logging out removes the user\'s transactions from this device', async ({ page }) => {
  await signUp(page, 'alice');
  const wallet = await seedWallet(page);
  const cat = await seedCategory(page, 'EXPENSE');
  await seedTx(page, wallet, cat, 'alice-secret', '2026-10-05T05:00:00.000Z');
  await page.goto('/transactions');
  await expect(page.getByText('alice-secret')).toBeVisible();

  await logOutViaUi(page);

  // Shared device: whatever the next person (or anyone with the phone) can read from storage
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(stored).not.toContain('alice-secret');
});

test('offline with nothing cached still lets you change month', async ({ page, context }) => {
  await signUp(page, 'offline-empty');
  await seedWallet(page);
  await page.goto('/transactions');
  await expect(page.getByText('October 2026')).toBeVisible();

  await context.setOffline(true);
  await prevMonth(page);

  await expect(page.getByText('September 2026')).toBeVisible();
  await context.setOffline(false);
});

test('back button after logout does not reveal the previous page\'s data', async ({ page }) => {
  await signUp(page, 'back');
  const wallet = await seedWallet(page);
  const cat = await seedCategory(page, 'EXPENSE');
  await seedTx(page, wallet, cat, 'private-row', '2026-10-05T05:00:00.000Z');
  await page.goto('/transactions');
  await expect(page.getByText('private-row')).toBeVisible();
  await logOutViaUi(page);

  await page.goBack();

  await expect(page.getByText('private-row')).toBeHidden();
});

test('without "Remember me", closing the browser signs you out', async ({ page, browser }) => {
  const email = await signUp(page, 'noremember');
  await seedWallet(page);
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByTestId('input-email').fill(email);
  await page.getByTestId('input-password').fill('password123');
  await page.getByTestId('submit-button').click();
  await expect(page.getByText('Current Balance')).toBeVisible();

  // Browser restart: session cookies (no expiry) are dropped, persistent ones survive
  const state = await page.context().storageState();
  const restarted = await browser.newContext({
    ...test.info().project.use,
    storageState: { ...state, cookies: state.cookies.filter((c) => c.expires !== -1) },
  });
  const again = await restarted.newPage();
  await again.goto('/');

  await expect(again).toHaveURL(/\/login/);
  await restarted.close();
});

test('stats for a rupiah-only user are shown in rupiah', async ({ page }) => {
  await signUp(page, 'idr');
  const wallet = await seedWallet(page, 'IDR', 500000);
  const cat = await seedCategory(page, 'EXPENSE');
  await seedTx(page, wallet, cat, 'nasi', new Date().toISOString(), 25000);
  await page.goto('/stats');

  await expect(page.getByText('Monthly Summary')).toBeVisible();
  await expect(page.getByText(/25,000/).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('₩');
});

test.describe('in Jakarta (UTC+7)', () => {
  test.use({ timezoneId: 'Asia/Jakarta' });

  test('a late-night transaction on the last day of the month stays in that month', async ({ page }) => {
    await signUp(page, 'jkt');
    const wallet = await seedWallet(page, 'IDR');
    const cat = await seedCategory(page, 'EXPENSE');
    await seedTx(page, wallet, cat, 'jkt-late', '2026-09-30T23:30:00+07:00');
    await page.goto('/transactions');
    await expect(page.getByText('October 2026')).toBeVisible();

    await prevMonth(page);

    await expect(page.getByText('September 2026')).toBeVisible();
    await expect(page.getByText('jkt-late')).toBeVisible({ timeout: 3000 });
  });
});
