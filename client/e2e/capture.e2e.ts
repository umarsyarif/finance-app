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
  await expect(page.getByText('No token yet')).toBeVisible();
  expect((await send()).status()).toBe(401);
});
