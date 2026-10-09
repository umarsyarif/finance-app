import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Transaction } from './transactions-list';
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
          <SheetTitle className="text-[19px] font-bold">Edit transaction</SheetTitle>
          <SheetDescription className="sr-only">Change this transaction's details.</SheetDescription>
        </SheetHeader>
        <TransactionForm transaction={transaction} onSuccess={handleSuccess} submitButtonText="Save changes" />
      </SheetContent>
    </Sheet>
  );
}