import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { Button } from '../ui/button';
import { TransactionForm } from './transaction-form';

type TransactionType = 'INCOME' | 'EXPENSE';

interface AddTransactionSheetProps {
  type: TransactionType;
  onTransactionChange?: () => void;
  defaultWalletId?: string;
}

export function AddTransactionSheet({ type, onTransactionChange, defaultWalletId }: AddTransactionSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isIncome = type === 'INCOME';
  const buttonText = isIncome ? 'Add Income' : 'Add Expense';
  const sheetTitle = isIncome ? 'Add New Income' : 'Add New Expense';
  const sheetDescription = isIncome ? 'Add your income transaction here.' : 'Add your expense transaction here.';

  const handleSuccess = () => {
    onTransactionChange?.();
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant={"default"}
          size={"sm"}
          className="text-xs mt-2"
        >
          {buttonText}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>{sheetTitle}</SheetTitle>
          <SheetDescription>
            {sheetDescription}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <TransactionForm 
            type={type}
            onSuccess={handleSuccess}
            submitButtonText={buttonText}
            defaultWalletId={defaultWalletId}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}