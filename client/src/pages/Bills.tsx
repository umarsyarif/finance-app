import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import axios from '@/lib/axios';
import { PageTitle, PillButton } from '@/components/page-header';
import { FormSheet } from '@/components/assets/form-sheet';
import { BillForm } from '@/components/bills/bill-form';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { useBills, type Bill } from '@/hooks/use-bills';
import { formatCurrency } from '@/lib/format-utils';

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const remindText = (d: number) => (d === 0 ? 'remind on the due day' : `remind ${d} day${d === 1 ? '' : 's'} before`);

export default function Bills() {
  const { bills, loading, error, refetch } = useBills();
  const [editing, setEditing] = useState<Bill | 'new' | null>(null);
  const [deleting, setDeleting] = useState(false);

  const saved = () => { setEditing(null); refetch(); };
  const remove = async () => {
    if (editing === null || editing === 'new') return;
    try {
      await axios.delete(`/api/bills/${editing.id}`);
      setDeleting(false);
      saved();
    } catch {
      setDeleting(false);
      toast.error("Couldn't delete this bill");
    }
  };

  return (
    <>
      <PageTitle eyebrow="Money" title="Bills" action={<PillButton onClick={() => setEditing('new')}><Plus />Add bill</PillButton>} />
      {error && <p role="alert" className="text-sm text-expense">{error}</p>}
      {!loading && !error && bills.length === 0 && <p className="py-8 text-center text-muted-foreground">No bills yet</p>}
      <div className="space-y-3">
        {bills.map((bill) => (
          <button
            key={bill.id}
            type="button"
            aria-label={bill.name}
            onClick={() => setEditing(bill)}
            className="block w-full rounded-[24px] bg-card p-5 text-left shadow-resting focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{bill.name}</span>
              <span className="font-bold tabular-nums">{formatCurrency(bill.amount, bill.currency)}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Every month on the {ordinal(bill.dayOfMonth)} · {remindText(bill.remindDaysBefore)}</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              {bill.wallet?.name ?? 'No wallet'}
              {!bill.active && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Paused</span>}
            </p>
          </button>
        ))}
      </div>
      <FormSheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing === 'new' ? 'Add bill' : 'Edit bill'}>
        {editing !== null && (
          <BillForm key={editing === 'new' ? 'new' : editing.id} bill={editing === 'new' ? null : editing} onSaved={saved} onDelete={() => setDeleting(true)} />
        )}
      </FormSheet>
      <ConfirmationModal isOpen={deleting} onClose={() => setDeleting(false)} onConfirm={remove} title="Delete bill?" description="This bill and its reminders will be removed." confirmText="Delete" />
    </>
  );
}
