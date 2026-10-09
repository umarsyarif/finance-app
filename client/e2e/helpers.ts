import { test as base, expect, type Page } from '@playwright/test';

export const API = 'http://localhost:8010';
export const PASSWORD = 'password123';
let ipSeed = 0;

// Every scenario also fails on an uncaught error in the page
export const test = base.extend<{ noPageErrors: void }>({
  noPageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await use();
      expect(errors, 'uncaught page errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

// Distinct client IP per call so the auth rate limiter (10 / 15 min) doesn't trip
export const freshIp = () => ({ 'X-Forwarded-For': `10.${++ipSeed % 250}.${Date.now() % 250}.1` });

export const uniqueEmail = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.test`;

export async function signUp(page: Page, tag: string, name = tag) {
  const email = uniqueEmail(tag);
  const res = await page.request.post(`${API}/api/auth/register`, {
    data: { name, email, password: PASSWORD, passwordConfirm: PASSWORD },
    headers: freshIp(),
  });
  expect(res.status()).toBe(201);
  return email;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosely typed API JSON in tests
export async function api<T = any>(page: Page, method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string, data?: object): Promise<T> {
  const res = await page.request[method](`${API}${path}`, { data });
  expect(res.ok(), `${method.toUpperCase()} ${path} -> ${res.status()}`).toBeTruthy();
  return res.status() === 204 ? (undefined as T) : res.json();
}

export async function seedWallet(page: Page, currency = 'KRW', balance = 100000, name = `Main ${currency}`, main = true) {
  const { data } = await api(page, 'post', '/api/wallets', { name, currency, balance });
  if (main) await api(page, 'put', `/api/wallets/${data.wallet.id}/main`);
  return data.wallet.id as string;
}

export async function seedCategory(page: Page, type: 'INCOME' | 'EXPENSE', name = `Cat ${type}`) {
  const { data } = await api(page, 'post', '/api/categories', { name, type });
  return data.category.id as string;
}

export async function seedTx(page: Page, walletId: string, categoryId: string, description: string, date: string, amount = 1000) {
  const { data } = await api(page, 'post', '/api/transactions', { walletId, categoryId, amount, description, date });
  return data.transaction.id as string;
}

export async function txCount(page: Page, walletId: string) {
  const { data } = await api(page, 'get', `/api/transactions?walletId=${walletId}&limit=1000`);
  return data.pagination.total as number;
}

export async function walletBalance(page: Page, walletId: string) {
  const { data } = await api(page, 'get', `/api/wallets/${walletId}`);
  return data.wallet.balance as number;
}

export const prevMonth = (page: Page) => page.locator('button:has(svg.lucide-chevron-left)').first().click();
export const nextMonth = (page: Page) => page.locator('button:has(svg.lucide-chevron-right)').first().click();

export const avatarButton = (page: Page) => page.locator('header').getByRole('button').last();

export async function logOutViaUi(page: Page) {
  await avatarButton(page).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
}

// A shadcn Card (data-slot="card") containing the given text
export const card = (page: Page, text: string) => page.locator('[data-slot="card"]').filter({ hasText: text });

// A local date-time this month, as an ISO instant
export function thisMonth(day: number, hour = 12) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), day, hour).toISOString();
}
