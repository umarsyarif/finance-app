import { useMemo, useState } from 'react';
import { ArrowLeftRight, Search } from 'lucide-react';
import { TransactionDetailsModal } from './transaction-details-modal';
import { FilterChips } from './filter-chips';
import { MonthSwitcher } from './month-switcher';
import { PillButton } from '@/components/page-header';
import { cn } from '@/lib/utils';
import { useTransactions } from '@/hooks/use-transactions';
import { formatAmount } from '@/lib/format-utils';

export interface Transaction {
  id: string;
  title: string;
  description: string;
  date: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  walletId: string;
  categoryId: string;
  wallet?: {
    id: string;
    name: string;
    currency: string;
  };
  category?: {
    id: string;
    name: string;
  };
  transferId?: string | null;
  transfer?: {
    id: string;
    note: string | null;
    transactions: { id: string; amount: number; wallet: { id: string; name: string; currency: string } }[];
  } | null;
}

// The other side of a transfer row (undefined for ordinary rows)
export const counterpart = (t: Transaction) => t.transfer?.transactions.find((x) => x.id !== t.id);

export type TypeFilter = 'ALL' | 'INCOME' | 'EXPENSE';

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// Row from DESIGN.md "Transaction Row": tile, description + meta, signed amount
export function TransactionRow({ transaction, onClick, showDate = false }: {
  transaction: Transaction;
  onClick: () => void;
  showDate?: boolean;
}) {
  const income = transaction.type === 'INCOME';
  const isTransfer = Boolean(transaction.transferId);
  const when = showDate ? `${shortDate(transaction.date)}, ${time(transaction.date)}` : time(transaction.date);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
    >
      <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-muted text-base font-semibold">
        {isTransfer ? <ArrowLeftRight className="size-5" /> : transaction.category?.name?.charAt(0).toUpperCase() ?? '?'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{transaction.description}</span>
        <span className="block truncate text-xs text-muted-foreground">{isTransfer ? 'Transfer' : transaction.category?.name} · {when}</span>
      </span>
      <span className={cn('shrink-0 text-[15px] font-bold tabular-nums', isTransfer ? 'text-foreground' : income ? 'text-income' : 'text-expense')}>
        {formatAmount(transaction.amount, transaction.type, transaction.wallet?.currency)}
      </span>
    </button>
  );
}

// A card of rows separated by inset hairlines; never nested in another card
export function RowsCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-[24px] bg-card px-5 py-1 shadow-resting [&>*+*]:border-t [&>*+*]:border-border', className)}>
      {children}
    </div>
  );
}

export function typeCounts(transactions: Transaction[]) {
  const plain = transactions.filter((t) => !t.transferId);
  const income = plain.filter((t) => t.type === 'INCOME').length;
  return { ALL: transactions.length, INCOME: income, EXPENSE: plain.length - income };
}

export const typeOptions = (counts: Record<TypeFilter, number>) => [
  { value: 'ALL' as const, label: 'All', count: counts.ALL },
  { value: 'INCOME' as const, label: 'Income', count: counts.INCOME },
  { value: 'EXPENSE' as const, label: 'Expense', count: counts.EXPENSE },
];

interface TransactionsListProps {
  walletId?: string;
  month: number;
  year: number;
  currentDate: Date;
  onMonthChange: (date: Date) => void;
  limit?: number;
  refreshKey?: number;
  onTransactionChange?: () => void;
}

// The Transactions page body: month switcher, search, type chips, rows grouped by day
export function TransactionsList({ walletId, month, year, currentDate, onMonthChange, limit = 100, refreshKey, onTransactionChange }: TransactionsListProps) {
  const { transactions, loading, error, refetch, loadMore, loadingMore, hasMore } = useTransactions({ limit, month, year, refreshKey, walletId });
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<TypeFilter>('ALL');

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? transactions.filter((t) => `${t.description} ${t.category?.name ?? ''}`.toLowerCase().includes(q))
      : transactions;
  }, [transactions, query]);
  const visible = type === 'ALL' ? searched : searched.filter((t) => t.type === type && !t.transferId);

  // Group by local calendar day, newest first (API order)
  const days = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const t of visible) {
      const key = new Date(t.date).toDateString();
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    return [...groups.entries()];
  }, [visible]);

  const changed = () => {
    setSelected(null);
    refetch();
    onTransactionChange?.();
  };

  const dayLabel = (key: string) => {
    const d = new Date(key);
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    if (d.toDateString() === today.toDateString()) return `Today, ${shortDate(key)}`;
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${shortDate(key)}`;
    return label;
  };

  return (
    <div className="space-y-6">
      <MonthSwitcher date={currentDate} onChange={onMonthChange} />

      <label className="flex h-[52px] items-center gap-3 rounded-[20px] bg-card px-[18px] shadow-resting focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
        <Search aria-hidden className="size-[18px] text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this month"
          aria-label="Search this month"
          className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
        />
      </label>

      <FilterChips label="Transaction type" options={typeOptions(typeCounts(searched))} value={type} onChange={setType} />

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        </div>
      ) : error && transactions.length === 0 ? (
        <div className="space-y-4 py-8 text-center">
          <p className="text-expense">{error}</p>
          <PillButton onClick={refetch}>Try again</PillButton>
        </div>
      ) : days.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {transactions.length === 0 ? 'No transactions this month.' : 'Nothing matches.'}
        </p>
      ) : (
        <div className="space-y-6">
          {days.map(([key, rows]) => (
            <section key={key} className="space-y-2">
              <div className="flex justify-between px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <h2>{dayLabel(key)}</h2>
                <span className="normal-case tracking-normal">{rows.length} {rows.length === 1 ? 'transaction' : 'transactions'}</span>
              </div>
              <RowsCard>
                {rows.map((t) => <TransactionRow key={t.id} transaction={t} onClick={() => setSelected(t)} />)}
              </RowsCard>
            </section>
          ))}
          {hasMore && (
            <PillButton className="w-full justify-center" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </PillButton>
          )}
          {error && <p className="text-center text-sm text-muted-foreground">{error}</p>}
        </div>
      )}

      {selected && (
        <TransactionDetailsModal
          transaction={selected}
          isOpen={!!selected}
          onClose={() => setSelected(null)}
          onUpdate={changed}
          onDelete={changed}
        />
      )}
    </div>
  );
}
