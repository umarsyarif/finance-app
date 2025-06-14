import { useState } from 'react';
import { getCurrentDate } from '@/lib/date-utils';
import { TransactionsList } from '@/components/finance/transactions-list';

interface MonthlyTransactionsViewProps {
  className?: string;
}

export function MonthlyTransactionsView({ className }: MonthlyTransactionsViewProps) {
  const [currentDate, setCurrentDate] = useState(getCurrentDate());

  // Extract month and year from the current date state
  const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11, we need 1-12
  const currentYear = currentDate.getFullYear();

  const handleMonthChange = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  return (
    <TransactionsList
      className={className}
      variant="full"
      month={currentMonth}
      year={currentYear}
      limit={100}
      showMonthNavigation={true}
      currentDate={currentDate}
      onMonthChange={handleMonthChange}
    />
  );
}