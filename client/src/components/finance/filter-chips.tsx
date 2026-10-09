import { cn } from '@/lib/utils';

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

// Pill filters with a count bubble; selected uses Lime Mist (DESIGN.md "Chips")
export function FilterChips<T extends string>({ options, value, onChange, label, className }: {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('-mx-6 flex gap-2 overflow-x-auto px-6 pb-1', className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-11 shrink-0 items-center gap-2 rounded-full pl-4 text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              option.count === undefined ? 'pr-4' : 'pr-1.5',
              selected ? 'bg-lime-soft font-semibold text-foreground' : 'bg-card text-muted-foreground shadow-resting hover:text-foreground'
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={cn('min-w-8 rounded-full px-2 py-1.5 text-xs font-semibold tabular-nums', selected ? 'bg-card' : 'bg-muted')}>
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
