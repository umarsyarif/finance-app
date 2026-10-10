import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Plus } from 'lucide-react';
import { isAxiosError, isCancel } from 'axios';
import { Button } from '../ui/button';
import { DateTimePicker } from '../ui/datetime-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { useTransactionForm } from '../../hooks/use-transaction-form';
import type { TransactionDraft } from '../../hooks/use-transaction-form';
import { downscaleImage } from '@/lib/image';
import { Transaction } from './transactions-list';
import { TransferForm } from './transfer-form';
import { cn } from '@/lib/utils';
import axios from '@/lib/axios';

type TransactionType = 'INCOME' | 'EXPENSE';

interface TransactionFormProps {
  type?: TransactionType;
  transaction?: Transaction;
  onSuccess?: () => void;
  submitButtonText?: string;
  defaultWalletId?: string;
}

const CURRENCY_SYMBOL: Record<string, string> = { KRW: '₩', IDR: 'Rp' };

// Pill used for the type switch and category choices
function ChoiceChip({ selected, className, ...props }: React.ComponentProps<'button'> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'h-11 shrink-0 rounded-full px-4 text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        selected ? 'bg-lime-soft text-foreground font-semibold' : 'bg-card text-muted-foreground border border-border hover:text-foreground',
        className
      )}
      {...props}
    />
  );
}

