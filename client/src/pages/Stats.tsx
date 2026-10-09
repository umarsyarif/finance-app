import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStats } from '@/hooks/use-stats';
import { useWallets } from '@/hooks/use-wallets';
import { useTheme } from '@/contexts/theme.context';
import { useAppShell } from '@/components/app-layout';
import { PageTitle } from '@/components/page-header';
import { MonthSwitcher } from '@/components/finance/month-switcher';
import { RowsCard } from '@/components/finance/transactions-list';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatAmount, formatCurrency } from '@/lib/format-utils';
import { formatDateForDateInput, getStartOfMonth, getEndOfMonth } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

// Chart colors come from the theme tokens (SVG attributes can't read CSS variables)
function useTokenColors() {
  const { theme } = useTheme();
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const get = (name: string) => css.getPropertyValue(name).trim();
    return { income: get('--income'), expense: get('--expense'), grid: get('--border'), muted: get('--muted-foreground') };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}

export default function Stats() {
  const [month, setMonth] = useState(() => new Date());
  const [walletId, setWalletId] = useState<string>();
  const { wallets, getMainWallet } = useWallets();
  const { dataVersion } = useAppShell();
  const colors = useTokenColors();

  useEffect(() => {
    if (!walletId && wallets.length > 0) setWalletId((getMainWallet() ?? wallets[0]).id);
  }, [wallets, walletId, getMainWallet]);

  const y = month.getFullYear();
  const m = month.getMonth() + 1;
  const filters = useMemo(() => ({
    startDate: formatDateForDateInput(getStartOfMonth(y, m)),
    endDate: formatDateForDateInput(getEndOfMonth(y, m)),
    walletIds: walletId ? [walletId] : undefined,
    refreshKey: dataVersion,
  }), [y, m, walletId, dataVersion]);
  const { monthlySummary, categoryBreakdown, trendData, loading, error } = useStats(filters);

  const currency = wallets.find((w) => w.id === walletId)?.currency ?? 'KRW';
  const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  const net = monthlySummary?.balance ?? 0;

  return (
    <>
      <PageTitle eyebrow="Insights" title="Stats" />

      <div className="space-y-3">
        <MonthSwitcher date={month} onChange={setMonth} />
        {wallets.length > 1 && (
          <Select value={walletId} onValueChange={(value) => value && setWalletId(value)}>
            <SelectTrigger aria-label="Wallet" className="h-11 w-full rounded-full border-0 bg-card px-[18px] text-[15px] font-semibold shadow-resting">
              <SelectValue placeholder="Wallet" />
            </SelectTrigger>
            <SelectContent>
              {wallets.map((w) => <SelectItem key={w.id} value={w.id}>{w.name} · {w.currency}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <p className="py-12 text-center text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="py-12 text-center text-expense">{error}</p>
      ) : (
        <div className="mt-6 space-y-6">
          <section aria-label="Monthly summary" className="space-y-4 rounded-[24px] bg-card p-5 shadow-resting">
            <div>
              <p className="text-xs text-muted-foreground">Net this month</p>
              <p className="text-2xl font-bold tabular-nums">{formatAmount(net, null, currency)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
              {[
                { label: 'Income', value: formatAmount(monthlySummary?.income ?? 0, 'INCOME', currency), tone: 'text-income' },
                { label: 'Expense', value: formatAmount(monthlySummary?.expense ?? 0, 'EXPENSE', currency), tone: 'text-expense' },
              ].map((item) => (
                <div key={item.label} className="min-w-0">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className={cn('text-[15px] font-bold tabular-nums', item.tone)}>{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="px-1 text-[19px] font-bold">Where it went</h2>
            {categoryBreakdown.length === 0 ? (
              <p className="rounded-[24px] bg-card p-6 text-center text-muted-foreground shadow-resting">No expenses this month.</p>
            ) : (
              <RowsCard>
                {categoryBreakdown.map((entry) => (
                  <div key={entry.categoryId} className="space-y-2 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold">{entry.categoryName}</p>
                        <p className="text-xs text-muted-foreground">{Math.round(entry.percentage)}% of spending</p>
                      </div>
                      <p className="shrink-0 text-[15px] font-bold tabular-nums text-expense">{formatAmount(entry.amount, 'EXPENSE', currency)}</p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-lime" style={{ width: `${entry.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </RowsCard>
            )}
          </section>

          <section className="space-y-3 rounded-[24px] bg-card p-5 shadow-resting">
            <div>
              <h2 className="text-[19px] font-bold">{y} by month</h2>
              <p className="text-xs text-muted-foreground">
                <span className="text-income">Income</span> and <span className="text-expense">expense</span>
              </p>
            </div>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendData} margin={{ left: -12, right: 0, top: 8 }} barGap={2}>
                  <CartesianGrid vertical={false} stroke={colors.grid} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: colors.muted }} interval={0} tickFormatter={(v: string) => v.charAt(0)} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: colors.muted }} tickFormatter={(v) => compact.format(Number(v))} />
                  <Tooltip cursor={{ fill: colors.grid, opacity: 0.4 }} formatter={(value) => formatCurrency(Number(value), currency)} />
                  <Bar dataKey="income" name="Income" fill={colors.income} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Expense" fill={colors.expense} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-muted-foreground">No data yet.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
