import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { WalletCards } from '@/components/finance/wallet-cards';
import { RowsCard, TransactionRow, type Transaction } from '@/components/finance/transactions-list';
import { TransactionDetailsModal } from '@/components/finance/transaction-details-modal';
import { MonthSwitcher } from '@/components/finance/month-switcher';
import { CurrencyToggle } from '@/components/finance/currency-toggle';
import { CurrencySummary } from '@/components/finance/currency-summary';
import { YearChart } from '@/components/finance/year-chart';
import { PageTitle, PillButton } from '@/components/page-header';
import { useAppShell } from '@/components/app-layout';
import { useWallets } from '@/hooks/use-wallets';
import { useTransactions } from '@/hooks/use-transactions';
import { useStats } from '@/hooks/use-stats';
import { currenciesOf, resolveCurrency, resolveWalletId } from '@/lib/selection';
import { formatAmount } from '@/lib/format-utils';
import { formatDateForDateInput, getStartOfMonth, getEndOfMonth } from '@/lib/date-utils';

const LATEST = 5;

// Home: one currency at a time (toggle), its wallets, newest activity, and the chosen month's summary
export default function Dashboard() {
  const navigate = useNavigate();
  const { selectedWalletId, setSelectedWalletId, selectedCurrency, setSelectedCurrency, dataVersion, notifyDataChanged } = useAppShell();
  const { wallets, loading: walletsLoading, error: walletsError, refetch } = useWallets();
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState<Transaction | null>(null);

  useEffect(() => {
    if (dataVersion) refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion]);

  const currency = resolveCurrency(wallets, selectedCurrency);
  const inCurrency = wallets.filter((w) => w.currency === currency);
  const walletIds = inCurrency.map((w) => w.id);
  const ready = walletIds.length > 0;
  const total = inCurrency.reduce((sum, w) => sum + Number(w.balance), 0);

  const { transactions: latest, loading: latestLoading } = useTransactions({ walletIds, limit: LATEST, refreshKey: dataVersion, enabled: ready });

  const y = month.getFullYear();
  const m = month.getMonth() + 1;
  const filters = useMemo(() => ({
    startDate: formatDateForDateInput(getStartOfMonth(y, m)),
    endDate: formatDateForDateInput(getEndOfMonth(y, m)),
    walletIds,
    refreshKey: dataVersion,
    enabled: ready,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [y, m, walletIds.join(','), dataVersion, ready]);
  const { monthlySummary, categoryBreakdown, incomeBreakdown, trendData, loading: statsLoading, error: statsError } = useStats(filters);
  const noStats = !monthlySummary && trendData.length === 0;
  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const openWallet = (walletId: string) => {
    setSelectedWalletId(walletId);
    navigate('/transactions');
  };
  // Open a wallet of Home's currency: keep the shell's selection if it is one, else that currency's default
  const seeAll = () => openWallet(walletIds.includes(selectedWalletId ?? '') ? selectedWalletId! : resolveWalletId(inCurrency)!);
  const changed = () => {
    setSelected(null);
    notifyDataChanged();
  };

  return (
    <>
      <PageTitle eyebrow="Overview" title="Home" />

      {wallets.length === 0 && walletsLoading ? (
        <div className="h-40 animate-pulse rounded-[24px] bg-card" />
      ) : walletsError && wallets.length === 0 ? (
        <div className="space-y-3 text-center">
          <p className="text-expense">{walletsError}</p>
          <PillButton onClick={refetch}>Try again</PillButton>
        </div>
      ) : wallets.length === 0 || !currency ? (
        <WalletCards onOpen={openWallet} refreshKey={dataVersion} />
      ) : (
        <div className="space-y-6">
          <CurrencyToggle currencies={currenciesOf(wallets)} value={currency} onChange={setSelectedCurrency} />

          <section aria-label="Total" className="rounded-[24px] bg-card p-5 shadow-resting">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold tabular-nums">{formatAmount(total, null, currency)}</p>
            <p className="text-xs text-muted-foreground">{inCurrency.length} {inCurrency.length === 1 ? 'wallet' : 'wallets'}</p>
          </section>

          <WalletCards walletIds={walletIds} selectedWalletId={selectedWalletId} onOpen={openWallet} refreshKey={dataVersion} />

          <section className="space-y-2">
            <h2 className="px-1 text-[19px] font-bold">Latest</h2>
            {latestLoading ? (
              <div className="h-40 animate-pulse rounded-[24px] bg-card" />
            ) : latest.length === 0 ? (
              <p className="rounded-[24px] bg-card p-6 text-center text-muted-foreground shadow-resting">No transactions yet. Tap + to add one.</p>
            ) : (
              <RowsCard>
                {latest.map((t) => <TransactionRow key={t.id} transaction={t} showDate onClick={() => setSelected(t)} />)}
              </RowsCard>
            )}
            <PillButton className="w-full justify-center" onClick={seeAll}>
              See all transactions <ArrowRight />
            </PillButton>
          </section>

          <MonthSwitcher date={month} onChange={setMonth} />
          {statsLoading ? (
            <div className="h-40 animate-pulse rounded-[24px] bg-card" />
          ) : statsError && noStats ? (
            <p className="text-center text-expense">{statsError}</p>
          ) : (
            <>
              <CurrencySummary currency={currency} monthLabel={monthLabel} summary={monthlySummary} expenses={categoryBreakdown} incomes={incomeBreakdown} />
              <YearChart year={y} data={trendData} currency={currency} highlightMonth={m} />
            </>
          )}
        </div>
      )}

      {selected && (
        <TransactionDetailsModal transaction={selected} isOpen={!!selected} onClose={() => setSelected(null)} onUpdate={changed} onDelete={changed} />
      )}
    </>
  );
}
