import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from '@/lib/axios';
import { NotificationSettings } from '@/components/notification-settings';
import { pushStatus, subscribePush } from '@/services/push.service';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), put: vi.fn(), defaults: {} } }));
vi.mock('@/services/push.service', () => ({
  pushStatus: vi.fn(), subscribePush: vi.fn(), unsubscribePush: vi.fn(),
  BLOCKED: 'Notifications are blocked — allow them in Settings → Finance',
}));

const base = { nudgeEnabled: true, nudgeTime: '21:00', timezone: 'Asia/Seoul', shortcutEnabled: true, monthlySummaryEnabled: true };
const tz = (zone: string) => vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: zone } as Intl.ResolvedDateTimeFormatOptions);

describe('NotificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tz('Asia/Seoul');
    vi.mocked(pushStatus).mockResolvedValue('off');
    vi.mocked(axios.get).mockResolvedValue({ data: { data: { settings: base } } });
    vi.mocked(axios.put).mockImplementation(async (_u, body) => ({ data: { data: { settings: { ...base, ...(body as object) } } } }));
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders the stored settings', async () => {
    render(<NotificationSettings />);
    expect(((await screen.findByLabelText('Daily reminder')) as HTMLElement).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByLabelText('Reminder time') as HTMLInputElement).value).toBe('21:00');
    expect(screen.getByLabelText('Shortcut saves').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText('Monthly summary').getAttribute('aria-checked')).toBe('true');
  });

  it('saves toggles and the time on blur', async () => {
    render(<NotificationSettings />);
    await userEvent.click(await screen.findByLabelText('Daily reminder'));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith('/api/notifications/settings', { nudgeEnabled: false }));
    await userEvent.click(await screen.findByLabelText('Daily reminder'));
    const time = await screen.findByLabelText('Reminder time');
    fireEvent.change(time, { target: { value: '20:30' } });
    fireEvent.blur(time);
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith('/api/notifications/settings', { nudgeTime: '20:30' }));
  });

  it('syncs a changed timezone once, and not when equal', async () => {
    tz('Asia/Jakarta');
    const { unmount } = render(<NotificationSettings />);
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith('/api/notifications/settings', { timezone: 'Asia/Jakarta' }));
    expect(axios.put).toHaveBeenCalledTimes(1);
    unmount();
    vi.mocked(axios.put).mockClear();
    tz('Asia/Seoul');
    render(<NotificationSettings />);
    await screen.findByLabelText('Daily reminder');
    expect(axios.put).not.toHaveBeenCalled();
  });

  it('shows push hints and enables push', async () => {
    vi.mocked(pushStatus).mockResolvedValue('needs-install');
    const a = render(<NotificationSettings />);
    expect(await screen.findByText('Add to Home Screen to get push')).toBeTruthy();
    a.unmount();
    vi.mocked(pushStatus).mockResolvedValue('denied');
    const b = render(<NotificationSettings />);
    expect(await screen.findByText('Notifications are blocked — allow them in Settings → Finance')).toBeTruthy();
    b.unmount();
    vi.mocked(pushStatus).mockResolvedValue('off');
    vi.mocked(subscribePush).mockResolvedValueOnce(undefined);
    render(<NotificationSettings />);
    await userEvent.click(await screen.findByRole('button', { name: 'Enable push' }));
    expect((await screen.findByLabelText('Push on this device')).getAttribute('aria-checked')).toBe('true');
  });

  it('shows a subscribe error', async () => {
    vi.mocked(subscribePush).mockRejectedValueOnce(new Error('nope'));
    render(<NotificationSettings />);
    await userEvent.click(await screen.findByRole('button', { name: 'Enable push' }));
    expect((await screen.findByRole('alert')).textContent).toBe('nope');
  });
});
