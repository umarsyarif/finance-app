import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import axios from '@/lib/axios';
import { useNotifications } from '@/hooks/use-notifications';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

describe('useNotifications', () => {
  it('fetches one extra page when loadMore is called twice before it resolves', async () => {
    const page = (nextCursor: string | null) => ({ data: { data: { notifications: [], nextCursor, unreadCount: 0 } } });
    vi.mocked(axios.get).mockResolvedValueOnce(page('c1'));
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    let release: (v: unknown) => void = () => {};
    vi.mocked(axios.get).mockReturnValueOnce(new Promise((r) => { release = r; }) as never);
    await act(async () => { result.current.loadMore(); result.current.loadMore(); });
    expect(axios.get).toHaveBeenCalledTimes(2);
    await act(async () => { release(page(null)); });
  });
});
