import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// Loading placeholders shaped like the real content, so nothing jumps when data arrives.
// Shown only after SKELETON_DELAY_MS: a fast load shows nothing instead of a grey flash.
export const SKELETON_DELAY_MS = 200;

/** A pulsing shape. The pulse stops under prefers-reduced-motion (global rule in index.css). */
export function Bone({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-full bg-foreground/[0.07]', className)} />;
}

/** Wraps a skeleton: visible after the delay, read by screen readers as a single "Loading". */
export function Loading({ children, label = 'Loading', className }: { children: React.ReactNode; label?: string; className?: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(true), SKELETON_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);
  // Until the delay passes the shapes keep their space but stay invisible: no grey flash, no layout jump
  return (
    <div role="status" aria-label={label} aria-busy="true" className={cn(!shown && 'invisible')}>
      <div aria-hidden className={className}>{children}</div>
    </div>
  );
}

const card = 'rounded-[24px] bg-card shadow-resting';

/** Icon tile, two text lines, amount on the right: a transaction or notification row */
export function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Bone className="size-12 shrink-0 rounded-[14px]" />
      <div className="min-w-0 flex-1 space-y-2">
        <Bone className="h-3.5 w-2/5" />
        <Bone className="h-3 w-1/4" />
      </div>
      <Bone className="h-3.5 w-16" />
    </div>
  );
}

/** A card of rows, like RowsCard */
export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className={cn(card, 'px-5 py-1 [&>*+*]:border-t [&>*+*]:border-border')}>
      {Array.from({ length: rows }, (_, i) => <RowSkeleton key={i} />)}
    </div>
  );
}

/** Day groups with a small header, like the Transactions list */
export function DayListSkeleton({ days = 2, rows = 3 }: { days?: number; rows?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: days }, (_, d) => (
        <div key={d} className="space-y-2">
          <div className="flex justify-between px-1"><Bone className="h-3 w-24" /><Bone className="h-3 w-20" /></div>
          <RowsSkeleton rows={rows} />
        </div>
      ))}
    </div>
  );
}

/** A wallet card (212px, like WalletCards) */
export function WalletCardSkeleton() {
  return (
    <div className={cn(card, 'flex h-[212px] flex-col justify-between p-6')}>
      <div className="flex items-center gap-3"><Bone className="size-12 rounded-[14px]" /><div className="space-y-2"><Bone className="h-4 w-28" /><Bone className="h-3 w-16" /></div></div>
      <Bone className="h-8 w-40" />
      <div className="flex gap-3"><Bone className="h-3 w-24" /><Bone className="h-3 w-24" /></div>
    </div>
  );
}

/** A small card with a label and a big number (Home total, Assets total) */
export function TotalSkeleton() {
  return (
    <div className={cn(card, 'space-y-2 p-5')}>
      <Bone className="h-3 w-12" />
      <Bone className="h-7 w-44" />
      <Bone className="h-3 w-16" />
    </div>
  );
}

/** Three label/value columns, like the month Summary */
export function SummarySkeleton() {
  return (
    <div className="space-y-3">
      <Bone className="ml-1 h-5 w-24" />
      <div className={cn(card, 'grid grid-cols-3 gap-3 p-5')}>
        {[0, 1, 2].map((i) => <div key={i} className="space-y-2"><Bone className="h-3 w-12" /><Bone className="h-4 w-20" /></div>)}
      </div>
    </div>
  );
}

/** A titled card with bars, like the year chart or the assets distribution */
export function ChartSkeleton() {
  const heights = ['h-16', 'h-24', 'h-12', 'h-28', 'h-20', 'h-32', 'h-14', 'h-24', 'h-20', 'h-28', 'h-16', 'h-24'];
  return (
    <div className={cn(card, 'space-y-3 p-5')}>
      <Bone className="h-5 w-36" />
      <Bone className="h-3 w-48" />
      <div className="flex h-[220px] items-end gap-2">{heights.map((h, i) => <Bone key={i} className={cn('flex-1 rounded-md', h)} />)}</div>
    </div>
  );
}

/** The assets distribution: title, a donut and a short legend */
export function DonutSkeleton() {
  return (
    <div className={cn(card, 'space-y-4 p-5')}>
      <Bone className="h-5 w-28" />
      <div className="flex h-[180px] items-center justify-center">
        <div className="size-[180px] animate-pulse rounded-full border-[34px] border-foreground/[0.07]" />
      </div>
      {[0, 1].map((i) => <div key={i} className="flex items-center gap-3"><Bone className="size-3" /><Bone className="h-3.5 flex-1" /><Bone className="h-3.5 w-16" /></div>)}
    </div>
  );
}

/** A tall card with a title line and a few text lines (asset class, bill, notification) */
export function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className={cn(card, 'space-y-3 p-5')}>
      <div className="flex items-center gap-3"><Bone className="size-12 shrink-0 rounded-[16px]" /><div className="flex-1 space-y-2"><Bone className="h-4 w-1/2" /><Bone className="h-3 w-1/4" /></div></div>
      {Array.from({ length: lines }, (_, i) => <Bone key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />)}
    </div>
  );
}

/** A label with a switch on the right (settings rows) */
export function SettingRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="space-y-2"><Bone className="h-4 w-32" /><Bone className="h-3 w-44" /></div>
      <Bone className="h-6 w-11" />
    </div>
  );
}

/** Field-shaped placeholders for the add sheets */
export function FormSkeleton() {
  return (
    <div className="space-y-4 py-2">
      <div className="flex gap-2"><Bone className="h-11 w-24" /><Bone className="h-11 w-24" /><Bone className="h-11 w-24" /></div>
      <Bone className="h-12 w-48" />
      <Bone className="h-[52px] w-full rounded-[20px]" />
      <div className="flex gap-2"><Bone className="h-11 w-20" /><Bone className="h-11 w-24" /><Bone className="h-11 w-20" /></div>
      <Bone className="h-[52px] w-full" />
    </div>
  );
}
