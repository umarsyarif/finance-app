import { RowsCard } from './transactions-list';
import { CategoryIcon } from './category-icon';
import type { CategoryBreakdown, MonthlySummary } from '@/hooks/use-stats';
import { formatAmount } from '@/lib/format-utils';
import { cn } from '@/lib/utils';

function CategoryBars({ title, entries, type, currency }: { title: string; entries: CategoryBreakdown[]; type: 'INCOME' | 'EXPENSE'; currency: string }) {
  if (entries.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <RowsCard>
        {entries.map((entry) => (
          <div key={entry.categoryId} className="space-y-2 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
                  {entry.icon && <CategoryIcon icon={entry.icon} className="size-4 shrink-0 text-muted-foreground" />}
                  {entry.categoryName}
                </p>
                <p className="text-xs text-muted-foreground">{Math.round(entry.percentage)}% of {type === 'INCOME' ? 'income' : 'spending'}</p>
              </div>
              <p className={cn('shrink-0 text-[15px] font-bold tabular-nums', type === 'INCOME' ? 'text-income' : 'text-expense')}>
                {formatAmount(entry.amount, type, currency)}
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', type === 'INCOME' ? 'bg-income' : 'bg-lime')} style={{ width: `${entry.percentage}%` }} />
            </div>
          </div>
        ))}
      </RowsCard>
    </div>
  );
}

// Home section 6: the selected currency's month (income, expense, net) and its top categories
export function CurrencySummary({ currency, monthLabel, summary, expenses, incomes }: {
  currency: string;
  monthLabel: string;
  summary: MonthlySummary | null;
  expenses: CategoryBreakdown[];
  incomes: CategoryBreakdown[];
}) {
  const income = summary?.income ?? 0;
  const expense = summary?.expense ?? 0;
  const empty = income === 0 && expense === 0;
  return (
    <section className="space-y-3">
      <h2 className="px-1 text-[19px] font-bold">Summary</h2>
      <div className="grid grid-cols-3 gap-3 rounded-[24px] bg-card p-5 shadow-resting">
        {[
          { label: 'Income', value: formatAmount(income, 'INCOME', currency), tone: 'text-income' },
          { label: 'Expense', value: formatAmount(expense, 'EXPENSE', currency), tone: 'text-expense' },
          { label: 'Net', value: formatAmount(summary?.balance ?? 0, null, currency), tone: '' },
        ].map((item) => (
          <div key={item.label} className="min-w-0">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={cn('truncate text-[15px] font-bold tabular-nums', item.tone)}>{item.value}</p>
          </div>
        ))}
      </div>
      {empty ? (
        <p className="rounded-[24px] bg-card p-6 text-center text-muted-foreground shadow-resting">No transactions in {monthLabel}</p>
      ) : (
        <>
          <CategoryBars title="Expense" entries={expenses} type="EXPENSE" currency={currency} />
          <CategoryBars title="Income" entries={incomes} type="INCOME" currency={currency} />
        </>
      )}
    </section>
  );
}
