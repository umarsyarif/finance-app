import { useState } from 'react';
import { isAxiosError } from 'axios';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FilterChips } from '@/components/finance/filter-chips';
import { ASSET_CLASS_UI } from '@/components/assets/asset-classes';

export interface Lot {
  id: string;
  assetClass: string;
  symbol: string;
  date: string;
  quantity: number;
  totalPaid: number;
  currency: string;
  note: string | null;
}

const field = 'h-[52px] rounded-[20px] bg-card px-[18px]';
const pad = (n: number) => String(n).padStart(2, '0');
const toInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// "2026-03-04" -> ISO of local midnight
const toIso = (v: string) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d).toISOString(); };

export function LotForm({ assetClass, currency, lot, onSaved }: { assetClass: string; currency: string; lot?: Lot | null; onSaved: () => void }) {
  const ui = ASSET_CLASS_UI[assetClass];
  const symbols = ui.symbols ?? [];
  const [side, setSide] = useState<'BUY' | 'SELL'>(lot && lot.quantity < 0 ? 'SELL' : 'BUY');
  const [date, setDate] = useState(toInput(lot ? new Date(lot.date) : new Date()));
  const [symbol, setSymbol] = useState(lot?.symbol ?? symbols[0]?.value ?? '');
  const [quantity, setQuantity] = useState(lot ? String(Math.abs(lot.quantity)) : '');
  const [total, setTotal] = useState(lot ? String(Math.abs(lot.totalPaid)) : '');
  const [cur, setCur] = useState(lot?.currency ?? currency);
  const [note, setNote] = useState(lot?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sell = side === 'SELL';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sign = sell ? -1 : 1;
    const body = {
      assetClass, symbol, date: toIso(date),
      quantity: sign * Number(quantity), totalPaid: sign * Number(total), currency: cur,
      ...((note.trim() || lot) && { note: note.trim() }),
    };
    setBusy(true);
    setError(null);
    try {
      if (lot) await axios.patch(`/api/assets/lots/${lot.id}`, body);
      else await axios.post('/api/assets/lots', body);
      onSaved();
    } catch (err) {
      setError((isAxiosError(err) && err.response?.data?.message) || "Couldn't save this entry");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <FilterChips label="Direction" value={side} onChange={setSide} options={[{ value: 'BUY', label: 'Buy' }, { value: 'SELL', label: 'Sell' }]} />
      {symbols.length > 1 && (
        <FilterChips label="Asset" value={symbol} onChange={setSymbol} options={symbols.map((s) => ({ value: s.value, label: s.label }))} />
      )}
      <div className="space-y-2">
        <Label htmlFor="lot-date">Date</Label>
        <Input id="lot-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={field} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lot-qty">{ui.unit === 'g' ? 'Grams' : 'Quantity'}</Label>
        <Input id="lot-qty" type="number" inputMode="decimal" step="any" min="0" required value={quantity} onChange={(e) => setQuantity(e.target.value)} className={field} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lot-total">{sell ? 'Total received' : 'Total paid'}</Label>
        <Input id="lot-total" type="number" inputMode="decimal" step="any" min="0" required value={total} onChange={(e) => setTotal(e.target.value)} className={field} />
      </div>
      <FilterChips label="Currency" value={cur} onChange={setCur} options={['IDR', 'KRW', 'USD'].map((c) => ({ value: c, label: c }))} />
      <div className="space-y-2">
        <Label htmlFor="lot-note">Note</Label>
        <Input id="lot-note" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className={field} />
      </div>
      {error && <p role="alert" className="text-sm text-expense">{error}</p>}
      <Button type="submit" disabled={busy} className="h-[52px] w-full rounded-full text-[15px]">{busy ? 'Saving…' : 'Save'}</Button>
    </form>
  );
}
