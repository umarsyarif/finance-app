import { useEffect, useRef } from 'react';
import { ScanFace } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Full-screen gate shown while the app is locked; the app itself isn't rendered behind it
export function LockScreen({ onUnlock, onUsePassword, error, pending }: { onUnlock: () => void; onUsePassword: () => void; error: string | null; pending: boolean }) {
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    onUnlock();
  }, [onUnlock]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <img src="/favicon.svg" alt="" className="size-16" />
      <div className="space-y-1">
        <ScanFace aria-hidden className="mx-auto size-8 text-muted-foreground" />
        <h1 className="text-[19px] font-bold">Unlock with Face ID</h1>
        {error && <p role="alert" className="text-sm text-muted-foreground">{error}</p>}
      </div>
      <Button className="h-[52px] w-full max-w-xs rounded-full text-[15px]" disabled={pending} onClick={onUnlock}>Try again</Button>
      <button type="button" className="text-sm text-muted-foreground underline" onClick={onUsePassword}>Use password instead</button>
    </main>
  );
}
