import { useEffect, useState } from 'react';
import { Outlet, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import axios from '@/lib/axios';
import type { Bill } from '@/hooks/use-bills';
import type { TransactionDraft } from '@/hooks/use-transaction-form';
import { AppHeader } from './app-header';
import { AppFooter } from './app-footer';
import { AddTransactionSheet } from './finance/add-transaction-sheet';
import { RefreshCw } from 'lucide-react';
import { secureStorage } from '@/services/secure-storage.service';
import { PULL_THRESHOLD, usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { checkForAppUpdate } from '@/lib/app-update';
import { cn } from '@/lib/utils';

export interface AppShellContext {
  // Wallet shown on Transactions (raw; resolve with resolveWalletId). The Add sheet defaults to it.
  selectedWalletId?: string;
  setSelectedWalletId: (walletId: string) => void;
  // Currency shown on Home (raw; resolve with resolveCurrency)
  selectedCurrency?: string;
  setSelectedCurrency: (currency: string) => void;
  // Bumped after the global Add sheet saves, so pages can refetch
  dataVersion: number;
  notifyDataChanged: () => void;
}

export const useAppShell = () => useOutletContext<AppShellContext>();

// State remembered across reloads in localStorage
function usePersisted(key: string) {
  const [value, setValue] = useState<string | undefined>(() => secureStorage.getItem(key) ?? undefined);
  const set = (next: string) => {
    setValue(next);
    secureStorage.setItem(key, next, true);
  };
  return [value, set] as const;
}

export function AppLayout() {
  const { pathname } = useLocation();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState<TransactionDraft | undefined>();
  const add = searchParams.get('add');
  // Notification deep link: ?add=new or ?add=bill:<id> opens the Add sheet (prefilled from the bill)
  useEffect(() => {
    if (!add) return;
    const next = new URLSearchParams(searchParams);
    next.delete('add');
    setSearchParams(next, { replace: true }); // a re-render or Back must not reopen it
    if (add === 'new') { setDraft(undefined); setIsAddOpen(true); return; }
    const billId = add.startsWith('bill:') ? add.slice(5) : null;
    if (!billId) return;
    axios.get('/api/bills').then(({ data }) => {
      const bill = (data.data.bills as Bill[]).find((b) => b.id === billId);
      if (!bill) toast.error('That bill no longer exists');
      setDraft(bill ? { type: 'EXPENSE', amount: bill.amount, description: bill.name, date: new Date().toISOString(), walletId: bill.walletId ?? '', categoryId: bill.categoryId ?? '' } : undefined);
      setIsAddOpen(true);
    }).catch(() => { toast.error("Couldn't load that bill"); setIsAddOpen(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [add]);
  const [selectedWalletId, setSelectedWalletId] = usePersisted('selected_wallet');
  const [selectedCurrency, setSelectedCurrency] = usePersisted('selected_currency');
  const [dataVersion, setDataVersion] = useState(0);
  const notifyDataChanged = () => setDataVersion((v) => v + 1);
  // Pull down at the top of any page: refetch everything and pick up a newly deployed version
  const { pull, refreshing } = usePullToRefresh(async () => {
    notifyDataChanged();
    await Promise.all([checkForAppUpdate(), new Promise((r) => setTimeout(r, 600))]);
  });

  return (
    <div className="min-h-screen flex flex-col w-full">
      {pathname === '/' && <AppHeader />}
      {(pull > 0 || refreshing) && (
        <div
          role="status"
          aria-label={refreshing ? 'Refreshing' : 'Pull to refresh'}
          className="flex items-end justify-center overflow-hidden text-muted-foreground"
          style={{ height: refreshing ? 48 : pull }}
        >
          <RefreshCw
            className={refreshing ? 'mb-3 size-5 animate-spin' : 'mb-3 size-5'}
            style={refreshing ? undefined : { transform: `rotate(${(pull / PULL_THRESHOLD) * 270}deg)`, opacity: Math.min(1, pull / PULL_THRESHOLD) }}
          />
        </div>
      )}
      <main className={cn('w-full max-w-[480px] mx-auto px-6 flex flex-grow flex-col pb-32', pathname !== '/' && 'pt-6')}>
        <Outlet
          context={{ selectedWalletId, setSelectedWalletId, selectedCurrency, setSelectedCurrency, dataVersion, notifyDataChanged } satisfies AppShellContext}
        />
      </main>
      <AppFooter onAdd={() => { setDraft(undefined); setIsAddOpen(true); }} />
      <AddTransactionSheet
        open={isAddOpen}
        onOpenChange={(o) => { setIsAddOpen(o); if (!o) setDraft(undefined); }}
        initialDraft={draft}
        defaultWalletId={selectedWalletId}
        onTransactionChange={notifyDataChanged}
      />
    </div>
  );
}
