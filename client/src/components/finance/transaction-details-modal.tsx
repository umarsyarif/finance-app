import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EditTransactionSheet } from './edit-transaction-sheet';
import { ConfirmationModal } from '../ui/confirmation-modal';
import { RowsCard, type Transaction } from './transactions-list';
import { PillButton } from '@/components/page-header';
import axios from '@/lib/axios';
import { cn } from '@/lib/utils';
import { formatAmount, formatDate } from '../../lib/format-utils';

interface TransactionDetailsModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}

// Details as a bottom sheet (DESIGN.md "Transaction details")
export function TransactionDetailsModal({ transaction, isOpen, onClose, onUpdate, onDelete }: TransactionDetailsModalProps) {
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!transaction) return null;
  const income = transaction.type === 'INCOME';

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await axios.delete(`/api/transactions/${transaction.id}`);
      setIsDeleteModalOpen(false);
      onDelete();
    } catch (error) {
      const message = isAxiosError(error) ? error.response?.data?.message : undefined;
      toast.error(message || "Couldn't delete this transaction. Try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const detail = (label: string, value?: string) => (
    <div className="flex justify-between gap-4 py-3 text-[15px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );

  return (
    <>
      <Sheet open={isOpen && !isEditSheetOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="mx-auto max-w-[480px] rounded-t-[28px] px-6 pb-8">
          <SheetHeader className="px-0">
            <SheetTitle className="sr-only">Transaction details</SheetTitle>
            <SheetDescription className="sr-only">Details of {transaction.description}</SheetDescription>
          </SheetHeader>
          <div className="space-y-6">
            <div>
              <p className={cn('text-2xl font-bold tabular-nums', income ? 'text-income' : 'text-expense')}>
                {formatAmount(transaction.amount, transaction.type, transaction.wallet?.currency)}
              </p>
              <p className="text-[19px] font-bold">{transaction.description}</p>
            </div>
            <RowsCard className="bg-background shadow-none">
              {detail('Type', income ? 'Income' : 'Expense')}
              {detail('Category', transaction.category?.name)}
              {detail('Wallet', transaction.wallet?.name)}
              {detail('Date', formatDate(transaction.date))}
            </RowsCard>
            <div className="grid grid-cols-2 gap-3">
              <PillButton className="justify-center" onClick={() => setIsEditSheetOpen(true)}>
                <Pencil /> Edit
              </PillButton>
              <PillButton className="justify-center text-expense" onClick={() => setIsDeleteModalOpen(true)}>
                <Trash2 /> Delete
              </PillButton>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <EditTransactionSheet
        transaction={transaction}
        isOpen={isEditSheetOpen}
        onClose={() => setIsEditSheetOpen(false)}
        onTransactionChange={() => {
          setIsEditSheetOpen(false);
          onUpdate();
        }}
      />

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete transaction?"
        description={`"${transaction.description}" will be removed and the wallet balance updated.`}
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={isDeleting}
      />
    </>
  );
}
