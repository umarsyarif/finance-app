import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Transaction } from './transaction-item';
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
    // Close sheet after successful update
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Transaction</SheetTitle>
          <SheetDescription>
            Update your transaction details.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <TransactionForm 
            transaction={transaction}
            onSuccess={handleSuccess}
            submitButtonText="Update Transaction"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}