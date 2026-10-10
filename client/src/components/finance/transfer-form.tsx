import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { Button } from '../ui/button';
import { DateTimePicker } from '../ui/datetime-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { useWallets } from '@/hooks/use-wallets';
import { counterpart, type Transaction } from './transactions-list';
import axios from '@/lib/axios';

const CURRENCY_SYMBOL: Record<string, string> = { KRW: '₩', IDR: 'Rp' };

interface TransferFormProps {
  transaction?: Transaction; // a transfer row: edit that transfer
  defaultWalletId?: string;
  onSuccess?: () => void;
}

// Prefill from a transfer row: the EXPENSE side is "from", the INCOME side is "to"
function initial(transaction?: Transaction) {
  const other = transaction && counterpart(transaction);
  if (!transaction || !other) return null;
  const outgoing = transaction.type === 'EXPENSE';
  return {
    fromWalletId: outgoing ? transaction.walletId : other.wallet.id,
    toWalletId: outgoing ? other.wallet.id : transaction.walletId,
    amount: String(outgoing ? transaction.amount : other.amount),
    received: String(outgoing ? other.amount : transaction.amount),
    date: transaction.date,
    note: transaction.transfer?.note ?? '',
  };
}

export function TransferForm({ transaction, defaultWalletId, onSuccess }: TransferFormProps) {
  const { wallets, loading, error } = useWallets();
  const start = initial(transaction);
  const [fromWalletId, setFrom] = useState(start?.fromWalletId ?? '');
  const [toWalletId, setTo] = useState(start?.toWalletId ?? '');
  const [amount, setAmount] = useState(start?.amount ?? '');
  const [received, setReceived] = useState(start?.received ?? '');
  const [date, setDate] = useState(start?.date ?? new Date().toISOString());
  const [note, setNote] = useState(start?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // New transfers start from the given wallet, else the main wallet, else the first one
  useEffect(() => {
    if (fromWalletId || wallets.length === 0) return;
    setFrom(defaultWalletId ?? (wallets.find((w) => w.isMain) ?? wallets[0]).id);
  }, [defaultWalletId, fromWalletId, wallets]);

  const from = wallets.find((w) => w.id === fromWalletId);
  const to = wallets.find((w) => w.id === toWalletId);
  const cross = Boolean(from && to && from.currency !== to.currency);
  const sent = parseFloat(amount);
  const got = parseFloat(received);
  const rate = cross && sent > 0 && got > 0 ? Number((got / sent).toPrecision(6)) : null;

  const chooseFrom = (id: string) => {
    if (!id) return; // Radix Select can emit "" while its options mount
    setFrom(id);
    if (id === toWalletId) setTo('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!navigator.onLine) return setSubmitError('Transfers need a connection');
    if (!from || !to) return setSubmitError('Pick both wallets');
    if (!(sent > 0)) return setSubmitError('Valid amount is required');
    if (cross && !(got > 0)) return setSubmitError('Enter the amount received');

    const body = {
      fromWalletId,
      toWalletId,
      amountSent: sent,
      amountReceived: cross ? got : undefined,
      date,
      note: note.trim() || undefined,
    };
    setSaving(true);
    try {
      if (transaction?.transferId) await axios.patch(`/api/transfers/${transaction.transferId}`, body);
      else await axios.post('/api/transfers', body);
      onSuccess?.();
    } catch (err) {
      setSubmitError((isAxiosError(err) && err.response?.data?.message) || "Couldn't save the transfer. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && wallets.length === 0) return <p className="py-8 text-center text-muted-foreground">Loading…</p>;
  if (error && wallets.length === 0) return <p className="py-8 text-center text-expense">Couldn't load your wallets: {error}</p>;

  const field = 'h-[52px] w-full rounded-[20px] border border-border bg-card px-[18px] text-[15px] outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>From wallet</Label>
          <Select value={fromWalletId} onValueChange={chooseFrom}>
            <SelectTrigger aria-label="From wallet" className="h-11 w-full rounded-full bg-card"><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>
              {wallets.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>To wallet</Label>
          <Select value={toWalletId} onValueChange={(id) => id && setTo(id)}>
            <SelectTrigger aria-label="To wallet" className="h-11 w-full rounded-full bg-card"><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>
              {wallets.filter((w) => w.id !== fromWalletId).map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="transfer-amount" className="text-xs text-muted-foreground">Amount</Label>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-muted-foreground">{CURRENCY_SYMBOL[from?.currency ?? ''] ?? ''}</span>
          <input id="transfer-amount" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0" required
            value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-transparent text-[32px] font-bold leading-tight tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/50" />
        </div>
      </div>

      {cross && to && (
        <div>
          <Label htmlFor="transfer-received" className="text-xs text-muted-foreground">Received ({to.currency})</Label>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-muted-foreground">{CURRENCY_SYMBOL[to.currency] ?? ''}</span>
            <input id="transfer-received" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0" required
              value={received} onChange={(e) => setReceived(e.target.value)}
              className="w-full bg-transparent text-[32px] font-bold leading-tight tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/50" />
          </div>
          {rate !== null && <p className="mt-1 text-sm text-muted-foreground">1 {from!.currency} = {rate} {to.currency}</p>}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="transfer-note">Note</Label>
        <input id="transfer-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} className={field} placeholder="Optional" maxLength={255} />
      </div>

      <div className="space-y-2">
        <Label>Date</Label>
        <DateTimePicker
          date={date ? new Date(date) : undefined}
          onSelect={(d) => d && setDate(d.toISOString())}
          placeholder="Pick a date"
          showTime={true}
          className="h-11 w-full rounded-full bg-card"
        />
      </div>

      {submitError && <p role="alert" className="text-sm text-expense">{submitError}</p>}

      <Button type="submit" disabled={saving} className="h-[52px] w-full rounded-full text-[15px]">
        {saving ? 'Saving…' : 'Save transfer'}
      </Button>
    </form>
  );
}
