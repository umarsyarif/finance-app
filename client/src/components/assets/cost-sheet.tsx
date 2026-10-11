import { useState } from 'react';
import { isAxiosError } from 'axios';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FilterChips } from '@/components/finance/filter-chips';
import { FormSheet } from '@/components/assets/form-sheet';

export function CostSheet({ assetClass, symbol, hasCost, onClose, onSaved }: { assetClass: string; symbol: string | null; hasCost: boolean; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState('');
  const [cur, setCur] = useState('USD');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (body: { costAmount: number | null; costCurrency: string }) => {
    setBusy(true);
    setError(null);
    try {
      await axios.put(`/api/assets/costs/${assetClass}/${symbol}`, body);
      onSaved();
    } catch (err) {
      setError((isAxiosError(err) && err.response?.data?.message) || "Couldn't save the cost");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormSheet open={!!symbol} onOpenChange={(o) => !o && onClose()} title={`${symbol ?? ''} cost`}>
      <form onSubmit={(e) => { e.preventDefault(); send({ costAmount: Number(amount), costCurrency: cur }); }} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="cost-amount">Cost</Label>
          <Input id="cost-amount" type="number" inputMode="decimal" step="any" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} className="h-[52px] rounded-[20px] bg-card px-[18px]" />
        </div>
        <FilterChips label="Currency" value={cur} onChange={setCur} options={['USD', 'KRW', 'IDR'].map((c) => ({ value: c, label: c }))} />
        {error && <p role="alert" className="text-sm text-expense">{error}</p>}
        <Button type="submit" disabled={busy} className="h-[52px] w-full rounded-full text-[15px]">{busy ? 'Saving…' : 'Save'}</Button>
        {hasCost && (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => send({ costAmount: null, costCurrency: cur })} className="h-[52px] w-full rounded-full text-[15px]">Remove cost</Button>
        )}
      </form>
    </FormSheet>
  );
}
