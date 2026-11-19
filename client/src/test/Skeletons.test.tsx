import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from '@/lib/axios';
import { Loading, Bone, SKELETON_DELAY_MS } from '@/components/skeletons';
import Bills from '@/pages/Bills';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('@/hooks/use-wallets', () => ({ useWallets: () => ({ wallets: [] }) }));
vi.mock('@/hooks/use-categories', () => ({ useCategories: () => ({ categories: [] }) }));

describe('Loading', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps its space but stays invisible for the first 200 ms, then shows', () => {
    render(<Loading><Bone className="h-4" /></Loading>);
    const status = screen.getByRole('status', { name: 'Loading' });
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status.className).toContain('invisible');
    act(() => { vi.advanceTimersByTime(SKELETON_DELAY_MS); });
    expect(status.className).not.toContain('invisible');
  });

  it('hides its shapes from screen readers (one "Loading", not every block)', () => {
    const { container } = render(<Loading><Bone /><Bone /></Loading>);
    expect(container.querySelector('[aria-hidden]')?.children).toHaveLength(2);
  });
});

describe('a page loading', () => {
  it('shows the skeleton until the data arrives, then the content', async () => {
    let resolve: (v: unknown) => void = () => {};
    vi.mocked(axios.get).mockReturnValue(new Promise((r) => { resolve = r; }) as never);
    render(<MemoryRouter><Bills /></MemoryRouter>);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByText('No bills yet')).toBeNull();

    await act(async () => resolve({ data: { data: { bills: [] } } }));
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
    expect(screen.getByText('No bills yet')).toBeInTheDocument();
  });
});
