import React from 'react';
import { formatDate, formatAmount } from '../../lib/format-utils';

export interface Transaction {
  id: string;
  title: string;
  description: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  walletId: string;
  categoryId: string;
  wallet?: {
    id: string;
    name: string;
  };
  category?: {
    id: string;
    name: string;
  };
}

interface TransactionItemProps {
  transaction: Transaction;
  onClick: () => void;
}

export function TransactionItem({ transaction, onClick }: TransactionItemProps) {


  return (
    <div 
      className="flex items-center justify-between py-3 hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{transaction.title}</h3>
          <span className={`font-semibold ${
            transaction.type === 'income' ? 'text-pastel-green-dark' : 'text-pastel-red'
          }`}>
            {formatAmount(transaction.amount, transaction.type)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-sm text-gray-500">{formatDate(transaction.date)}</p>
          {transaction.description && (
            <p className="text-sm text-gray-400 truncate max-w-[200px]">
              {transaction.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}