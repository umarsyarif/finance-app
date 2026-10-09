import { useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { AppHeader } from './app-header';
import { AppFooter } from './app-footer';
import { AddTransactionSheet } from './finance/add-transaction-sheet';

export interface AppShellContext {
  // Wallet the dashboard is showing; the Add sheet defaults to it
  selectedWalletId?: string;
  setSelectedWalletId: (walletId: string) => void;
  // Bumped after the global Add sheet saves, so pages can refetch
  dataVersion: number;
  notifyDataChanged: () => void;
}

export const useAppShell = () => useOutletContext<AppShellContext>();

export function AppLayout() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string>();
  const [dataVersion, setDataVersion] = useState(0);
  const notifyDataChanged = () => setDataVersion((v) => v + 1);

  return (
    <div className="min-h-screen flex flex-col w-full">
      <AppHeader />
      <main className="w-full max-w-[480px] mx-auto px-6 flex flex-grow flex-col pb-32">
        <Outlet context={{ selectedWalletId, setSelectedWalletId, dataVersion, notifyDataChanged } satisfies AppShellContext} />
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
