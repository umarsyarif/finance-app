import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TrendData } from '@/hooks/use-stats';
import { useTokenColors } from '@/lib/chart-colors';
import { formatCurrency } from '@/lib/format-utils';

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

// The selected month's bars stay solid; the rest fade so the month stands out
export const barOpacity = (month: number, highlightMonth: number) => (month === highlightMonth ? 1 : 0.35);

// Home section 7: Jan–Dec income vs expense for the selected currency
export function YearChart({ year, data, currency, highlightMonth }: { year: number; data: TrendData[]; currency: string; highlightMonth: number }) {
  const colors = useTokenColors();
  return (
    <section className="space-y-3 rounded-[24px] bg-card p-5 shadow-resting">
      <div>
        <h2 className="text-[19px] font-bold">{year} by month</h2>
        <p className="text-xs text-muted-foreground">
          <span className="text-income">Income</span> and <span className="text-expense">expense</span>
        </p>
      </div>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ left: -12, right: 0, top: 8 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={colors.grid} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: colors.muted }} interval={0} tickFormatter={(v: string) => v.charAt(0)} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: colors.muted }} tickFormatter={(v) => compact.format(Number(v))} />
            <Tooltip cursor={{ fill: colors.grid, opacity: 0.4 }} formatter={(value) => formatCurrency(Number(value), currency)} />
            <Bar dataKey="income" name="Income" fill={colors.income} radius={[4, 4, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fillOpacity={barOpacity(i + 1, highlightMonth)} />)}
            </Bar>
            <Bar dataKey="expense" name="Expense" fill={colors.expense} radius={[4, 4, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fillOpacity={barOpacity(i + 1, highlightMonth)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="py-8 text-center text-muted-foreground">No data yet.</p>
      )}
    </section>
  );
}
