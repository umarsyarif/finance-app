import { cn } from '@/lib/utils';
import axios from '@/lib/axios';

type AvatarUser = { name?: string; avatarUpdatedAt?: string | null };

// Same-origin in production; prefixed with the API base in dev
export const avatarUrl = (user: Pick<AvatarUser, 'avatarUpdatedAt'>) =>
  user.avatarUpdatedAt ? `/api/users/me/avatar?v=${Date.parse(user.avatarUpdatedAt)}` : null;

const initials = (name = '') => name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2) || 'U';

// Profile photo, or the user's initials on lime when there is none
export function UserAvatar({ user, className }: { user: AvatarUser | null; className?: string }) {
  const src = user && avatarUrl(user);
  return (
    <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-lime-soft text-sm font-semibold text-foreground', className)}>
      {src ? <img src={`${axios.defaults.baseURL ?? ''}${src}`} alt="" className="size-full object-cover" /> : initials(user?.name)}
    </span>
  );
}
