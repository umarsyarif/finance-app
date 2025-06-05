import React, { useState } from 'react';
import { Card } from '../ui/card';
import { TransactionDetailsModal } from './transaction-details-modal';
import { cn } from '@/lib/utils';
import { useTransactions } from '@/hooks/use-transactions';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { formatDate, formatAmount, formatMonthAndYear } from '@/lib/format-utils';
import { Link } from 'react-router-dom';

export interface Transaction {
  id: string;
  title: string;
  description: string;
  date: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
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

interface TransactionsListProps {
  className?: string;
  walletId?: string;
  categoryId?: string;
  limit?: number;
  onTransactionChange?: () => void;
  title?: string;
  showSeeAllLink?: boolean;
  variant?: 'card' | 'full';
  month?: number;
  year?: number;
  showMonthNavigation?: boolean;
  onMonthChange?: (date: Date) => void;
  currentDate?: Date;
}

const TransactionListItem: React.FC<{
  transaction: Transaction;
  onClick: () => void;
  variant?: 'card' | 'full';
}> = ({ transaction, onClick, variant = 'card' }) => {
  const isIncome = transaction.type === 'INCOME';
  
  return (
    <div 
      className="flex items-center justify-between py-4 px-4 hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center space-x-3">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold",
          isIncome ? "bg-blue-500" : "bg-orange-500"
        )}>
          {transaction.category?.name.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-900">
            {transaction.description || transaction.category?.name}
          </div>
          <div className="text-sm text-gray-500">
            {formatDate(transaction.date)}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className={cn(
          "font-semibold",
          isIncome ? "text-blue-600" : "text-gray-900"
        )}>
          {formatAmount(transaction.amount, transaction.type)}
        </div>
      </div>
    </div>
  );
  
};

export function TransactionsList({ 
  className, 
  walletId, 
  categoryId, 
  limit = 10, 
  onTransactionChange,
  title = "Recent Transactions",
  showSeeAllLink = false,
  variant = 'card',
  month,
  year,
  showMonthNavigation = false,
  onMonthChange,
  currentDate
}: TransactionsListProps) {
  const { transactions, loading, error, refetch } = useTransactions({
    limit,
    walletId,
    categoryId,
    month,
    year,
  });
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (!currentDate || !onMonthChange) return;
    
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    onMonthChange(newDate);
  };

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

  if (variant === 'full') {
    if (loading) {
      return (
        <div className={cn("bg-white min-h-screen", className)}>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className={cn("bg-white min-h-screen p-4", className)}>
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={refetch} variant="outline">
              Try again
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("bg-white min-h-screen", className)}>
        {/* Month Navigation */}
        {showMonthNavigation && currentDate && (
          <div className="bg-white border-b border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateMonth('prev')}
                className="p-1"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              
              <div className="flex items-center space-x-2">
                <span className="text-lg font-semibold">
                  {formatMonthAndYear(currentDate.toDateString())}
                </span>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateMonth('next')}
                className="p-1"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Transactions List */}
        <div className="bg-white">
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {showMonthNavigation ? "이번 달 거래 내역이 없습니다" : "No transactions found"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {transactions.map((transaction) => (
                <TransactionListItem
                  key={transaction.id}
                  transaction={transaction}
                  onClick={() => handleTransactionClick(transaction)}
                  variant="full"
                />
              ))}
            </div>
          )}
        </div>

        {/* Transaction Details Modal */}
        <TransactionDetailsModal
          transaction={selectedTransaction}
          isOpen={isDetailsModalOpen}
          onClose={handleModalClose}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      </div>
    );
  }

  // Card variant (for dashboard)
  if (loading) {
    return (
      <Card className={cn("bg-pastel-green/30 rounded-xl shadow px-6 py-4", className)}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-pastel-blue">{title}</h2>
          {showSeeAllLink && (
            <Link 
              to="/transactions" 
              className="text-sm text-pastel-blue hover:text-pastel-blue/80 transition-colors flex items-center gap-1"
            >
              See all transactions
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pastel-blue"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("bg-pastel-green/30 rounded-xl shadow px-6 py-4", className)}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-pastel-blue">{title}</h2>
          {showSeeAllLink && (
            <Link 
              to="/transactions" 
              className="text-sm text-pastel-blue hover:text-pastel-blue/80 transition-colors flex items-center gap-1"
            >
              See all transactions
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-pastel-blue">{title}</h2>
          {showSeeAllLink && (
            <Link 
              to="/transactions" 
              className="text-sm text-pastel-blue hover:text-pastel-blue/80 transition-colors flex items-center gap-1"
            >
              See all transactions
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500">No transactions found</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-pastel-green/30 rounded-xl shadow px-6 py-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-pastel-blue">{title}</h2>
        {showSeeAllLink && (
          <Link 
            to="/transactions" 
            className="text-sm text-pastel-blue hover:text-pastel-blue/80 transition-colors flex items-center gap-1"
          >
            See all transactions
            <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>
      <ul className="divide-y divide-pastel-green-dark/20">
        {transactions.map((transaction) => (
          <TransactionListItem
            key={transaction.id}
            transaction={transaction}
            onClick={() => handleTransactionClick(transaction)}
            variant="card"
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