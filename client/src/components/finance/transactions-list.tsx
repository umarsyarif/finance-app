import React, { useState } from 'react';
import { Card } from '../ui/card';
import { TransactionItem, Transaction } from './transaction-item';
import { TransactionDetailsModal } from './transaction-details-modal';
import { cn } from '@/lib/utils';
import { useTransactions } from '@/hooks/use-transactions';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TransactionsListProps {
  className?: string;
  walletId?: string;
  categoryId?: string;
  limit?: number;
  onTransactionChange?: () => void;
}

export function TransactionsList({ className, walletId, categoryId, limit = 10, onTransactionChange }: TransactionsListProps) {
  const { transactions, loading, error, refetch } = useTransactions({
    limit,
    walletId,
    categoryId,
  });
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDetailsModalOpen(true);
  };

  const handleUpdate = () => {
    refetch();
    onTransactionChange?.();
  };

  const handleDelete = () => {
    refetch();
    onTransactionChange?.();
  };

  const handleModalClose = () => {
    setIsDetailsModalOpen(false);
    setSelectedTransaction(null);
  };

  if (loading) {
    return (
      <Card className={cn("bg-pastel-green/30 rounded-xl shadow px-6 py-4", className)}>
        <h2 className="text-lg font-semibold mb-4 text-pastel-blue">Recent Transactions</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pastel-blue"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("bg-pastel-green/30 rounded-xl shadow px-6 py-4", className)}>
        <h2 className="text-lg font-semibold mb-4 text-pastel-blue">Recent Transactions</h2>
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">{error}</p>
          <button 
            onClick={refetch}
            className="px-4 py-2 bg-pastel-blue text-white rounded-lg hover:bg-pastel-blue/80 transition-colors"
          >
            Try Again
          </button>
        </div>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card className={cn("bg-pastel-green/30 rounded-xl shadow px-6 py-4", className)}>
        <h2 className="text-lg font-semibold mb-4 text-pastel-blue">Recent Transactions</h2>
        <div className="text-center py-8">
          <p className="text-gray-500">No transactions found</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-pastel-green/30 rounded-xl shadow px-6 py-4", className)}>
      <h2 className="text-lg font-semibold mb-4 text-pastel-blue">Recent Transactions</h2>
      <ul className="divide-y divide-pastel-green-dark/20">
        {transactions.map((transaction) => (
          <TransactionItem
            key={transaction.id}
            transaction={transaction}
            onClick={() => handleTransactionClick(transaction)}
          />
        ))}
      </ul>
      
      <TransactionDetailsModal
        transaction={selectedTransaction}
        isOpen={isDetailsModalOpen}
        onClose={handleModalClose}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </Card>
  );
}