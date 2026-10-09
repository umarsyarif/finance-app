import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { WalletCards } from '@/components/finance/wallet-cards';
import { FilterChips } from '@/components/finance/filter-chips';
import { RowsCard, TransactionRow, typeCounts, typeOptions, type Transaction, type TypeFilter } from '@/components/finance/transactions-list';
import { TransactionDetailsModal } from '@/components/finance/transaction-details-modal';
import { PageTitle, PillButton } from '@/components/page-header';
import { useAppShell } from '@/components/app-layout';
import { useTransactions } from '@/hooks/use-transactions';

const RECENT = 5;

export default function Dashboard() {
    const navigate = useNavigate();
    const { selectedWalletId, setSelectedWalletId, dataVersion, notifyDataChanged } = useAppShell();
    const [type, setType] = useState<TypeFilter>('ALL');
    const [selected, setSelected] = useState<Transaction | null>(null);
    const now = new Date();

    // This month's transactions for the wallet in view; the list shows the most recent few
    const { transactions, loading } = useTransactions({
        walletId: selectedWalletId,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        limit: 100,
        refreshKey: dataVersion,
    });
    const visible = (type === 'ALL' ? transactions : transactions.filter((t) => t.type === type)).slice(0, RECENT);
    const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const changed = () => {
        setSelected(null);
        notifyDataChanged();
    };

    return (
        <>
            <PageTitle
                eyebrow="Overview"
                title="This month"
                action={<span className="inline-flex h-11 items-center rounded-full bg-card px-[18px] text-[15px] font-semibold shadow-resting">{monthLabel}</span>}
            />

            <WalletCards selectedWalletId={selectedWalletId} onSelect={setSelectedWalletId} refreshKey={dataVersion} />

            {selectedWalletId && (
                <section className="mt-8 space-y-4">
                    <FilterChips label="Transaction type" options={typeOptions(typeCounts(transactions))} value={type} onChange={setType} />
                    <div className="space-y-2">
                        <h2 className="px-1 text-[19px] font-bold">Recent activity</h2>
                        {loading ? (
                            <div className="h-40 animate-pulse rounded-[24px] bg-card" />
                        ) : visible.length === 0 ? (
                            <p className="rounded-[24px] bg-card p-6 text-center text-muted-foreground shadow-resting">
                                No transactions this month. Tap + to add one.
                            </p>
                        ) : (
                            <RowsCard>
                                {visible.map((t) => <TransactionRow key={t.id} transaction={t} showDate onClick={() => setSelected(t)} />)}
                            </RowsCard>
                        )}
                    </div>
                    <PillButton className="w-full justify-center" onClick={() => navigate('/transactions')}>
                        See all transactions <ArrowRight />
                    </PillButton>
                </section>
            )}

            {selected && (
                <TransactionDetailsModal
                    transaction={selected}
                    isOpen={!!selected}
                    onClose={() => setSelected(null)}
                    onUpdate={changed}
                    onDelete={changed}
                />
            )}
        </>
    );
}
