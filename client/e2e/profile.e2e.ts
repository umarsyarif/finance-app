// Scenarios P1–P6 (see SCENARIOS.md)
import { test, expect, signUp, seedWallet, card } from './helpers';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('P1 /settings opens Profile with the profile card', async ({ page }) => {
  const email = await signUp(page, 'p1', 'Pat Lee');
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/profile$/);
  const profileCard = page.getByRole('region', { name: 'Profile card' });
  await expect(profileCard).toContainText('Pat Lee');
  await expect(profileCard).toContainText(email);
  await expect(profileCard).toContainText('Member since');
});

test('P2 an uploaded photo shows on Profile and as the Home avatar', async ({ page }) => {
  await signUp(page, 'p2');
  await page.goto('/profile');
  await page.getByLabel('Change photo').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('region', { name: 'Profile card' }).locator('img[src*="/api/users/me/avatar"]')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Open profile' }).locator('img[src*="/api/users/me/avatar"]')).toBeVisible();
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Remove photo' }).click();
  await expect(page.getByRole('region', { name: 'Profile card' }).locator('img')).toHaveCount(0);
});

test('P3 profile sheets open and the name saves', async ({ page }) => {
  await signUp(page, 'p3', 'Old Name');
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByRole('dialog').getByLabel('Full Name').fill('New Name');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('region', { name: 'Profile card' })).toContainText('New Name');
  await page.getByRole('button', { name: /Change password/ }).click();
  await expect(page.getByRole('dialog').getByLabel('Current Password')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Shortcut token/ }).click();
  await expect(page.getByRole('dialog')).toContainText(/token/i);
});

test('P4 greeting and theme toggle appear only on Home', async ({ page }) => {
  await signUp(page, 'p4');
  await page.goto('/');
  await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle theme' })).toBeVisible();
  for (const path of ['/transactions', '/wallets', '/profile']) {
    await page.goto(path);
    await expect(page.getByText(/Good (morning|afternoon|evening)/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Toggle theme' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Open profile' })).toHaveCount(0);
  }
});

test('P5 a wallet icon and colour show as a filled tile', async ({ page }) => {
  await signUp(page, 'p5');
  await seedWallet(page, 'KRW', 1000, 'Bank');
  await page.goto('/wallets');
  await page.getByRole('button', { name: 'Edit Bank' }).click();
  await page.getByRole('dialog').getByRole('radio', { name: 'landmark' }).click();
  await page.getByRole('dialog').locator('button[style*="rgb(239, 68, 68)"]').first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  const tile = card(page, 'Bank').locator('span[aria-hidden][style*="background-color"]').first();
  await expect(tile).toHaveCSS('background-color', 'rgb(239, 68, 68)');
  await expect(tile.locator('svg')).toBeVisible();
  await expect(tile.locator('svg')).toHaveCSS('color', 'rgb(255, 255, 255)');
});

test('P6 Sign out from Profile lands on the sign-in page', async ({ page }) => {
  await signUp(page, 'p6');
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
});
