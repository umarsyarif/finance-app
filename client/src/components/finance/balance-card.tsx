import { Card } from '../ui/card';
import { cn } from '@/lib/utils';
import { AddTransactionSheet } from './add-transaction-sheet';

interface BalanceCardProps {
  balance: string;
  income: string;
  expense: string;
  className?: string;
  onTransactionChange?: () => void;
}

export function BalanceCard({ balance, income, expense, className, onTransactionChange }: BalanceCardProps) {
  return (
    <Card className={cn("bg-pastel-yellow rounded-2xl shadow p-8 mb-6 flex flex-col items-center", className)}>
      <span className="text-gray-600 text-sm">Current Balance</span>
      <span className="text-3xl font-semibold text-pastel-blue mt-2">{balance}</span>
      <div className="flex space-x-4 mt-6">
        <div className="flex flex-col items-center">
          <span className="text-xs text-gray-600">Income</span>
          <span className="text-pastel-green-dark text-lg font-medium">{income}</span>
          <AddTransactionSheet type="INCOME" onTransactionChange={onTransactionChange} />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-gray-600">Expense</span>
          <span className="text-pastel-red text-lg font-medium">{expense}</span>
          <AddTransactionSheet type="EXPENSE" onTransactionChange={onTransactionChange} />
        </div>
      </div>
    </Card>
  );
}