import { cn } from '@/lib/utils';

export interface Transaction {
  id: string;
  title: string;
  date: string;
  amount: string;
  type: 'income' | 'expense';
}

interface TransactionItemProps {
  transaction: Transaction;
  className?: string;
}

export function TransactionItem({ transaction, className }: TransactionItemProps) {
  const { title, date, amount, type } = transaction;
  
  return (
    <li className={cn("flex items-center justify-between py-3", className)}>
      <div>
        <span className="font-medium text-pastel-blue">{title}</span>
        <span className="block text-xs text-gray-600">{date}</span>
      </div>
      <span 
        className={cn(
          "font-semibold", 
          type === 'income' ? "text-pastel-green-dark" : "text-pastel-red"
        )}
      >
        {type === 'income' ? '+ ' : '- '}{amount}
      </span>
    </li>
  );
}