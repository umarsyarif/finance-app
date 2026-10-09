// Scenarios G1–G6 (see SCENARIOS.md)
import { test, expect, signUp, freshIp, avatarButton, API, PASSWORD } from './helpers';

test('G1 profile tab is prefilled with name and email', async ({ page }) => {
  const email = await signUp(page, 'g1', 'Alan Turing');
  await page.goto('/settings');
  await expect(page.getByLabel('Full Name')).toHaveValue('Alan Turing');
  await expect(page.getByLabel('Email Address')).toHaveValue(email);
});

test('G2 changing the name is saved', async ({ page }) => {
  await signUp(page, 'g2', 'Old Name');
  await page.goto('/settings');
  await page.getByLabel('Full Name').fill('New Name');
  await page.getByRole('button', { name: 'Update Profile' }).click();

  await page.reload();

  await expect(page.getByLabel('Full Name')).toHaveValue('New Name');
  await expect(avatarButton(page)).toHaveText('NN');
});

test('G3 changing the password takes effect', async ({ page }) => {
  const email = await signUp(page, 'g3');
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Security' }).click();
  await page.getByLabel('Current Password').fill(PASSWORD);
  await page.getByLabel('New Password', { exact: true }).fill('newpassword456');
  await page.getByLabel('Confirm New Password').fill('newpassword456');
  await page.getByRole('button', { name: 'Change Password' }).click();
  await expect(page.getByText(/Password changed/)).toBeVisible();
  await expect(page.getByLabel('Current Password')).toHaveValue('');

  const res = await page.request.post(`${API}/api/auth/login`, {
    data: { email, password: 'newpassword456' },
    headers: freshIp(),
  });
  expect(res.status()).toBe(200);
});

test('G4 dark theme is applied and survives a reload', async ({ page }) => {
  await signUp(page, 'g4');
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Appearance' }).click();
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.reload();

  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('G5 every settings section is reachable on a phone-width screen', async ({ page }) => {
  await signUp(page, 'g5');
  await page.goto('/settings');
  for (const [tab, text] of [
    ['Security', 'Change Password'],
    ['Appearance', 'Theme'],
    ['Profile', 'Update Profile'],
  ]) {
    await page.getByRole('radio', { name: tab }).click();
    await expect(page.getByText(text).first()).toBeVisible();
  }
});

test('G6 unknown page shows a 404 with a way home', async ({ page }) => {
  await signUp(page, 'g6');
  await page.goto('/does-not-exist');
  await expect(page.getByText('404')).toBeVisible();
  await page.getByRole('link', { name: 'Back to Home' }).click();
  await expect(page).toHaveURL(/\/$/);
});
