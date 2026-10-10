// Scenarios G1–G6 (see SCENARIOS.md)
import { test, expect, signUp, freshIp, avatarButton, API, PASSWORD } from './helpers';

test('G1 Edit profile is prefilled with name and email', async ({ page }) => {
  const email = await signUp(page, 'g1', 'Alan Turing');
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Edit profile' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Full Name')).toHaveValue('Alan Turing');
  await expect(dialog.getByLabel('Email Address')).toHaveValue(email);
});

test('G2 changing the name updates the card and Home initials', async ({ page }) => {
  await signUp(page, 'g2', 'Old Name');
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByRole('dialog').getByLabel('Full Name').fill('New Name');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('region', { name: 'Profile card' })).toContainText('New Name');

  await page.goto('/');

  await expect(avatarButton(page)).toHaveText('NN');
});

test('G3 changing the password takes effect', async ({ page }) => {
  const email = await signUp(page, 'g3');
  await page.goto('/profile');
  await page.getByRole('button', { name: /Change password/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Current Password').fill(PASSWORD);
  await dialog.getByLabel('New Password', { exact: true }).fill('newpassword456');
  await dialog.getByLabel('Confirm New Password').fill('newpassword456');
  await dialog.getByRole('button', { name: 'Change Password' }).click();
  await expect(page.getByText(/Password changed/)).toBeVisible();

  const res = await page.request.post(`${API}/api/auth/login`, {
    data: { email, password: 'newpassword456' },
    headers: freshIp(),
  });
  expect(res.status()).toBe(200);
  const old = await page.request.post(`${API}/api/auth/login`, {
    data: { email, password: PASSWORD },
    headers: freshIp(),
  });
  expect(old.ok()).toBeFalsy();
});

test('G4 dark theme is applied and survives a reload', async ({ page }) => {
  await signUp(page, 'g4');
  await page.goto('/profile');
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.reload();

  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('G5 every profile section is visible on a phone-width screen', async ({ page }) => {
  await signUp(page, 'g5');
  await page.goto('/profile');
  await expect(page.getByRole('region', { name: 'Profile card' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Stats' })).toBeVisible();
  for (const text of ['Preferences', 'Security', 'Change password', 'Shortcut token']) {
    await expect(page.getByText(text).first()).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
});

test('G6 unknown page shows a 404 with a way home', async ({ page }) => {
  await signUp(page, 'g6');
  await page.goto('/does-not-exist');
  await expect(page.getByText('404')).toBeVisible();
  await page.getByRole('link', { name: 'Back to Home' }).click();
  await expect(page).toHaveURL(/\/$/);
});
