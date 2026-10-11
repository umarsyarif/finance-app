import { CurrencyToggle } from '@/components/finance/currency-toggle';
import { DistributionChart } from '@/components/assets/distribution-chart';
import { PageTitle } from '@/components/page-header';
import { useAppShell } from '@/components/app-layout';
import { usePortfolio } from '@/hooks/use-portfolio';
import { formatCurrency } from '@/lib/format-utils';
import { cn } from '@/lib/utils';

export default function Assets() {
  const { selectedCurrency, setSelectedCurrency, dataVersion } = useAppShell();
  const currency = selectedCurrency ?? 'KRW';
  const { data, loading, error } = usePortfolio(currency, dataVersion);
  const { total } = data ?? {};
  const gain = total?.gain ?? null;

  return (
    <>
      <PageTitle eyebrow="Portfolio" title="Assets" />
      <div className="space-y-4">
        <CurrencyToggle currencies={['KRW', 'IDR']} value={currency} onChange={setSelectedCurrency} />

        {!data && error && <p role="alert" className="py-10 text-center text-muted-foreground">{error}</p>}
        {!data && !error && loading && <p className="py-10 text-center text-muted-foreground">Loading…</p>}

        {data && total && (
          <>
            <section aria-label="Total assets" className="space-y-1 rounded-[24px] bg-card p-5 shadow-resting">
              <p className="text-xs text-muted-foreground">Total assets</p>
              <p className="text-[32px] font-bold tabular-nums">{formatCurrency(total.value, currency)}</p>
              {gain !== null && total.gainPct !== null && (
                <p className={cn('text-sm font-semibold tabular-nums', gain >= 0 ? 'text-income' : 'text-expense')}>
                  {gain >= 0 ? '+' : '−'}{formatCurrency(Math.abs(gain), currency)} ({total.gainPct.toFixed(1)}%)
                </p>
              )}
              {data.stale && <p className="text-xs text-muted-foreground">Prices may be out of date</p>}
            </section>

            <DistributionChart holdings={data.holdings} currency={currency} />

            {data.holdings.length === 0 && !data.sources.binance.connected && (
              <p className="py-6 text-center text-muted-foreground">Add your first asset</p>
            )}
            {/* Task 7/8: one AssetClassCard per ASSET_CLASS_UI entry */}
          </>
        )}
      </div>
    </>
  );
}
