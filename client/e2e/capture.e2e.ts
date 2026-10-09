// Scenarios C1–C4 (see SCENARIOS.md)
import { test, expect, signUp, API, seedWallet, seedCategory, txCount, openAddSheet, saveButton, row } from './helpers';

test('C1 generate, use and revoke the Shortcut token', async ({ page }) => {
  await signUp(page, 'c1');
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Security' }).click();
  await expect(page.getByText('No token yet')).toBeVisible();

  await page.getByRole('button', { name: 'Generate token' }).click();
  const token = (await page.getByTestId('new-api-token').textContent())!.trim();
  expect(token).toMatch(/^ft_/);
  await expect(page.getByText("Copy it now. It won't be shown again.")).toBeVisible();

  // Token is accepted by the capture endpoint (no Gemini key in e2e, so it stops at 503)
  const send = () => page.request.post(`${API}/api/capture/text`, { headers: { Authorization: `Bearer ${token}` }, data: { text: 'x' } });
  expect((await send()).status()).toBe(503);

  await page.getByRole('button', { name: 'Revoke' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Revoke' }).click();
  await expect(page.getByText('No token yet')).toBeVisible();
  expect((await send()).status()).toBe(401);
});

test('C1b regenerating replaces the token', async ({ page }) => {
  await signUp(page, 'c1b');
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Security' }).click();
  await page.getByRole('button', { name: 'Generate token' }).click();
  const a = (await page.getByTestId('new-api-token').textContent())!.trim();

  await page.getByRole('button', { name: 'Regenerate' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByTestId('new-api-token')).not.toHaveText(a);
  const b = (await page.getByTestId('new-api-token').textContent())!.trim();

  const send = (t: string) => page.request.post(`${API}/api/capture/text`, { headers: { Authorization: `Bearer ${t}` }, data: { text: 'x' } });
  expect((await send(a)).status()).toBe(401);
  expect((await send(b)).status()).toBe(503);
});

test('C1c token status load failure is shown, not hidden as "No token yet"', async ({ page }) => {
  await signUp(page, 'c1c');
  await page.route('**/api/users/me/api-token', (r) =>
    r.request().method() === 'GET' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"status":"error","message":"x"}' }) : r.continue());
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Security' }).click();
  await expect(page.getByText("Couldn't load token status")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate token' })).toHaveCount(0);
  await expect(page.getByText('No token yet')).toHaveCount(0);
});

// 1×1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('C2 a scanned photo fills the form and nothing saves until Save', async ({ page }) => {
  await signUp(page, 'c2');
  const wallet = await seedWallet(page, 'KRW', 100000, 'KRW Main');
  const food = await seedCategory(page, 'EXPENSE', 'Food');
  let uploaded: { image: string; mimeType: string } | undefined;
  await page.route('**/api/capture/photo', async (route) => {
    uploaded = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'success', data: { draft: {
        type: 'EXPENSE', amount: 48500, description: 'Emart', date: '2026-10-09T05:20:00.000Z',
        walletId: wallet, walletName: 'KRW Main', currency: 'KRW', categoryId: food, categoryName: 'Food',
      } } }),
    });
  });
  await page.goto('/');

  const sheet = await openAddSheet(page);
  await sheet.getByLabel('Scan photo').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: PNG });

  await expect(sheet.getByText('Filled from photo. Check before saving.')).toBeVisible();
  await expect(sheet.getByLabel('Amount')).toHaveValue('48500');
  await expect(sheet.getByPlaceholder('What was it for?')).toHaveValue('Emart');
  await expect(sheet.getByRole('button', { name: 'Food' })).toHaveAttribute('aria-pressed', 'true');
  expect(uploaded?.mimeType).toBe('image/jpeg'); // downscaled and re-encoded on the client
  expect(await txCount(page, wallet)).toBe(0);

  await saveButton(sheet).click();
  await expect(row(page, 'Emart')).toBeVisible();
  expect(await txCount(page, wallet)).toBe(1);
});

test('C3 a failed scan shows the reason and keeps the form editable', async ({ page }) => {
  await signUp(page, 'c3');
  await seedWallet(page);
  await page.route('**/api/capture/photo', (route) =>
    route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ status: 'fail', message: "Couldn't find an amount" }) })
  );
  await page.goto('/');

  const sheet = await openAddSheet(page);
  await sheet.getByLabel('Scan photo').setInputFiles({ name: 'blurry.png', mimeType: 'image/png', buffer: PNG });

  await expect(sheet.getByText("Couldn't find an amount")).toBeVisible();
  await sheet.getByLabel('Amount').fill('1000');
  await expect(sheet.getByLabel('Amount')).toHaveValue('1000');
});

test('C4 editing a transaction has no Scan photo option', async ({ page }) => {
  await signUp(page, 'c4');
  const wallet = await seedWallet(page);
  const food = await seedCategory(page, 'EXPENSE', 'Food');
  await page.request.post(`${API}/api/transactions`, { data: { walletId: wallet, categoryId: food, amount: 1000, description: 'edit-me', date: new Date().toISOString() } });
  await page.goto('/transactions');
  await row(page, 'edit-me').click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit transaction' }).getByLabel('Scan photo')).toHaveCount(0);
});
