import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import axios from '@/lib/axios';
import { PillButton } from '@/components/page-header';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { ASSET_CLASS_UI } from '@/components/assets/asset-classes';
import { LotForm, type Lot } from '@/components/assets/lot-form';
import type { Holding } from '@/hooks/use-portfolio';
import { formatCurrency, formatDateDetailed, formatNumber } from '@/lib/format-utils';
import { cn } from '@/lib/utils';

function FormSheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[92vh] max-w-[480px] overflow-y-auto rounded-t-[28px] px-6 pb-8">
        <SheetHeader className="px-0">
          <SheetTitle className="text-[19px] font-bold">{title}</SheetTitle>
          <SheetDescription className="sr-only">{title}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

const iconBtn = 'flex size-9 shrink-0 items-center justify-center rounded-full bg-muted hover:bg-border focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-4';

export function ManualClassCard({ assetClass, holding, currency, onChanged }: {
  assetClass: string; holding: Holding | undefined; currency: string; onChanged: () => void;
}) {
  const ui = ASSET_CLASS_UI[assetClass];
  const Icon = ui.icon;
  const unit = ui.unit ?? '';
  const [form, setForm] = useState<{ lot: Lot | null } | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [lots, setLots] = useState<Lot[]>([]);
  const [toDelete, setToDelete] = useState<Lot | null>(null);

  const loadLots = async () => {
    try {
      const res = await axios.get('/api/assets/lots', { params: { assetClass } });
      setLots(res.data.data.lots);
    } catch {
      toast.error("Couldn't load your entries");
    }
  };
  const openList = () => { setListOpen(true); loadLots(); };
  const saved = () => { setForm(null); onChanged(); if (listOpen) loadLots(); };
  const remove = async () => {
    if (!toDelete) return;
    try {
      await axios.delete(`/api/assets/lots/${toDelete.id}`);
      setToDelete(null);
      onChanged();
      loadLots();
    } catch (err) {
      setToDelete(null);
      toast.error((isAxiosError(err) && err.response?.data?.message) || "Couldn't delete this entry");
    }
  };

  const gain = holding?.gain ?? null;
  return (
    <section aria-label={ui.label} className="space-y-3 rounded-[24px] bg-card p-5 shadow-resting">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={openList} className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-ring">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted" style={ui.color ? { color: ui.color } : undefined}><Icon className="size-5" /></span>
          <span className="min-w-0">
            <span className="block font-semibold">{ui.label}</span>
            {holding ? (
              <>
                <span className="block text-sm text-muted-foreground tabular-nums">{formatNumber(holding.quantity)} {unit}</span>
                <span className="block text-xl font-bold tabular-nums">{holding.value === null ? '—' : formatCurrency(holding.value, currency)}</span>
                {holding.quantity > 0 && holding.cost !== null && (
                  <span className="block text-xs text-muted-foreground tabular-nums">Avg {formatCurrency(holding.cost / holding.quantity, currency)}/{unit}</span>
                )}
                {gain !== null && (
                  <span className={cn('block text-sm font-semibold tabular-nums', gain >= 0 ? 'text-income' : 'text-expense')}>
                    {gain >= 0 ? '+' : '−'}{formatCurrency(Math.abs(gain), currency)}
                  </span>
                )}
              </>
            ) : (
              <span className="block text-sm text-muted-foreground">No {ui.label.toLowerCase()} yet</span>
            )}
          </span>
        </button>
        <PillButton onClick={() => setForm({ lot: null })}><Plus /> Add purchase</PillButton>
      </div>

      <FormSheet open={listOpen} onOpenChange={setListOpen} title="Purchases">
        {lots.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">Nothing recorded yet</p>
        ) : (
          <ul className="divide-y divide-border">
            {lots.map((lot) => (
              <li key={lot.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">{formatDateDetailed(lot.date)}</p>
                  <p className="font-semibold tabular-nums">{lot.quantity < 0 ? '−' : '+'}{formatNumber(Math.abs(lot.quantity))} {unit}</p>
                </div>
                <p className="tabular-nums">{formatCurrency(Math.abs(lot.totalPaid), lot.currency)}</p>
                <button type="button" aria-label="Edit" className={iconBtn} onClick={() => setForm({ lot })}><Pencil /></button>
                <button type="button" aria-label="Delete" className={iconBtn} onClick={() => setToDelete(lot)}><Trash2 /></button>
              </li>
            ))}
          </ul>
        )}
      </FormSheet>

      <FormSheet open={!!form} onOpenChange={(o) => !o && setForm(null)} title={form?.lot ? 'Edit entry' : 'Add purchase'}>
        {form && <LotForm assetClass={assetClass} currency={currency} lot={form.lot} onSaved={saved} />}
      </FormSheet>

      <ConfirmationModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        title="Delete entry"
        description="This removes the entry from your holdings."
        confirmText="Delete"
      />
    </section>
  );
}
