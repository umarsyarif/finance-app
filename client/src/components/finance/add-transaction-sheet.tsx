import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { Button } from '../ui/button';
import { TransactionForm } from './transaction-form';

type TransactionType = 'income' | 'expense';

interface AddTransactionSheetProps {
  type: TransactionType;
  onTransactionChange?: () => void;
}

export function AddTransactionSheet({ type, onTransactionChange }: AddTransactionSheetProps) {
  const isIncome = type === 'income';
  const buttonText = isIncome ? 'Add Income' : 'Add Expense';
  const sheetTitle = isIncome ? 'Add New Income' : 'Add New Expense';
  const sheetDescription = isIncome ? 'Add your income transaction here.' : 'Add your expense transaction here.';

  return (
    <Sheet>
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
            onSuccess={onTransactionChange}
            submitButtonText={buttonText}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}