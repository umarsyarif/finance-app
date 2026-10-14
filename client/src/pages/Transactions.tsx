import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCurrentDate } from '@/lib/date-utils';
import { TransactionsList } from '@/components/finance/transactions-list';
import { WalletCards } from '@/components/finance/wallet-cards';
import { PageTitle } from '@/components/page-header';
import { useAppShell } from '@/components/app-layout';
import { useWallets } from '@/hooks/use-wallets';
import { resolveWalletId } from '@/lib/selection';

// One wallet's ledger: swipe the cards to pick the wallet; the month drives the list and the cards' in/out
export function MonthlyTransactionsView() {
  const [currentDate, setCurrentDate] = useState(getCurrentDate());
  const { selectedWalletId, setSelectedWalletId, dataVersion } = useAppShell();
  // Notification deep link: ?wallet=<id> selects that wallet, then the param goes away
  const [searchParams, setSearchParams] = useSearchParams();
  const walletParam = searchParams.get('wallet');
  useEffect(() => {
    if (!walletParam) return;
    setSelectedWalletId(walletParam);
    const next = new URLSearchParams(searchParams);
    next.delete('wallet');
    setSearchParams(next, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletParam]);
  const { wallets } = useWallets();
  const walletId = resolveWalletId(wallets, selectedWalletId);

  return (
    <>
      <PageTitle eyebrow="Monthly ledger" title="Transactions" />
      <WalletCards selectedWalletId={walletId ?? selectedWalletId} onSelect={setSelectedWalletId} month={currentDate} refreshKey={dataVersion} />
      {walletId && (
        <div className="mt-6">
          <TransactionsList
            walletId={walletId}
            month={currentDate.getMonth() + 1}
            year={currentDate.getFullYear()}
            currentDate={currentDate}
            onMonthChange={setCurrentDate}
            refreshKey={dataVersion}
          />
        </div>
      )}
    </>
  );
}
