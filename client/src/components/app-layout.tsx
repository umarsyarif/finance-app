import { useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { AppHeader } from './app-header';
import { AppFooter } from './app-footer';
import { AddTransactionSheet } from './finance/add-transaction-sheet';
import { secureStorage } from '@/services/secure-storage.service';

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
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = usePersisted('selected_wallet');
  const [selectedCurrency, setSelectedCurrency] = usePersisted('selected_currency');
  const [dataVersion, setDataVersion] = useState(0);
  const notifyDataChanged = () => setDataVersion((v) => v + 1);

  return (
    <div className="min-h-screen flex flex-col w-full">
      <AppHeader />
      <main className="w-full max-w-[480px] mx-auto px-6 flex flex-grow flex-col pb-32">
        <Outlet
          context={{ selectedWalletId, setSelectedWalletId, selectedCurrency, setSelectedCurrency, dataVersion, notifyDataChanged } satisfies AppShellContext}
        />
      </main>
      <AppFooter onAdd={() => setIsAddOpen(true)} />
      <AddTransactionSheet
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        defaultWalletId={selectedWalletId}
        onTransactionChange={notifyDataChanged}
      />
    </div>
  );
}
