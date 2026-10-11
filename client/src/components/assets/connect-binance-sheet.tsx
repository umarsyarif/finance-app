import { useState } from 'react';
import { isAxiosError } from 'axios';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormSheet } from '@/components/assets/manual-class-card';

const field = 'h-[52px] rounded-[20px] bg-card px-[18px]';

export function ConnectBinanceSheet({ open, onOpenChange, onConnected }: { open: boolean; onOpenChange: (open: boolean) => void; onConnected: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await axios.put('/api/assets/sources/binance', { apiKey: apiKey.trim(), apiSecret: apiSecret.trim() });
      onConnected();
    } catch (err) {
      const res = isAxiosError(err) ? err.response : undefined;
      setError(res?.status === 503 ? "Binance sync isn't set up on the server" : res?.data?.message || "Couldn't connect to Binance");
    } finally {
      setApiSecret(''); // never keep the secret after a submit
      setPending(false);
    }
  };

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title="Connect Binance">
      <ol className="mb-5 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
        <li>Binance → Account → API Management → Create API (system generated).</li>
        <li>Keep <strong>only “Enable Reading”</strong> checked.</li>
        <li>Restrict access to trusted IP <strong className="tabular-nums">43.155.186.108</strong>.</li>
        <li>Paste the key and secret.</li>
      </ol>
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="binance-key">API key</Label>
          <Input id="binance-key" required autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className={field} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="binance-secret">API secret</Label>
          <Input id="binance-secret" type="password" required autoComplete="off" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} className={field} />
        </div>
        {error && <p role="alert" className="text-sm text-expense">{error}</p>}
        <Button type="submit" disabled={pending} className="h-[52px] w-full rounded-full text-[15px]">{pending ? 'Connecting…' : 'Connect'}</Button>
      </form>
    </FormSheet>
  );
}
