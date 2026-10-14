import { useCallback, useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import axios from '@/lib/axios';

export interface AppNotification {
  id: string;
  kind: 'NUDGE' | 'BILL' | 'SHORTCUT_SAVED' | 'MONTHLY_SUMMARY';
  title: string;
  body: string;
  url: string;
  readAt: string | null;
  createdAt: string;
}

export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (after?: string) => {
    try {
      const { data } = await axios.get('/api/notifications', after ? { params: { cursor: after } } : undefined);
      setItems((prev) => (after ? [...prev, ...data.data.notifications] : data.data.notifications));
      setCursor(data.data.nextCursor);
      setUnreadCount(data.data.unreadCount);
      setError(null);
    } catch (err) {
      setError((err instanceof AxiosError && err.response?.data?.message) || "Couldn't load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadMore = useCallback(async () => { if (cursor) await load(cursor); }, [cursor, load]);

  const markRead = useCallback(async (ids: string[] | 'all') => {
    const { data } = await axios.post('/api/notifications/read', ids === 'all' ? { all: true } : { ids });
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => (ids === 'all' || ids.includes(i.id)) && !i.readAt ? { ...i, readAt: now } : i));
    setUnreadCount(data.data.unreadCount);
  }, []);

  return { items, unreadCount, loading, error, hasMore: cursor !== null, loadMore, markRead };
}
