import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';

interface TokenStatus {
  exists: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
}

const formatDateTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const apiMessage = (err: unknown) => (isAxiosError(err) ? err.response?.data?.message : undefined);

// Personal API token for the iOS Shortcut (Settings → Security)
export function ApiTokenSettings() {
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<'generating' | 'revoking' | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [confirm, setConfirm] = useState<'replace' | 'revoke' | null>(null);
  const apiUrl = axios.defaults.baseURL;

  const load = async () => {
    const { data } = await axios.get('/api/users/me/api-token');
    setStatus(data.data);
  };

  const initialLoad = () => {
    setLoadError(false);
    load().catch(() => setLoadError(true));
  };

  useEffect(initialLoad, []);

  const generate = async () => {
    setBusy('generating');
    try {
      const { data } = await axios.post('/api/users/me/api-token');
      setNewToken(data.data.token);
      setStatus({ exists: true, createdAt: new Date().toISOString(), lastUsedAt: null });
      setLoadError(false);
      load().catch(() => {});
    } catch (err) {
      toast.error(apiMessage(err) || "Couldn't create a token");
    } finally {
      setBusy(null);
    }
  };

  const revoke = async () => {
    setBusy('revoking');
    try {
      await axios.delete('/api/users/me/api-token');
      setNewToken(null);
      setStatus({ exists: false, createdAt: null, lastUsedAt: null });
      toast.success('Token revoked');
      load().catch(() => {});
    } catch (err) {
      toast.error(apiMessage(err) || "Couldn't revoke the token");
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(newToken);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed; select the token and copy it manually');
    }
  };

  return (
    <section className="space-y-4 rounded-[24px] bg-card p-5 shadow-resting">
      <div>
        <h2 className="text-[19px] font-bold">Shortcut token</h2>
        <p className="text-sm text-muted-foreground">Lets your iOS Shortcut add transactions. It can only add transactions.</p>
      </div>

      {loadError ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-expense">Couldn't load token status</p>
          <Button type="button" variant="secondary" className="h-11 rounded-full" onClick={initialLoad}>Retry</Button>
        </div>
      ) : (
      <p className="text-sm">
        {!status ? 'Loading…' : !status.exists ? 'No token yet' : (
          <>
            Created {formatDateTime(status.createdAt!)} · {status.lastUsedAt ? `last used ${formatDateTime(status.lastUsedAt)}` : 'not used yet'}
          </>
        )}
      </p>
      )}

      {newToken && (
        <div role="status" className="space-y-2 rounded-[20px] bg-lime-soft p-4">
          <p className="text-sm font-semibold">Copy it now. It won't be shown again.</p>
          <code data-testid="new-api-token" className="block select-all break-all text-sm">{newToken}</code>
          <Button type="button" variant="secondary" className="h-11 rounded-full" onClick={copy}>Copy token</Button>
        </div>
      )}

      {status && !loadError && (
        <div className="flex gap-3">
          <Button type="button" disabled={!!busy} className="h-11 flex-1 rounded-full" onClick={status.exists ? () => setConfirm('replace') : generate}>
            {busy === 'generating' ? 'Generating…' : status.exists ? 'Regenerate' : 'Generate token'}
          </Button>
          {status.exists && (
            <Button type="button" variant="secondary" disabled={!!busy} className="h-11 rounded-full text-expense" onClick={() => setConfirm('revoke')}>
              {busy === 'revoking' ? 'Revoking…' : 'Revoke'}
            </Button>
          )}
        </div>
      )}

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>In the Shortcut, use “Get Contents of URL”:</p>
        <p>POST <code className="break-all text-foreground">{apiUrl}/api/capture/text</code></p>
        <p>Header <code className="text-foreground">Authorization: Bearer &lt;token&gt;</code></p>
        <p>JSON body <code className="text-foreground">{'{"text": <extracted text>}'}</code>, then show the response's <code className="text-foreground">message</code>.</p>
      </div>
      <ConfirmationModal
        isOpen={confirm === 'replace'}
        onClose={() => setConfirm(null)}
        onConfirm={async () => { await generate(); setConfirm(null); }}
        title="Replace token?"
        description="Your Shortcut stops working until you paste the new token into it."
        confirmText="Replace"
        isLoading={busy === 'generating'}
      />
      <ConfirmationModal
        isOpen={confirm === 'revoke'}
        onClose={() => setConfirm(null)}
        onConfirm={async () => { await revoke(); setConfirm(null); }}
        title="Revoke token?"
        description="Your Shortcut stops working."
        confirmText="Revoke"
        isLoading={busy === 'revoking'}
      />
    </section>
  );
}
