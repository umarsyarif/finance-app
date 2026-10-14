import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import axios from '@/lib/axios';
import { AppHeader } from '@/components/app-header';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('@/contexts/auth.context', () => ({ useAuth: () => ({ user: { name: 'U' } }) }));
vi.mock('@/components/mode-toggle', () => ({ ModeToggle: () => null }));
vi.mock('@/components/user-avatar', () => ({ UserAvatar: () => null }));

const count = (unreadCount: number) => vi.mocked(axios.get).mockResolvedValue({ data: { data: { notifications: [], nextCursor: null, unreadCount } } });
const Probe = () => <div data-testid="loc">{useLocation().pathname}</div>;
const renderHeader = () => render(<MemoryRouter><Probe /><AppHeader refreshKey={0} /></MemoryRouter>);

describe('header bell', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows unread count and dot, links to /notifications', async () => {
    count(2);
    renderHeader();
    const bell = await screen.findByRole('link', { name: 'Notifications, 2 unread' });
    expect(bell.querySelector('.bg-lime')).not.toBeNull();
    fireEvent.click(bell);
    expect(screen.getByTestId('loc')).toHaveTextContent('/notifications');
  });

  it('no dot at zero', async () => {
    count(0);
    renderHeader();
    const bell = await screen.findByRole('link', { name: 'Notifications' });
    expect(bell.querySelector('.bg-lime')).toBeNull();
  });

  it('refetches when the tab becomes visible', async () => {
    count(0);
    renderHeader();
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
  });
});
