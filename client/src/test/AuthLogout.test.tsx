import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from '@/lib/axios';
import { AuthProvider, useAuth } from '@/contexts/auth.context';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), defaults: {} } }));
vi.mock('@/services/biometric.service', () => ({ biometricService: { isSupported: async () => false, isEnabled: () => false } }));
vi.mock('@/hooks/use-offline', () => ({ clearOfflineStorage: vi.fn() }));
vi.mock('@/services/secure-storage.service', () => ({ secureStorage: { clear: vi.fn() } }));
// Real push.service: no service worker registration at all
vi.stubGlobal('navigator', { ...navigator, userAgent: 'x', serviceWorker: { getRegistration: () => Promise.resolve(undefined), ready: new Promise(() => {}) } });

const Out = () => <button onClick={() => useAuthRef.logout()}>out</button>;
let useAuthRef: ReturnType<typeof useAuth>;
const Grab = () => { useAuthRef = useAuth(); return <Out />; };

describe('logout', () => {
  it('still calls the logout endpoint when push has no service worker', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { data: { user: { id: 'u1' } } } });
    render(<AuthProvider><Grab /></AuthProvider>);
    await userEvent.click(await screen.findByText('out'));
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith('/api/auth/logout'));
  });
});
