import { useState } from 'react';
import { getCurrentDate } from '@/lib/date-utils';
import { TransactionsList } from '@/components/finance/transactions-list';
import { PageTitle } from '@/components/page-header';
import { useAppShell } from '@/components/app-layout';

export function MonthlyTransactionsView() {
  const [currentDate, setCurrentDate] = useState(getCurrentDate());
  const { dataVersion } = useAppShell();

  return (
    <>
      <PageTitle eyebrow="Monthly ledger" title="Transactions" />
      <TransactionsList
        month={currentDate.getMonth() + 1}
        year={currentDate.getFullYear()}
        currentDate={currentDate}
        onMonthChange={setCurrentDate}
        refreshKey={dataVersion}
      />
    </>
  );
}
