import React, { useState } from 'react';
import { getCurrentDate, getCurrentMonth, getCurrentYear } from '@/lib/date-utils';
import { TransactionsList } from '@/components/finance/transactions-list';
import { cn } from '@/lib/utils';

interface MonthlyTransactionsViewProps {
  className?: string;
}

export function MonthlyTransactionsView({ className }: MonthlyTransactionsViewProps) {
  const [currentDate, setCurrentDate] = useState(getCurrentDate());

  const currentMonth = getCurrentMonth();
  const currentYear = getCurrentYear();

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