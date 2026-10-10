import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePullToRefresh, PULL_THRESHOLD } from '@/hooks/use-pull-to-refresh';

const touch = (type: string, x: number, y: number, target: EventTarget = document.body) => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as Event & { touches: { clientX: number; clientY: number }[] };
  Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : [{ clientX: x, clientY: y }] });
  target.dispatchEvent(event);
};

// Drag from (x, y) by (dx, dy) and release
const drag = async (dx: number, dy: number, target?: EventTarget) => {
  await act(async () => {
    touch('touchstart', 100, 100, target);
    touch('touchmove', 100 + dx / 2, 100 + dy / 2, target);
    touch('touchmove', 100 + dx, 100 + dy, target);
    touch('touchend', 0, 0, target);
  });
};

describe('usePullToRefresh', () => {
  beforeEach(() => {
    window.scrollY = 0;
    document.body.innerHTML = '';
  });

  it('refreshes after a downward pull past the threshold at the top of the page', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePullToRefresh(onRefresh));
    await drag(0, PULL_THRESHOLD * 3);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('ignores a short pull', async () => {
    const onRefresh = vi.fn();
    renderHook(() => usePullToRefresh(onRefresh));
    await drag(0, PULL_THRESHOLD);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('ignores pulls when the page is scrolled down', async () => {
    const onRefresh = vi.fn();
    window.scrollY = 300;
    renderHook(() => usePullToRefresh(onRefresh));
    await drag(0, PULL_THRESHOLD * 3);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('ignores mostly-horizontal swipes (wallet card carousel)', async () => {
    const onRefresh = vi.fn();
    renderHook(() => usePullToRefresh(onRefresh));
    await drag(PULL_THRESHOLD * 4, PULL_THRESHOLD * 3);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('ignores pulls that start inside an open dialog', async () => {
    const onRefresh = vi.fn();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);
    renderHook(() => usePullToRefresh(onRefresh));
    await drag(0, PULL_THRESHOLD * 3, dialog);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('reports the pull distance while dragging and resets after release', async () => {
    const { result } = renderHook(() => usePullToRefresh(vi.fn()));
    await act(async () => {
      touch('touchstart', 100, 100);
      touch('touchmove', 100, 160);
    });
    expect(result.current.pull).toBeGreaterThan(0);
    await act(async () => touch('touchend', 0, 0));
    expect(result.current.pull).toBe(0);
  });
});
