import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import axios from '@/lib/axios';
import { PillButton } from '@/components/page-header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { ASSET_CLASS_UI } from '@/components/assets/asset-classes';
import { ConnectBinanceSheet } from '@/components/assets/connect-binance-sheet';
import { CostSheet } from '@/components/assets/cost-sheet';
import type { Holding, Portfolio } from '@/hooks/use-portfolio';
import { formatCurrency, formatNumber } from '@/lib/format-utils';
import { cn } from '@/lib/utils';

function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

export function SyncedClassCard({ assetClass, holdings, status, currency, onChanged, onSync }: {
  assetClass: string; holdings: Holding[]; status: Portfolio['sources']['binance'] | undefined; currency: string; onChanged: () => void; onSync: () => void;
}) {
  const ui = ASSET_CLASS_UI[assetClass];
  const Icon = ui.icon;
  const [connectOpen, setConnectOpen] = useState(false);
  const [costFor, setCostFor] = useState<Holding | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);

  const disconnect = async () => {
    setConfirmOff(false);
    try {
      await axios.delete('/api/assets/sources/binance');
      onChanged();
    } catch (err) {
      toast.error((isAxiosError(err) && err.response?.data?.message) || "Couldn't disconnect");
    }
  };

  return (
    <section aria-label={ui.label} className="space-y-3 rounded-[24px] bg-card p-5 shadow-resting">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"><Icon className="size-5" /></span>
          <div className="min-w-0">
            <p className="font-semibold">{ui.label} <span className="text-sm font-normal text-muted-foreground">· Binance</span></p>
            {status?.connected && status.lastSyncedAt && <p className="text-xs text-muted-foreground">Last synced {ago(status.lastSyncedAt)}</p>}
          </div>
        </div>
        {status?.connected ? (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={`${ui.label} options`} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted hover:bg-border focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-4"><MoreVertical /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onSync}>Sync now</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setConfirmOff(true)}>Disconnect</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <PillButton onClick={() => setConnectOpen(true)}>Connect Binance</PillButton>
        )}
      </div>

      {status?.connected && status.error && <p className="text-sm text-expense">Couldn't sync: {status.error}</p>}

      {status?.connected && holdings.length === 0 && <p className="text-sm text-muted-foreground">No coins over $1 yet</p>}

      {status?.connected && holdings.length > 0 && (
        <ul className="divide-y divide-border">
          {holdings.map((h) => (
            <li key={h.symbol} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold">{h.symbol}</p>
                <p className="text-sm text-muted-foreground tabular-nums">{formatNumber(h.quantity, { maximumSignificantDigits: 8 })}</p>
              </div>
              <div className="text-right tabular-nums">
                <p className="font-semibold">{h.value === null ? 'No price' : formatCurrency(h.value, currency)}</p>
                {h.gain !== null ? (
                  <p className={cn('text-xs font-semibold', h.gain >= 0 ? 'text-income' : 'text-expense')}>
                    {h.gain >= 0 ? '+' : '−'}{formatCurrency(Math.abs(h.gain), currency)}{h.gainPct !== null && ` (${h.gainPct.toFixed(1)}%)`}
                  </p>
                ) : null}
                <button type="button" onClick={() => setCostFor(h)} className="text-xs font-semibold underline focus-visible:outline-2 focus-visible:outline-ring">{h.cost === null ? 'Add cost' : 'Edit cost'}</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConnectBinanceSheet key={String(connectOpen)} open={connectOpen} onOpenChange={setConnectOpen} onConnected={() => { setConnectOpen(false); onChanged(); }} />
      <CostSheet key={costFor?.symbol ?? ''} assetClass={assetClass} symbol={costFor?.symbol ?? null} hasCost={costFor?.cost != null} onClose={() => setCostFor(null)} onSaved={() => { setCostFor(null); onChanged(); }} />
      <ConfirmationModal isOpen={confirmOff} onClose={() => setConfirmOff(false)} onConfirm={disconnect} title="Disconnect Binance" description="Your coins are removed from Assets and the stored key is deleted." confirmText="Disconnect" />
    </section>
  );
}
