// Scenarios C1–C4 (see SCENARIOS.md)
import { test, expect, signUp, API } from './helpers';

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
