import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useUnreadCount } from '@/hooks/use-unread-count';
import { ModeToggle } from './mode-toggle';
import { UserAvatar } from './user-avatar';
import { useAuth } from '@/contexts/auth.context';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// Home only: avatar (to Profile), greeting, theme toggle
export function AppHeader({ refreshKey }: { refreshKey: number }) {
  const { user } = useAuth();
  const unread = useUnreadCount(refreshKey);
  return (
    <header className="w-full max-w-[480px] mx-auto px-6 pt-6 pb-2 flex items-center gap-3">
      <Link to="/profile" aria-label="Open profile" className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <UserAvatar user={user} className="size-11" />
      </Link>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{greeting()}</p>
        <p className="text-[19px] font-bold leading-tight truncate">{user?.name}</p>
      </div>
      <Link
        to="/notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative flex size-11 items-center justify-center rounded-full bg-card shadow-resting hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Bell className="size-[1.2rem]" />
        {unread > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-lime" />}
      </Link>
      <ModeToggle />
    </header>
  );
}
