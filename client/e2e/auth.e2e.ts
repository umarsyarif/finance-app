// Scenarios A1–A10 (see SCENARIOS.md)
import { test, expect, signUp, uniqueEmail, freshIp, seedWallet, logOutViaUi, avatarButton, PASSWORD } from './helpers';

// Browser-driven register/login hit the auth rate limiter; give each test its own client IP
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders(freshIp());
});

async function fillRegister(page: import('@playwright/test').Page, name: string, email: string, password: string, confirm = password) {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Sign up' }).click();
  await page.getByPlaceholder('Enter your name').fill(name);
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Create a password').fill(password);
  await page.getByPlaceholder('Confirm your password').fill(confirm);
  await page.getByRole('button', { name: 'Create account' }).click();
}

test('A0 opening /register directly shows the sign-up form', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  await expect(page).toHaveURL(/\/register/);
});

test('A1 register through the form signs you in', async ({ page }) => {
  await fillRegister(page, 'Grace Hopper', uniqueEmail('a1'), PASSWORD);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('No wallets found. Create your first wallet to get started!')).toBeVisible();
});

test('A2 register with mismatched passwords shows an error', async ({ page }) => {
  await fillRegister(page, 'Mismatch', uniqueEmail('a2'), PASSWORD, 'password999');
  await expect(page.getByText('Passwords do not match')).toBeVisible();
  await expect(page).toHaveURL(/\/register/);
});

test('A3 register with a short password shows an error', async ({ page }) => {
  await fillRegister(page, 'Shorty', uniqueEmail('a3'), 'short');
  await expect(page.getByText(/more than 8 characters/)).toBeVisible();
  await expect(page).toHaveURL(/\/register/);
});

test('A4 register with an existing email in different case is refused', async ({ page }) => {
  const email = await signUp(page, 'a4');
  await page.context().clearCookies();
  await fillRegister(page, 'Dup', email.toUpperCase(), PASSWORD);
  await expect(page.getByText(/Email already exist/)).toBeVisible();
});

test('A5 login with a wrong password shows an error', async ({ page }) => {
  const email = await signUp(page, 'a5');
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByTestId('input-email').fill(email);
  await page.getByTestId('input-password').fill('wrongpassword');
  await page.getByTestId('submit-button').click();
  await expect(page.getByText('Invalid email or password')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('A6 login then reload keeps you signed in', async ({ page }) => {
  const email = await signUp(page, 'a6');
  await seedWallet(page);
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByTestId('input-email').fill(email);
  await page.getByTestId('input-password').fill(PASSWORD);
  await page.getByTestId('submit-button').click();
  await expect(page.getByRole('heading', { name: 'Summary' })).toBeVisible();

  await page.reload();

  await expect(page.getByRole('heading', { name: 'Summary' })).toBeVisible();
});

test('A7 protected page while signed out redirects to login', async ({ page }) => {
  await page.goto('/transactions');
  await expect(page).toHaveURL(/\/login/);
});

test('A8 visiting /login while signed in goes to the dashboard', async ({ page }) => {
  await signUp(page, 'a8');
  await page.goto('/login');
  await expect(page.getByText('404')).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
});

test('A9 log out from the header menu', async ({ page }) => {
  await signUp(page, 'a9');
  await page.goto('/');
  await logOutViaUi(page);
  await page.goto('/wallets');
  await expect(page).toHaveURL(/\/login/);
});

test('A10 header avatar shows the user\'s initials', async ({ page }) => {
  await signUp(page, 'a10', 'Ada Lovelace');
  await page.goto('/');
  await expect(avatarButton(page)).toHaveText('AL');
});
