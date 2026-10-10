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

  it('rolls back an enrollment whose first unlock fails', async () => {
    auth.enableBiometric.mockResolvedValue(true);
    authenticate.mockResolvedValue({ success: false });
    renderProfile();
    fireEvent.click(screen.getByRole('switch', { name: 'Face ID lock' }));
    await waitFor(() => expect(auth.disableBiometric).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith("Couldn't turn on Face ID lock");
  });

  it('keeps the lock when the first unlock works', async () => {
    auth.enableBiometric.mockResolvedValue(true);
    authenticate.mockResolvedValue({ success: true });
    renderProfile();
    fireEvent.click(screen.getByRole('switch', { name: 'Face ID lock' }));
    await waitFor(() => expect(authenticate).toHaveBeenCalled());
    expect(auth.disableBiometric).not.toHaveBeenCalled();
  });

  it('still shows the switch on an unsupported device while the lock is on', () => {
    auth.biometricSupported = false;
    auth.biometricEnabled = true;
    renderProfile();
    expect(screen.getByRole('switch', { name: 'Face ID lock' })).toBeChecked();
  });
});
