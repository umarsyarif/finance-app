import { useEffect, useRef, useState } from 'react';

// Indicator distance (after resistance) that triggers a refresh on release
export const PULL_THRESHOLD = 70;
const RESISTANCE = 0.5;
const MAX_PULL = 120;

// Touch "pull down at the top of the page" gesture. Ignores pulls that start scrolled down, inside an
// open dialog/sheet, or that turn out mostly horizontal (the wallet card carousel).
export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(onRefresh);
  latest.current = onRefresh;
  const busy = useRef(false);

  useEffect(() => {
    let start: { x: number; y: number } | null = null;
    let vertical: boolean | null = null; // decided on the first move
    let distance = 0;

    const onStart = (e: TouchEvent) => {
      const target = e.target as Element | null;
      if (busy.current || window.scrollY > 0 || target?.closest?.('[role="dialog"]')) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      vertical = null;
      distance = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const dx = e.touches[0].clientX - start.x;
      const dy = e.touches[0].clientY - start.y;
      if (vertical === null) vertical = Math.abs(dy) > Math.abs(dx);
      if (!vertical || dy <= 0) {
        if (!vertical) start = null;
        distance = 0;
        setPull(0);
        return;
      }
      distance = Math.min(dy * RESISTANCE, MAX_PULL);
      setPull(distance);
    };
    const onEnd = async () => {
      if (!start) return;
      start = null;
      setPull(0);
      if (distance < PULL_THRESHOLD) return;
      busy.current = true;
      setRefreshing(true);
      try {
        await latest.current();
      } finally {
        busy.current = false;
        setRefreshing(false);
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return { pull, refreshing };
}
