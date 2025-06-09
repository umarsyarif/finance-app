import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { AddTransactionSheet } from './add-transaction-sheet';
import { useWallets } from '@/hooks/use-wallets';
import { useTransactions } from '@/hooks/use-transactions';
import axios from '@/lib/axios';

interface Wallet {
  id: string;
  name: string;
  balance: number;
  currency: string;
  color: string;
}

interface WalletCarouselProps {
  onTransactionChange?: () => void;
  onWalletChange?: (walletId: string) => void;
}

export function WalletCarousel({ onTransactionChange, onWalletChange }: WalletCarouselProps) {
  const { wallets: initialWallets, loading, error, refetch } = useWallets();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [walletStats, setWalletStats] = useState<Record<string, { income: number; expense: number }>>({});

  // Update wallets when data is fetched
  useEffect(() => {
    if (initialWallets) {
      setWallets(initialWallets);
    }
  }, [initialWallets]);

  // Fetch wallet-specific statistics
  useEffect(() => {
    const fetchWalletStats = async () => {
      if (wallets.length === 0) return;
      
      const stats: Record<string, { income: number; expense: number }> = {};
      
      for (const wallet of wallets) {
        try {
          const response = await axios.get(`/api/transactions?walletId=${wallet.id}&limit=1000`);
          const transactions = response.data.data.transactions || [];
          
          let income = 0;
          let expense = 0;
          
          transactions.forEach((transaction: any) => {
            if (transaction.category.type === 'INCOME') {
              income += transaction.amount;
            } else if (transaction.category.type === 'EXPENSE') {
              expense += Math.abs(transaction.amount);
            }
          });
          
          stats[wallet.id] = { income, expense };
        } catch (err) {
          console.error(`Failed to fetch stats for wallet ${wallet.id}:`, err);
          stats[wallet.id] = { income: 0, expense: 0 };
        }
      }
      
      setWalletStats(stats);
    };

    fetchWalletStats();
  }, [wallets]);

  // Notify parent when current wallet changes
  useEffect(() => {
    if (wallets.length > 0 && onWalletChange) {
      onWalletChange(wallets[currentIndex]?.id);
    }
  }, [currentIndex, wallets, onWalletChange]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newWallets = [...wallets];
    const draggedWallet = newWallets[draggedIndex];
    
    // Remove dragged wallet
    newWallets.splice(draggedIndex, 1);
    
    // Insert at new position
    newWallets.splice(dropIndex, 0, draggedWallet);
    
    setWallets(newWallets);
    
    // Update current index if needed
    if (currentIndex === draggedIndex) {
      setCurrentIndex(dropIndex);
    } else if (currentIndex > draggedIndex && currentIndex <= dropIndex) {
      setCurrentIndex(currentIndex - 1);
    } else if (currentIndex < draggedIndex && currentIndex >= dropIndex) {
      setCurrentIndex(currentIndex + 1);
    }
    
    setDraggedIndex(null);
  };

  const nextWallet = () => {
    setCurrentIndex((prev) => (prev + 1) % wallets.length);
  };

  const prevWallet = () => {
    setCurrentIndex((prev) => (prev - 1 + wallets.length) % wallets.length);
  };

  const goToWallet = (index: number) => {
    setCurrentIndex(index);
  };

  if (loading) {
    return (
      <div className="mb-6">
        <div className="animate-pulse bg-gray-200 rounded-2xl h-48"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-6">
        <Card className="bg-red-50 border-red-200 rounded-2xl p-8 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={refetch} variant="outline">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="mb-6">
        <Card className="bg-gray-50 rounded-2xl p-8 text-center">
          <p className="text-gray-600">No wallets found. Create your first wallet to get started!</p>
        </Card>
      </div>
    );
  }

  const currentWallet = wallets[currentIndex];
  const currentStats = walletStats[currentWallet?.id] || { income: 0, expense: 0 };

  return (
    <div className="mb-6">
      {/* Main Wallet Card */}
      <Card className="bg-pastel-yellow rounded-2xl shadow p-8 mb-4 flex flex-col items-center relative overflow-hidden">
        {/* Wallet Navigation */}
        {wallets.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={prevWallet}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10"
            >
              ←
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={nextWallet}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10"
            >
              →
            </Button>
          </>
        )}

        {/* Wallet Info */}
        <div className="text-center mb-4">
          <span className="text-gray-600 text-sm">Current Balance</span>
          <h3 className="text-lg font-semibold text-gray-800 mt-1">{currentWallet.name}</h3>
          <span className="text-3xl font-semibold text-pastel-blue mt-2 block">
            {currentWallet.currency} {currentWallet.balance.toFixed(2)}
          </span>
        </div>

        {/* Income/Expense Stats */}
        <div className="flex space-x-4 mt-6">
          <div className="flex flex-col items-center">
            <span className="text-xs text-gray-600">Income</span>
            <span className="text-pastel-green-dark text-lg font-medium">
              +{currentWallet.currency} {currentStats.income.toFixed(2)}
            </span>
            <AddTransactionSheet 
              type="INCOME" 
              onTransactionChange={onTransactionChange}
              defaultWalletId={currentWallet.id}
            />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs text-gray-600">Expense</span>
            <span className="text-pastel-red text-lg font-medium">
              -{currentWallet.currency} {currentStats.expense.toFixed(2)}
            </span>
            <AddTransactionSheet 
              type="EXPENSE" 
              onTransactionChange={onTransactionChange}
              defaultWalletId={currentWallet.id}
            />
          </div>
        </div>
      </Card>

      {/* Wallet Indicators/Reorder Section */}
      {wallets.length > 1 && (
        <div className="flex justify-center space-x-2 mb-4">
          {wallets.map((wallet, index) => (
            <div
              key={wallet.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              onClick={() => goToWallet(index)}
              className={cn(
                "w-12 h-8 rounded-lg border-2 cursor-pointer transition-all duration-200 flex items-center justify-center text-xs font-medium",
                index === currentIndex
                  ? "border-pastel-blue bg-pastel-blue text-white"
                  : "border-gray-300 bg-white text-gray-600 hover:border-pastel-blue",
                draggedIndex === index && "opacity-50"
              )}
              title={`${wallet.name} - Drag to reorder`}
            >
              {wallet.name.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      )}

      {/* Wallet Count Info */}
      {wallets.length > 1 && (
        <p className="text-center text-sm text-gray-500">
          Wallet {currentIndex + 1} of {wallets.length} • Drag indicators to reorder
        </p>
      )}
    </div>
  );
}