import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { AppLockProvider, AWAY_LOCK_MS } from '@/contexts/app-lock';

const authenticate = vi.fn();
vi.mock('@/services/biometric.service', () => ({ biometricService: { authenticate: () => authenticate() } }));
const auth = { user: { id: 'u1' } as unknown, biometricEnabled: true, logout: vi.fn() };
vi.mock('@/contexts/auth.context', () => ({ useAuth: () => auth }));

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
};

const renderApp = () => render(<AppLockProvider><p>secret</p></AppLockProvider>);

describe('AppLockProvider', () => {
  beforeEach(() => {
    authenticate.mockReset();
    auth.biometricEnabled = true;
    auth.user = { id: 'u1' };
    vi.useRealTimers();
  });

  it('hides the app until Face ID succeeds', async () => {
    authenticate.mockResolvedValueOnce({ success: false, error: 'cancelled' }).mockResolvedValueOnce({ success: true });
    renderApp();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.getByText('Unlock with Face ID')).toBeInTheDocument();
    await waitFor(() => expect(authenticate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('secret');
  });

  it('does not lock when the lock is off, or when nobody is signed in', () => {
    auth.biometricEnabled = false;
    renderApp();
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('does not lock on a fresh sign-in or when the lock is turned on mid-session', () => {
    auth.user = null;
    const { rerender } = renderApp();
    expect(screen.getByText('secret')).toBeInTheDocument();
    auth.user = { id: 'u1' };
    rerender(<AppLockProvider><p>secret</p></AppLockProvider>);
    expect(screen.getByText('secret')).toBeInTheDocument();

    auth.biometricEnabled = false;
    rerender(<AppLockProvider><p>secret</p></AppLockProvider>);
    expect(screen.getByText('secret')).toBeInTheDocument();
    auth.biometricEnabled = true;
    rerender(<AppLockProvider><p>secret</p></AppLockProvider>);
    expect(screen.getByText('secret')).toBeInTheDocument();
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('re-locks after more than a minute away, not after a short switch', async () => {
    authenticate.mockResolvedValue({ success: true });
    renderApp();
    await screen.findByText('secret');
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now');

    spy.mockReturnValue(now);
    act(() => setHidden(true));
    spy.mockReturnValue(now + 10_000);
    act(() => setHidden(false));
    expect(screen.getByText('secret')).toBeInTheDocument();

    spy.mockReturnValue(now + 20_000);
    act(() => setHidden(true));
    spy.mockReturnValue(now + 20_000 + AWAY_LOCK_MS + 1);
    authenticate.mockResolvedValueOnce({ success: false });
    act(() => setHidden(false));
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    spy.mockRestore();
  });

  it('"Use password instead" signs out', async () => {
    authenticate.mockResolvedValue({ success: false });
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Use password instead' }));
    expect(auth.logout).toHaveBeenCalled();
  });
});
