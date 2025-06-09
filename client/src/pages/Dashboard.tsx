import { WalletCarousel } from '@/components/finance/wallet-carousel';
import { TransactionsList } from '@/components/finance/transactions-list';
import { useState, useRef } from 'react';

export default function Dashboard() {
    const [currentWalletId, setCurrentWalletId] = useState<string | undefined>();
    const [refreshKey, setRefreshKey] = useState(0);
    const walletCarouselRef = useRef<{ refetchWallets: () => void } | null>(null);
    const transactionsListRef = useRef<{ refetch: () => void } | null>(null);

    // Handle wallet change from carousel
    const handleWalletChange = (walletId: string) => {
        setCurrentWalletId(walletId);
    };

    // Handle transaction changes
    const handleTransactionChange = () => {
        // Trigger refetch in both components by updating refresh key
        setRefreshKey(prev => prev + 1);
    };



    return (
        <div className="bg-pastel-green min-h-screen flex flex-col items-center font-sans pb-20 mt-4">
        
        <main className="flex-1 w-full max-w-2xl px-6">
            <WalletCarousel 
                key={`wallet-carousel-${refreshKey}`}
                onTransactionChange={handleTransactionChange}
                onWalletChange={handleWalletChange}
            />
            
            {!currentWalletId ? (
                <div className="text-center py-8">
                    <p className="text-gray-500">Select a wallet to view transactions</p>
                </div>
            ) : (
                <TransactionsList 
                    key={`transactions-list-${refreshKey}-${currentWalletId}`}
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
