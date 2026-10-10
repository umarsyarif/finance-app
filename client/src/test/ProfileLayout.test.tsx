import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/app-layout';
import { avatarUrl } from '@/components/user-avatar';

vi.mock('@/contexts/auth.context', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Umar Syarif', email: 'u@x.test', createdAt: '2026-10-01T00:00:00Z', avatarUpdatedAt: null }, logout: vi.fn() }),
}));
vi.mock('@/contexts/theme.context', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }));
vi.mock('@/services/secure-storage.service', () => ({ secureStorage: { getItem: () => null, setItem: vi.fn() } }));
vi.mock('@/components/finance/add-transaction-sheet', () => ({ AddTransactionSheet: () => null }));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<p>home</p>} />
          <Route path="/wallets" element={<p>wallets</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe('header placement', () => {
  it('shows greeting, avatar link and theme toggle on Home', () => {
    renderAt('/');
    expect(screen.getByText(/Good (morning|afternoon|evening)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open profile' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument();
  });

  it('shows none of it on other pages', () => {
    renderAt('/wallets');
    expect(screen.queryByText(/Good (morning|afternoon|evening)/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /theme/i })).not.toBeInTheDocument();
  });
});

describe('avatarUrl', () => {
  it('versions the URL by the update time, or is null', () => {
    expect(avatarUrl({ avatarUpdatedAt: null })).toBeNull();
    expect(avatarUrl({ avatarUpdatedAt: '2026-10-11T00:00:00.000Z' })).toBe(`/api/users/me/avatar?v=${Date.parse('2026-10-11T00:00:00.000Z')}`);
  });
});
