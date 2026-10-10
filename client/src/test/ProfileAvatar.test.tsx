import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Profile from '@/pages/Profile';
import axios from '@/lib/axios';
import { squareAvatar } from '@/lib/image';
import { toast } from 'sonner';

const refreshUser = vi.fn();
let avatarUpdatedAt: string | null = null;

vi.mock('@/contexts/auth.context', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Umar', email: 'u@x.test', createdAt: '2026-10-01T00:00:00Z', avatarUpdatedAt },
    refreshUser, logout: vi.fn(),
  }),
}));
vi.mock('@/contexts/theme.context', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }));
vi.mock('@/services/secure-storage.service', () => ({ secureStorage: { getItem: () => null, setItem: vi.fn() } }));
vi.mock('@/hooks/use-wallets', () => ({ useWallets: () => ({ wallets: [] }) }));
vi.mock('@/components/api-token-settings', () => ({ ApiTokenSettings: () => null }));
vi.mock('@/lib/axios', () => ({ default: { defaults: { baseURL: '' }, put: vi.fn(), delete: vi.fn(), patch: vi.fn(), post: vi.fn() } }));
vi.mock('@/lib/image', () => ({ squareAvatar: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const choose = () =>
  fireEvent.change(screen.getByLabelText('Change photo'), { target: { files: [new File(['x'], 'p.png', { type: 'image/png' })] } });
const renderProfile = () => render(<MemoryRouter><Profile /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  avatarUpdatedAt = null;
  vi.mocked(squareAvatar).mockResolvedValue({ image: 'QUJD', mimeType: 'image/jpeg' });
  vi.mocked(axios.put).mockResolvedValue({});
  vi.mocked(axios.delete).mockResolvedValue({});
});

describe('Profile photo', () => {
  it('uploads the chosen photo then refreshes the user', async () => {
    renderProfile();
    choose();
    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
    expect(axios.put).toHaveBeenCalledWith('/api/users/me/avatar', { image: 'QUJD', mimeType: 'image/jpeg' });
  });

  it('toasts and skips the upload when the image cannot be processed', async () => {
    vi.mocked(squareAvatar).mockRejectedValue(new Error('bad'));
    renderProfile();
    choose();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't update your photo"));
    expect(axios.put).not.toHaveBeenCalled();
  });

  it('removes the photo only when one is set', async () => {
    const { unmount } = renderProfile();
    expect(screen.queryByRole('button', { name: /remove photo/i })).not.toBeInTheDocument();
    unmount();
    avatarUpdatedAt = '2026-10-11T00:00:00.000Z';
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /remove photo/i }));
    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
    expect(axios.delete).toHaveBeenCalledWith('/api/users/me/avatar');
  });
});
