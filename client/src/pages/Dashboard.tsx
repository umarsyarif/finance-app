import { BalanceCard } from '@/components/finance/balance-card';
import { TransactionsList } from '@/components/finance/transactions-list';
import { useBalance } from '@/hooks/use-balance';
import { useEffect, useRef } from 'react';

export default function Dashboard() {
    const { balance, loading, error, refetch } = useBalance();
    const transactionsListRef = useRef<{ refetch: () => void } | null>(null);

    // Refresh balance when transactions change
    const handleTransactionChange = () => {
        refetch();
    };

    if (loading) {
        return (
            <div className="bg-pastel-green min-h-screen flex flex-col items-center font-sans pb-20 mt-4">
                <main className="flex-1 w-full max-w-2xl px-6">
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pastel-blue"></div>
                    </div>
                </main>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-pastel-green min-h-screen flex flex-col items-center font-sans pb-20 mt-4">
                <main className="flex-1 w-full max-w-2xl px-6">
                    <div className="text-center py-20">
                        <p className="text-red-500 mb-4">{error}</p>
                        <button 
                            onClick={refetch}
                            className="px-4 py-2 bg-pastel-blue text-white rounded-lg hover:bg-pastel-blue/80 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="bg-pastel-green min-h-screen flex flex-col items-center font-sans pb-20 mt-4">
        
        <main className="flex-1 w-full max-w-2xl px-6">
            <BalanceCard 
                balance={balance ? `${balance.currency} ${balance.totalBalance.toFixed(2)}` : '$0.00'}
                income={balance ? `+${balance.currency} ${balance.totalIncome.toFixed(2)}` : '+$0.00'}
                expense={balance ? `-${balance.currency} ${balance.totalExpense.toFixed(2)}` : '-$0.00'}
                onTransactionChange={handleTransactionChange}
            />
            
            <TransactionsList onTransactionChange={handleTransactionChange} />
        </main>
        
        </div>
    );
}
