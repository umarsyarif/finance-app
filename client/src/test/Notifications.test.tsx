import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import axios from '@/lib/axios';
import Notifications from '@/pages/Notifications';
import { pushStatus } from '@/services/push.service';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/services/push.service', () => ({ pushStatus: vi.fn() }));

const n = (o: object) => ({ title: 'T', body: 'B', url: '/', readAt: null, ...o });
const items = [
  n({ id: 'n1', kind: 'BILL', title: 'Rent due', url: '/?add=bill:b1', createdAt: '2026-10-15T09:30:00+09:00' }),
  n({ id: 'n2', kind: 'NUDGE', title: 'Nothing logged today', url: '/?add=new', createdAt: '2026-10-14T21:00:00+09:00' }),
  n({ id: 'n3', kind: 'SHORTCUT_SAVED', title: 'Saved from Shortcut', url: '/transactions?wallet=w1', createdAt: '2026-10-10T08:00:00+09:00' }),
  n({ id: 'n4', kind: 'MONTHLY_SUMMARY', title: 'September', url: '/?month=2026-09', readAt: '2026-10-10T09:00:00+09:00', createdAt: '2026-10-10T07:00:00+09:00' }),
];
const serve = (list: unknown[], nextCursor: string | null = null, unreadCount = list.filter((i) => !(i as { readAt: unknown }).readAt).length) =>
  vi.mocked(axios.get).mockResolvedValue({ data: { data: { notifications: list, nextCursor, unreadCount } } });
const Probe = () => { const l = useLocation(); return <div data-testid="loc">{l.pathname + l.search}</div>; };
const renderPage = () => render(
  <MemoryRouter initialEntries={['/notifications']}>
    <Probe />
    <Routes><Route path="notifications" element={<Notifications />} /><Route path="*" element={null} /></Routes>
  </MemoryRouter>
);

let trigger: () => void = () => {};
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T10:00:00+09:00'));
  vi.mocked(pushStatus).mockResolvedValue('on');
  globalThis.IntersectionObserver = class { constructor(cb: () => void) { trigger = () => cb(); } observe() {} disconnect() {} } as never;
});
afterEach(() => vi.useRealTimers());

describe('Notifications page', () => {
  it('groups by day and shows the unread count', async () => {
    serve(items);
    renderPage();
    expect(await screen.findByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(screen.getAllByText('Oct 10').length).toBeGreaterThan(0);
    expect(screen.getByText('3 unread')).toBeInTheDocument();
  });

  it('shows each kind action and unread dots', async () => {
    serve(items);
    renderPage();
    for (const a of ['Record payment', 'Add expense', 'View', 'See month']) expect(await screen.findByRole('button', { name: a })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Unread')).toHaveLength(3);
  });

  it('action marks read and navigates', async () => {
    serve(items);
    vi.mocked(axios.post).mockResolvedValue({ data: { data: { unreadCount: 2 } } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Record payment' }));
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/?add=bill:b1'));
    expect(axios.post).toHaveBeenCalledWith('/api/notifications/read', { ids: ['n1'] });
  });

  it('marks all read', async () => {
    serve(items);
    vi.mocked(axios.post).mockResolvedValue({ data: { data: { unreadCount: 0 } } });
    renderPage();
    fireEvent.click(await screen.findByLabelText('Mark all read'));
    await waitFor(() => expect(screen.queryAllByLabelText('Unread')).toHaveLength(0));
    expect(axios.post).toHaveBeenCalledWith('/api/notifications/read', { all: true });
  });

  it('filters with counts', async () => {
    serve(items);
    renderPage();
    expect(await screen.findByRole('radio', { name: /All 4/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Activity 2/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Reminders 2/ }));
    expect(screen.getByText('Rent due')).toBeInTheDocument();
    expect(screen.queryByText('Saved from Shortcut')).not.toBeInTheDocument();
  });

  it('loads the next page at the sentinel', async () => {
    serve(items, 'n4');
    renderPage();
    await screen.findByText('Rent due');
    vi.mocked(axios.get).mockResolvedValue({ data: { data: { notifications: [n({ id: 'n5', kind: 'NUDGE', title: 'Older', createdAt: '2026-10-01T09:00:00+09:00' })], nextCursor: null, unreadCount: 4 } } });
    await act(async () => trigger());
    expect(axios.get).toHaveBeenLastCalledWith('/api/notifications', { params: { cursor: 'n4' } });
    expect(await screen.findByText('Older')).toBeInTheDocument();
  });

  it('empty state with push off', async () => {
    serve([]);
    vi.mocked(pushStatus).mockResolvedValue('off');
    renderPage();
    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
    expect(await screen.findByText('Turn on push in Profile')).toBeInTheDocument();
  });

  it('settings button goes to profile', async () => {
    serve(items);
    renderPage();
    fireEvent.click(await screen.findByLabelText('Notification settings'));
    expect(screen.getByTestId('loc')).toHaveTextContent('/profile');
  });
});
