import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { toSlices } from './distribution';
import { formatCurrency } from '@/lib/format-utils';

export function DistributionChart({ holdings, currency }: { holdings: Parameters<typeof toSlices>[0]; currency: string }) {
  const slices = toSlices(holdings);
  if (slices.length === 0) return null;
  return (
    <section aria-label="Distribution" className="space-y-4 rounded-[24px] bg-card p-5 shadow-resting">
      <h2 className="text-[19px] font-bold">Distribution</h2>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" stroke="none" isAnimationActive={false}>
              {slices.map((s) => <Cell key={s.name} fill={s.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2">
        {slices.map((s) => (
          <li key={s.name} className="flex items-center gap-3 text-[15px]">
            <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="flex-1 font-semibold">{s.name}</span>
            <span className="tabular-nums text-muted-foreground">{formatCurrency(s.value, currency)}</span>
            <span className="w-12 text-right font-semibold tabular-nums">{Math.round(s.pct)}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
