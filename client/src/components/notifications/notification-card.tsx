import { ArrowDownLeft, ChartColumn, PencilLine, Receipt } from 'lucide-react';
import type { AppNotification } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';

const KINDS = {
  BILL: { Icon: Receipt, tile: 'bg-muted', action: 'Record payment', dark: true },
  NUDGE: { Icon: PencilLine, tile: 'bg-lime-soft', action: 'Add expense', dark: true },
  SHORTCUT_SAVED: { Icon: ArrowDownLeft, tile: 'bg-muted', action: 'View', dark: false },
  MONTHLY_SUMMARY: { Icon: ChartColumn, tile: 'bg-muted', action: 'See month', dark: false },
} as const;

export function NotificationCard({ item, onOpen }: { item: AppNotification; onOpen: (item: AppNotification) => void }) {
  const { Icon, tile, action, dark } = KINDS[item.kind];
  const time = new Date(item.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <div className="rounded-[24px] bg-card p-5 shadow-resting">
      {/* whole card opens; the action pill below is a separate button so the two never nest */}
      <div onClick={() => onOpen(item)} className="cursor-pointer">
        <div className="flex items-center gap-3">
          <div className={cn('flex size-12 shrink-0 items-center justify-center rounded-[16px]', tile)}><Icon className="size-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-bold">{item.title}</p>
              {!item.readAt && <span aria-label="Unread" className="size-2 shrink-0 rounded-full bg-lime" />}
            </div>
            <p className="text-xs text-muted-foreground">{time}</p>
          </div>
        </div>
        <p className="mt-3 text-[15px] text-muted-foreground">{item.body}</p>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => onOpen(item)}
          className={cn('h-11 rounded-full px-5 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', dark ? 'bg-foreground text-background' : 'bg-muted')}
        >
          {action}
        </button>
      </div>
    </div>
  );
}
