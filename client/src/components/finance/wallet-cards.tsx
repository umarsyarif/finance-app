import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Wallet as WalletIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWallets } from '@/hooks/use-wallets';
import axios from '@/lib/axios';
import { getStartOfMonth, getEndOfMonth } from '@/lib/date-utils';
import { formatAmount } from '@/lib/format-utils';
import { cn } from '@/lib/utils';
import { PillButton } from '@/components/page-header';

type MonthStats = { income: number; expense: number };

interface WalletCardsProps {
  selectedWalletId?: string;
  onSelect: (walletId: string) => void;
  refreshKey?: number;
}

const LONG_PRESS_MS = 500;

// Horizontal snap row of wallet cards (DESIGN.md "Wallet Card"); the card in view is the selected wallet
export function WalletCards({ selectedWalletId, onSelect, refreshKey }: WalletCardsProps) {
  const { wallets, loading, error, refetch, setMainWallet } = useWallets();
  const [stats, setStats] = useState<Record<string, MonthStats>>({});
  const scroller = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<number>(undefined);

  useEffect(() => {
    if (refreshKey) refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Default selection: the main wallet (or the first one)
  useEffect(() => {
    if (wallets.length === 0) return;
    const current = wallets.find((w) => w.id === selectedWalletId) ?? wallets.find((w) => w.isMain) ?? wallets[0];
    if (current.id !== selectedWalletId) onSelect(current.id);
    const index = wallets.indexOf(current);
    const el = scroller.current?.children[index] as HTMLElement | undefined;
    if (el && scroller.current) scroller.current.scrollLeft = el.offsetLeft - scroller.current.offsetLeft - 24;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets]);

  // This month's income and expense per wallet
  useEffect(() => {
    const now = new Date();
    const params = {
      startDate: getStartOfMonth(now.getFullYear(), now.getMonth() + 1).toISOString(),
      endDate: getEndOfMonth(now.getFullYear(), now.getMonth() + 1).toISOString(),
      limit: 1000,
    };
    Promise.all(
      wallets.map(async (wallet) => {
        try {
          const { data } = await axios.get('/api/transactions', { params: { ...params, walletId: wallet.id } });
          const totals: MonthStats = { income: 0, expense: 0 };
          for (const t of data.data.transactions) {
            if (t.category.type === 'INCOME') totals.income += t.amount;
            else totals.expense += t.amount;
          }
          return [wallet.id, totals] as const;
        } catch {
          return [wallet.id, { income: 0, expense: 0 }] as const;
        }
      })
    ).then((entries) => setStats(Object.fromEntries(entries)));
  }, [wallets]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el || el.children.length === 0) return;
    const step = (el.children[0] as HTMLElement).offsetWidth + 12;
    const wallet = wallets[Math.min(wallets.length - 1, Math.round(el.scrollLeft / step))];
    if (wallet && wallet.id !== selectedWalletId) onSelect(wallet.id);
  };

  const makeMain = async (walletId: string) => {
    if (wallets.find((w) => w.id === walletId)?.isMain) return;
    await setMainWallet(walletId);
  };
  const startPress = (walletId: string) => {
    pressTimer.current = window.setTimeout(() => makeMain(walletId), LONG_PRESS_MS);
  };
  const cancelPress = () => window.clearTimeout(pressTimer.current);

  if (loading && wallets.length === 0) {
    return <div className="h-[212px] animate-pulse rounded-[24px] bg-card" />;
  }
  if (error) {
    return (
      <div className="space-y-4 rounded-[24px] bg-card p-6 text-center">
        <p className="text-expense">{error}</p>
        <PillButton onClick={refetch}>Try again</PillButton>
      </div>
    );
  }
  if (wallets.length === 0) {
    return (
      <div className="space-y-4 rounded-[24px] bg-card p-6 text-center shadow-resting">
        <p className="text-muted-foreground">No wallets found. Create your first wallet to get started!</p>
        <Link to="/wallets"><PillButton className="bg-muted">Add a wallet</PillButton></Link>
      </div>
    );
  }

  return (
    <div
      ref={scroller}
      onScroll={onScroll}
      className="-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-6 px-6 pb-2 [scrollbar-width:none]"
    >
      {wallets.map((wallet) => {
        const s = stats[wallet.id] ?? { income: 0, expense: 0 };
        const pct = s.income > 0 ? Math.round((s.expense / s.income) * 100) : null;
        const over = pct !== null ? pct > 100 : s.expense > 0;
        const caption =
          pct !== null ? (over ? 'Spent more than earned' : `${pct}% of income spent`)
          : s.expense > 0 ? 'No income this month' : 'No activity this month';
        const count = wallet._count?.transactions ?? 0;
        return (
          <article
            key={wallet.id}
            aria-label={wallet.name}
            aria-current={wallet.id === selectedWalletId}
            onPointerDown={() => startPress(wallet.id)}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            onDoubleClick={() => makeMain(wallet.id)}
            className="w-[calc(100%-24px)] shrink-0 snap-start select-none space-y-4 rounded-[24px] bg-card p-5 shadow-resting"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-12 shrink-0 items-center justify-center rounded-[14px]"
                style={{ backgroundColor: `${wallet.color}26`, color: wallet.color }}
              >
                <WalletIcon className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-[19px] font-bold">{wallet.name}</h3>
                  {wallet.isMain && <span className="rounded-full bg-lime-soft px-2 py-0.5 text-xs font-semibold">Main</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {count} {count === 1 ? 'transaction' : 'transactions'} · {wallet.currency}
                </p>
              </div>
              <Link
                to="/wallets"
                aria-label={`Manage ${wallet.name}`}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted hover:bg-border focus-visible:outline-2 focus-visible:outline-ring"
              >
                <ArrowUpRight className="size-[18px]" />
              </Link>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="text-2xl font-bold tabular-nums">{formatAmount(wallet.balance, null, wallet.currency)}</p>
            </div>

            <div className="space-y-2">
              <div
                role="progressbar"
                aria-label="Share of this month's income spent"
                aria-valuenow={pct ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={cn('h-full rounded-full transition-[width] duration-300', over ? 'bg-expense' : 'bg-lime')}
                  style={{ width: `${over ? 100 : pct ?? 0}%` }}
                />
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
                <span className="text-muted-foreground">{caption}</span>
                <span className="tabular-nums">
                  <span className="text-income">{formatAmount(s.income, 'INCOME', wallet.currency)}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span className="text-expense">{formatAmount(s.expense, 'EXPENSE', wallet.currency)}</span>
                </span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
