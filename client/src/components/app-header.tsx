import { Link } from 'react-router-dom';
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
export function AppHeader() {
  const { user } = useAuth();
  return (
    <header className="w-full max-w-[480px] mx-auto px-6 pt-6 pb-2 flex items-center gap-3">
      <Link to="/profile" aria-label="Open profile" className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <UserAvatar user={user} className="size-11" />
      </Link>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{greeting()}</p>
        <p className="text-[19px] font-bold leading-tight truncate">{user?.name}</p>
      </div>
      <ModeToggle />
    </header>
  );
}
