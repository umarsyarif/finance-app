import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ChevronLeft, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { FilterChips } from '@/components/finance/filter-chips';
import { NotificationCard } from '@/components/notifications/notification-card';
import { useNotifications, type AppNotification } from '@/hooks/use-notifications';
import { pushStatus, type PushStatus } from '@/services/push.service';

type Filter = 'all' | 'reminders' | 'activity';
const isReminder = (i: AppNotification) => i.kind === 'BILL' || i.kind === 'NUDGE';
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function groupLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (dayKey(d) === dayKey(now)) return 'Today';
  now.setDate(now.getDate() - 1);
  return dayKey(d) === dayKey(now) ? 'Yesterday' : day(iso);
}

const roundBtn = 'flex size-11 items-center justify-center rounded-full bg-card shadow-resting hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export default function Notifications() {
  const navigate = useNavigate();
  const { items, unreadCount, loading, error, hasMore, loadMore, markRead } = useNotifications();
  const [filter, setFilter] = useState<Filter>('all');
  const [push, setPush] = useState<PushStatus | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const more = useRef(loadMore);
  more.current = loadMore;

  useEffect(() => { pushStatus().then(setPush).catch(() => {}); }, []);

  useEffect(() => {
    if (!hasMore || !sentinel.current) return;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) more.current(); });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [hasMore, items.length]);

  const open = (item: AppNotification) => {
    markRead([item.id]).catch(() => toast.error("Couldn't mark as read"));
    navigate(item.url);
  };

  const shown = items.filter((i) => filter === 'all' || (filter === 'reminders') === isReminder(i));
  const groups = useMemo(() => {
    const out: { label: string; date: string; list: AppNotification[] }[] = [];
    for (const i of shown) {
      const label = groupLabel(i.createdAt);
      const last = out[out.length - 1];
      if (last?.label === label) last.list.push(i);
      else out.push({ label, date: day(i.createdAt), list: [i] });
    }
    return out;
  }, [shown]);
  const reminders = items.filter(isReminder).length;

  return (
    <div className="flex flex-col gap-5">
      <Link to="/" className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground"><ChevronLeft className="size-4" />Home</Link>
      <section className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[32px] font-bold leading-[1.1] tracking-[-0.02em]">Notifications</h1>
          <p className="text-sm text-muted-foreground">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" aria-label="Mark all read" onClick={() => markRead('all').catch(() => toast.error("Couldn't mark as read"))} className={roundBtn}><CheckCheck className="size-5" /></button>
          <button type="button" aria-label="Notification settings" onClick={() => navigate('/profile#notifications')} className={roundBtn}><SlidersHorizontal className="size-5" /></button>
        </div>
      </section>
      <FilterChips<Filter>
        label="Filter notifications"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All', count: items.length },
          { value: 'reminders', label: 'Reminders', count: reminders },
          { value: 'activity', label: 'Activity', count: items.length - reminders },
        ]}
      />
      {error && <p role="alert" className="text-sm text-expense">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <Bell className="size-8" />
          <p className="font-semibold text-foreground">No notifications yet</p>
          {push === 'off' && <p className="text-sm">Turn on push in Profile</p>}
        </div>
      )}
      {groups.map((g) => (
        <section key={g.label} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between px-1 text-sm text-muted-foreground">
            <h2 className="font-semibold uppercase tracking-wide">{g.label}</h2>
            <span>{g.date}</span>
          </div>
          {g.list.map((i) => <NotificationCard key={i.id} item={i} onOpen={open} />)}
        </section>
      ))}
      {hasMore && <div ref={sentinel} className="h-4" />}
    </div>
  );
}
