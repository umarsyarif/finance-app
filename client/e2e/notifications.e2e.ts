// Scenarios N1–N3 (see SCENARIOS.md). Only GET /api/notifications and POST /api/notifications/read are mocked; bills and settings are real.
import { test, expect, signUp, seedWallet, seedCategory, api, txCount, openAddSheet, saveButton } from './helpers';

test('N1 bell count, grouped list, actions, mark all read', async ({ page }) => {
  await signUp(page, 'n1');
  await seedWallet(page, 'KRW', 1000, 'Cash');
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
  const notifications = [
    { id: 'n-bill', kind: 'BILL', title: 'Rent due', body: 'Rent is due tomorrow', url: '/?add=new', readAt: null, createdAt: now.toISOString() },
    { id: 'n-sc', kind: 'SHORTCUT_SAVED', title: 'Saved from Shortcut', body: 'Coffee 4,500', url: '/transactions', readAt: yesterday.toISOString(), createdAt: yesterday.toISOString() },
  ];
  await page.route((url) => url.pathname === '/api/notifications', (route) =>
    route.fulfill({ json: { status: 'success', data: { notifications, nextCursor: null, unreadCount: 1 } } }));
  const reads: unknown[] = [];
  await page.route((url) => url.pathname === '/api/notifications/read', (route) => {
    reads.push(route.request().postDataJSON());
    return route.fulfill({ json: { status: 'success', data: { unreadCount: 0 } } });
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Notifications, 1 unread' }).click();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Yesterday' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record payment' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View' })).toBeVisible();

  await page.getByRole('button', { name: 'Mark all read' }).click();
  await expect.poll(() => reads).toEqual([{ all: true }]);
});

test('N2 bill created in the UI prefills the Add sheet via deep link', async ({ page }) => {
  await signUp(page, 'n2');
  const walletId = await seedWallet(page, 'KRW', 100000, 'Cash');
  await seedCategory(page, 'EXPENSE', 'Housing');

  await page.goto('/profile');
  await page.getByRole('button', { name: /Bills/ }).click();
  await expect(page).toHaveURL(/\/bills$/);
  await page.getByRole('button', { name: 'Add bill' }).click();
  const form = page.getByRole('dialog', { name: 'Add bill' });
  await form.getByLabel('Name').fill('Rent');
  await form.getByLabel('Amount').fill('50000');
  await form.getByLabel('Wallet').selectOption({ label: 'Cash' });
  await form.getByLabel('Day of month').fill('5');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(form).toBeHidden();
  const bill = page.getByRole('button', { name: 'Rent', exact: true });
  await expect(bill).toBeVisible();
  await expect(bill).toContainText('Every month on the 5th');

  const { data } = await api(page, 'get', '/api/bills');
  const id = data.bills[0].id as string;
  await page.goto(`/?add=bill:${id}`);
  const sheet = page.getByRole('dialog', { name: 'Add transaction' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel('Amount')).toHaveValue(/50,?000/);
  await expect(sheet.getByPlaceholder('What was it for?')).toHaveValue('Rent');
  await expect(sheet).toContainText('Cash');
  await sheet.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Housing', exact: true }).click();
  await saveButton(sheet).click();
  await expect(sheet).toBeHidden();
  await expect.poll(() => txCount(page, walletId)).toBe(1);
});

test('N3 notification settings persist', async ({ page }) => {
  await signUp(page, 'n3');
  await page.goto('/profile');
  const section = page.getByRole('region', { name: 'Notifications' });
  await section.getByRole('switch', { name: 'Daily reminder' }).click();
  await expect(section.getByRole('switch', { name: 'Daily reminder' })).toHaveAttribute('aria-checked', 'false');
  await section.getByRole('switch', { name: 'Monthly summary' }).click();
  await expect(section.getByRole('switch', { name: 'Monthly summary' })).toHaveAttribute('aria-checked', 'false');
  // the time input is hidden while the reminder is off: set it first
  await section.getByRole('switch', { name: 'Daily reminder' }).click();
  const time = section.getByLabel('Reminder time');
  await time.fill('20:30');
  await time.blur();
  await section.getByRole('switch', { name: 'Daily reminder' }).click();
  await expect(time).toBeHidden();

  await expect.poll(async () => (await api(page, 'get', '/api/notifications/settings')).data.settings).toMatchObject({
    nudgeEnabled: false, nudgeTime: '20:30', monthlySummaryEnabled: false,
  });
  await page.reload();
  const again = page.getByRole('region', { name: 'Notifications' });
  await expect(again.getByRole('switch', { name: 'Daily reminder' })).toHaveAttribute('aria-checked', 'false');
  await expect(again.getByRole('switch', { name: 'Monthly summary' })).toHaveAttribute('aria-checked', 'false');
  await expect(again.getByRole('switch', { name: 'Shortcut saves' })).toHaveAttribute('aria-checked', 'true');
});
