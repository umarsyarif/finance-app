import { useState } from 'react';
import { isAxiosError } from 'axios';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FilterChips } from '@/components/finance/filter-chips';
import { useWallets } from '@/hooks/use-wallets';
import { useCategories } from '@/hooks/use-categories';
import type { Bill } from '@/hooks/use-bills';

const field = 'h-[52px] rounded-[20px] bg-card px-[18px]';
const select = `${field} w-full border border-border text-[15px]`;

export function BillForm({ bill, onSaved, onDelete }: { bill?: Bill | null; onSaved: () => void; onDelete?: () => void }) {
  const { wallets } = useWallets();
  const { categories } = useCategories();
  const [name, setName] = useState(bill?.name ?? '');
  const [amount, setAmount] = useState(bill ? String(bill.amount) : '');
  const [currency, setCurrency] = useState<'KRW' | 'IDR'>(bill?.currency ?? 'KRW');
  const [walletId, setWalletId] = useState(bill?.walletId ?? '');
  const [categoryId, setCategoryId] = useState(bill?.categoryId ?? '');
  const [day, setDay] = useState(String(bill?.dayOfMonth ?? 1));
  const [remind, setRemind] = useState<string>(String(bill?.remindDaysBefore ?? 1));
  const [active, setActive] = useState(bill?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const changeCurrency = (next: 'KRW' | 'IDR') => {
    setCurrency(next);
    if (wallets.find((w) => w.id === walletId)?.currency !== next) setWalletId('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      name: name.trim(), amount: Number(amount), currency,
      walletId: walletId || null, categoryId: categoryId || null,
      dayOfMonth: Number(day), remindDaysBefore: Number(remind), active,
    };
    setBusy(true);
    setError(null);
    try {
      if (bill) await axios.patch(`/api/bills/${bill.id}`, body);
      else await axios.post('/api/bills', body);
      onSaved();
    } catch (err) {
      setError((isAxiosError(err) && err.response?.data?.message) || "Couldn't save this bill");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="bill-name">Name</Label>
        <Input id="bill-name" maxLength={60} required value={name} onChange={(e) => setName(e.target.value)} className={field} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bill-amount">Amount</Label>
        <Input id="bill-amount" type="number" inputMode="decimal" step="any" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
      </div>
      <FilterChips label="Currency" value={currency} onChange={changeCurrency} options={[{ value: 'KRW', label: 'KRW' }, { value: 'IDR', label: 'IDR' }]} />
      <div className="space-y-2">
        <Label htmlFor="bill-wallet">Wallet</Label>
        <select id="bill-wallet" value={walletId} onChange={(e) => setWalletId(e.target.value)} className={select}>
          <option value="">No wallet</option>
          {wallets.filter((w) => w.currency === currency).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="bill-category">Category</Label>
        <select id="bill-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={select}>
          <option value="">No category</option>
          {categories.filter((c) => c.type === 'EXPENSE').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="bill-day">Day of month</Label>
        <Input id="bill-day" type="number" inputMode="numeric" min={1} max={31} required value={day} onChange={(e) => setDay(e.target.value)} className={field} />
        <p className="text-xs text-muted-foreground">Short months use the last day</p>
      </div>
      <FilterChips label="Remind" value={remind} onChange={setRemind} options={[{ value: '0', label: 'On the due day' }, { value: '1', label: '1 day before' }, { value: '3', label: '3 days before' }]} />
      <div className="flex items-center justify-between">
        <Label htmlFor="bill-active">Active</Label>
        <Switch id="bill-active" checked={active} onCheckedChange={setActive} />
      </div>
      {error && <p role="alert" className="text-sm text-expense">{error}</p>}
      <Button type="submit" disabled={busy} className="h-[52px] w-full rounded-full text-[15px]">{busy ? 'Saving…' : 'Save'}</Button>
      {bill && onDelete && (
        <Button type="button" variant="ghost" onClick={onDelete} className="h-[52px] w-full rounded-full text-[15px] text-expense">Delete</Button>
      )}
    </form>
  );
}
