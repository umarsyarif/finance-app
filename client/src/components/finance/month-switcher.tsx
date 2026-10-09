import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getPreviousMonth, getNextMonth } from '@/lib/date-utils';

const navButton = 'flex size-11 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring';

// Pill with previous/next month controls around the month label
export function MonthSwitcher({ date, onChange }: { date: Date; onChange: (date: Date) => void }) {
  return (
    <div className="flex items-center justify-between rounded-full bg-card p-1 shadow-resting">
      <button type="button" aria-label="Previous month" onClick={() => onChange(getPreviousMonth(date))} className={navButton}>
        <ChevronLeft className="size-5" />
      </button>
      <span className="text-[15px] font-semibold">{date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
      <button type="button" aria-label="Next month" onClick={() => onChange(getNextMonth(date))} className={navButton}>
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
