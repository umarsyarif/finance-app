import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Profile from '@/pages/Profile';
import { toast } from 'sonner';

const auth = {
  user: { id: 'u1', name: 'Umar', email: 'u@x.test', createdAt: '2026-10-01T00:00:00Z', avatarUpdatedAt: null },
  refreshUser: vi.fn(), logout: vi.fn(),
  biometricEnabled: false, biometricSupported: true,
  enableBiometric: vi.fn(), disableBiometric: vi.fn(),
};
const authenticate = vi.fn();
vi.mock('@/contexts/auth.context', () => ({ useAuth: () => auth }));
vi.mock('@/services/biometric.service', () => ({ biometricService: { authenticate: () => authenticate() } }));
vi.mock('@/contexts/theme.context', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }));
vi.mock('@/services/secure-storage.service', () => ({ secureStorage: { getItem: () => null, setItem: vi.fn() } }));
vi.mock('@/hooks/use-wallets', () => ({ useWallets: () => ({ wallets: [] }) }));
vi.mock('@/components/api-token-settings', () => ({ ApiTokenSettings: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const renderProfile = () => render(<MemoryRouter><Profile /></MemoryRouter>);

describe('Face ID lock switch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.biometricEnabled = false;
    auth.biometricSupported = true;
  });

  it('keeps the lock on when enabling works, without a verify step', async () => {
    auth.enableBiometric.mockResolvedValue(true);
    renderProfile();
    fireEvent.click(screen.getByRole('switch', { name: 'Face ID lock' }));
    await waitFor(() => expect(auth.enableBiometric).toHaveBeenCalled());
    expect(authenticate).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('toasts when enabling fails', async () => {
    auth.enableBiometric.mockResolvedValue(false);
    renderProfile();
    fireEvent.click(screen.getByRole('switch', { name: 'Face ID lock' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't turn on Face ID lock"));
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('disables the switch while enabling is in flight', async () => {
    let done!: (v: boolean) => void;
    auth.enableBiometric.mockReturnValue(new Promise<boolean>((r) => { done = r; }));
    renderProfile();
    const sw = screen.getByRole('switch', { name: 'Face ID lock' });
    fireEvent.click(sw);
    await waitFor(() => expect(sw).toBeDisabled());
    done(true);
    await waitFor(() => expect(sw).toBeEnabled());
  });

  it('reopens Edit profile with the saved values, not stale edits', async () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }));
    fireEvent.change(await screen.findByLabelText('Full Name'), { target: { value: 'Typed' } });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByLabelText('Full Name')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }));
    expect(await screen.findByLabelText('Full Name')).toHaveValue('Umar');
  });

  it('still shows the switch on an unsupported device while the lock is on', () => {
    auth.biometricSupported = false;
    auth.biometricEnabled = true;
    renderProfile();
    expect(screen.getByRole('switch', { name: 'Face ID lock' })).toBeChecked();
  });
});
