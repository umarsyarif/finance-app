import { useEffect, useState } from 'react';
import axios from '@/lib/axios';

// Refetches on mount, when refreshKey changes and when the tab becomes visible; errors keep the last value
export function useUnreadCount(refreshKey: number): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let live = true;
    const load = () => axios.get('/api/notifications').then(({ data }) => { if (live) setCount(data.data.unreadCount); }).catch(() => {});
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    load();
    document.addEventListener('visibilitychange', onVisible);
    return () => { live = false; document.removeEventListener('visibilitychange', onVisible); };
  }, [refreshKey]);
  return count;
}
