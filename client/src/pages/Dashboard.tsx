import { BalanceCard } from '@/components/finance/balance-card';
import { TransactionsList } from '@/components/finance/transactions-list';

export default function Dashboard() {
    // const handleAddClick = () => {
    //     console.log('Add button clicked');
    // };

    return (
        <div className="bg-pastel-green min-h-screen flex flex-col items-center font-sans pb-20 mt-4">
        
        <main className="flex-1 w-full max-w-2xl px-6">
            <BalanceCard 
            balance="$4,200.50" 
            income="+$2,500" 
            expense="-$800" 
            />
            
            <TransactionsList />
        </main>
        
        </div>
    );
}
