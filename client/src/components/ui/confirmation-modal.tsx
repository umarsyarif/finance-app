import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Loader2, Trash2 } from 'lucide-react';
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

const pill = 'h-[52px] flex-1 rounded-full text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60';

// Destructive confirmation (DESIGN.md "Sheets and Dialogs"): a centered card, the destructive choice on the right
export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
}: ConfirmationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          role="alertdialog"
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-48px)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-card p-6 shadow-sheet duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <div aria-hidden className="flex size-12 items-center justify-center rounded-[16px] bg-expense/12 text-expense">
            <Trash2 className="size-5" />
          </div>
          <DialogTitle className="mt-4 text-[19px] font-bold leading-[1.3]">{title}</DialogTitle>
          <DialogDescription className="mt-1.5 text-[15px] text-muted-foreground">{description}</DialogDescription>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onClose} disabled={isLoading} className={`${pill} bg-muted text-foreground hover:bg-muted/70`}>
              {cancelText}
            </button>
            <button type="button" onClick={onConfirm} disabled={isLoading} className={`${pill} inline-flex items-center justify-center gap-2 bg-expense text-card hover:bg-expense/90`}>
              {isLoading && <Loader2 aria-hidden className="size-4 animate-spin" />}
              {confirmText}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