export function TransactionForm({
  type: initialType,
  transaction,
  onSuccess,
  submitButtonText,
  defaultWalletId,
}: TransactionFormProps) {
  const [type, setType] = useState<TransactionType | 'TRANSFER'>(initialType ?? transaction?.type ?? 'EXPENSE');
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scanId = useRef(0);
  const scanAbort = useRef<AbortController | null>(null);
  useEffect(() => () => scanAbort.current?.abort(), []);

  const {
    formData,
    updateField,
    applyDraft,
    submitForm,
    isSubmitting,
    submitError,
    wallets,
    categories,
    loadingWallets,
    loadingCategories,
    walletsError,
    categoriesError,
    refetchCategories,
  } = useTransactionForm({ type: type === 'TRANSFER' ? undefined : type, transaction, onSuccess, defaultWalletId });

  const wallet = wallets.find((w) => w.id === formData.walletId);

  const switchType = (next: TransactionType | 'TRANSFER') => {
    setType(next);
    updateField('categoryId', '');
  };

  const createCategory = async () => {
    const name = newCategory?.trim();
    if (!name) return;
    if (type === 'TRANSFER') return;
    const response = await axios.post('/api/categories', { name, type });
    await refetchCategories();
    updateField('categoryId', response.data.data.category.id);
    setNewCategory(null);
  };

  // Photo → AI draft → form. Nothing is saved until the user taps Save.
  const scanPhoto = async (file: File | undefined) => {
    if (!file) return;
    scanAbort.current?.abort();
    const controller = new AbortController();
    scanAbort.current = controller;
    const id = ++scanId.current;
    const current = () => id === scanId.current;
    setScanning(true);
    setScanError(null);
    setScanned(false);
    try {
      let payload;
      try {
        payload = await downscaleImage(file);
      } catch {
        if (current()) setScanError("This image format isn't supported. Try a JPEG or PNG screenshot.");
        return;
      }
      const { data } = await axios.post('/api/capture/photo', payload, { signal: controller.signal });
      if (!current()) return;
      const draft: TransactionDraft = data.data.draft;
      setType(draft.type);
      await refetchCategories(); // the draft may use a just-created "Other" category
      if (!current()) return;
      applyDraft(draft);
      setScanned(true);
    } catch (err) {
      if (!current() || controller.signal.aborted || isCancel(err)) return;
      setScanError((isAxiosError(err) && err.response?.data?.message) || "Couldn't read the photo. Enter the details manually.");
    } finally {
      if (current()) {
        setScanning(false);
        if (fileInput.current) fileInput.current.value = '';
      }
    }
  };

  if ((loadingWallets && wallets.length === 0) || (loadingCategories && categories.length === 0)) {
    return <p className="py-8 text-center text-muted-foreground">Loading…</p>;
  }

  if ((walletsError && wallets.length === 0) || (categoriesError && categories.length === 0)) {
    return <p className="py-8 text-center text-expense">Couldn't load your data: {walletsError || categoriesError}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div role="group" aria-label="Type" className="flex gap-2">
          <ChoiceChip className="px-3" selected={type === 'EXPENSE'} onClick={() => switchType('EXPENSE')}>Expense</ChoiceChip>
          <ChoiceChip className="px-3" selected={type === 'INCOME'} onClick={() => switchType('INCOME')}>Income</ChoiceChip>
          {!transaction && (
            <ChoiceChip className="px-3" selected={type === 'TRANSFER'} onClick={() => switchType('TRANSFER')}>Transfer</ChoiceChip>
          )}
        </div>
        {!transaction && type !== 'TRANSFER' && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              aria-label="Scan photo"
              className="sr-only"
              tabIndex={-1}
              disabled={scanning}
              onChange={(e) => scanPhoto(e.target.files?.[0])}
            />
            {/* Icon-only so Expense / Income / Transfer / Scan fit on one line at phone width */}
            <ChoiceChip aria-label="Scan" className="ml-auto flex size-11 items-center justify-center px-0" disabled={scanning} onClick={() => fileInput.current?.click()}>
              {scanning ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
            </ChoiceChip>
          </>
        )}
      </div>

      {type === 'TRANSFER' ? (
        <TransferForm defaultWalletId={defaultWalletId} onSuccess={onSuccess} />
      ) : (
      <form onSubmit={submitForm} className="space-y-6">
      <div role="status" aria-live="polite">
        {scanning && <p className="text-sm text-muted-foreground">Reading photo…</p>}
        {scanned && <p className="rounded-[20px] bg-lime-soft px-4 py-3 text-sm font-semibold">Filled from photo. Check before saving.</p>}
      </div>
      {scanError && <p role="alert" className="text-sm text-expense">{scanError}</p>}

      <div>
        <Label htmlFor="amount" className="text-xs text-muted-foreground">Amount</Label>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-muted-foreground">{CURRENCY_SYMBOL[wallet?.currency ?? ''] ?? ''}</span>
          <input
            id="amount"
            type="number"
            inputMode="decimal"
            value={formData.amount}
            onChange={(e) => updateField('amount', e.target.value)}
            className="w-full bg-transparent text-[32px] font-bold leading-tight tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/50"
            placeholder="0"
            step="0.01"
            min="0"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <input
          id="description"
          type="text"
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          className="h-[52px] w-full rounded-[20px] border border-border bg-card px-[18px] text-[15px] outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          placeholder="What was it for?"
          required
        />
      </div>

      <div className="space-y-2">
        <Label id="category-label">Category</Label>
        <div role="group" aria-labelledby="category-label" className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
          {categories.map((category) => (
            <ChoiceChip
              key={category.id}
              selected={formData.categoryId === category.id}
              onClick={() => updateField('categoryId', category.id)}
            >
              {category.name}
            </ChoiceChip>
          ))}
          {newCategory === null && (
            <ChoiceChip onClick={() => setNewCategory('')}>
              <span className="flex items-center gap-1"><Plus className="size-4" /> New</span>
            </ChoiceChip>
          )}
        </div>
        {newCategory !== null && (
          <div className="flex gap-2">
            <input
              aria-label="New category name"
              autoFocus
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createCategory(); } }}
              placeholder="Category name"
              className="h-11 flex-1 rounded-full border border-border bg-card px-4 text-[15px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <Button type="button" className="h-11 rounded-full px-5" onClick={createCategory}>Add</Button>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>Wallet</Label>
          {/* Radix Select can emit "" while its options mount; never let that clear the wallet */}
          <Select value={formData.walletId} onValueChange={(value) => value && updateField('walletId', value)}>
            <SelectTrigger aria-label="Wallet" className="h-11 w-full rounded-full bg-card">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {wallets.map((w) => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Date</Label>
          <DateTimePicker
            date={formData.date ? new Date(formData.date) : undefined}
            onSelect={(date) => updateField('date', date ? date.toISOString() : '')}
            placeholder="Pick a date"
            showTime={true}
            className="h-11 w-full rounded-full bg-card"
          />
        </div>
      </div>

      {submitError && <p role="alert" className="text-sm text-expense">{submitError}</p>}

      <Button type="submit" disabled={isSubmitting || scanning} className="h-[52px] w-full rounded-full text-[15px]">
        {isSubmitting ? 'Saving…' : submitButtonText ?? (type === 'INCOME' ? 'Save income' : 'Save expense')}
      </Button>
      </form>
      )}
    </div>
  );
}
