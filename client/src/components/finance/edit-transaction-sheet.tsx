import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Transaction } from './transactions-list';
import { TransferForm } from './transfer-form';
import { TransactionForm } from './transaction-form';

interface EditTransactionSheetProps {
  transaction: Transaction;
  isOpen: boolean;
  onClose: () => void;
  onTransactionChange: () => void;
}

export function EditTransactionSheet({ 
  transaction, 
  isOpen, 
  onClose, 
  onTransactionChange 
}: EditTransactionSheetProps) {

  const handleSuccess = () => {
    onTransactionChange();
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="mx-auto max-h-[92vh] max-w-[480px] overflow-y-auto rounded-t-[28px] px-6 pb-8">
        <SheetHeader className="px-0">
          <SheetTitle className="text-[19px] font-bold">{transaction.transferId ? 'Edit transfer' : 'Edit transaction'}</SheetTitle>
          <SheetDescription className="sr-only">Change this transaction's details.</SheetDescription>
        </SheetHeader>
        {transaction.transferId
          ? <TransferForm transaction={transaction} onSuccess={handleSuccess} />
          : <TransactionForm transaction={transaction} onSuccess={handleSuccess} submitButtonText="Save changes" />}
      </SheetContent>
    </Sheet>
  );
}