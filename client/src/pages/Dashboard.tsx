import { WalletCarousel } from '@/components/finance/wallet-carousel';
import { TransactionsList } from '@/components/finance/transactions-list';
import { useState } from 'react';

export default function Dashboard() {
    const [currentWalletId, setCurrentWalletId] = useState<string | undefined>();

    // Handle wallet change from carousel
    const handleWalletChange = (walletId: string) => {
        setCurrentWalletId(walletId);
    };

    // Handle transaction changes
    const handleTransactionChange = () => {
        // This will trigger refetch in both components
    };



    return (
        <div className="bg-pastel-green min-h-screen flex flex-col items-center font-sans pb-20 mt-4">
        
        <main className="flex-1 w-full max-w-2xl px-6">
            <WalletCarousel 
                onTransactionChange={handleTransactionChange}
                onWalletChange={handleWalletChange}
            />
            
            {!currentWalletId ? (
                <div className="text-center py-8">
                    <p className="text-gray-500">Select a wallet to view transactions</p>
                </div>
            ) : (
                <TransactionsList 
                    limit={5}
                    showSeeAllLink={true}
                    onTransactionChange={handleTransactionChange}
                    walletId={currentWalletId}
                />
            )}
        </main>
        
        </div>
    );
}
