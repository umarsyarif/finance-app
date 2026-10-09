import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { TransactionForm } from './transaction-form';

interface AddTransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransactionChange?: () => void;
  defaultWalletId?: string;
}

// Opened from the bottom bar's Add button
export function AddTransactionSheet({ open, onOpenChange, onTransactionChange, defaultWalletId }: AddTransactionSheetProps) {
  const handleSuccess = () => {
    onTransactionChange?.();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[92vh] max-w-[480px] overflow-y-auto rounded-t-[28px] px-6 pb-8">
        <SheetHeader className="px-0">
          <SheetTitle className="text-[19px] font-bold">Add transaction</SheetTitle>
          <SheetDescription className="sr-only">Record an expense or income.</SheetDescription>
        </SheetHeader>
        {open && <TransactionForm onSuccess={handleSuccess} defaultWalletId={defaultWalletId} />}
      </SheetContent>
    </Sheet>
  );
}
