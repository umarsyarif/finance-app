import axios from '@/lib/axios';
import { isAxiosError } from 'axios';

export type PushStatus = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';
export const BLOCKED = 'Notifications are blocked — allow them in Settings → Finance';

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

// getRegistration() resolves even with no active service worker (`ready` would hang forever)
const subscription = async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
};

const readyRegistration = () =>
  Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Push isn't available right now — reload and try again")), 3000)),
  ]);

const keyBytes = (base64url: string) => {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export async function pushStatus(): Promise<PushStatus> {
  if (isIos() && !isStandalone()) return 'needs-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return (await subscription()) ? 'on' : 'off';
}

export async function subscribePush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(BLOCKED);
  try {
    const { data } = await axios.get('/api/push/key');
    const reg = await readyRegistration();
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(data.data.publicKey) });
    const { endpoint, keys } = sub.toJSON();
    try {
      await axios.post('/api/push/subscribe', { endpoint, keys });
    } catch (err) {
      await sub.unsubscribe().catch(() => {}); // no orphan browser subscription
      throw err;
    }
  } catch (err) {
    if (isAxiosError(err)) throw new Error(err.response?.data?.message || "Couldn't turn on push");
    throw err instanceof Error ? err : new Error("Couldn't turn on push");
  }
}

// Re-registers the current subscription (server upsert is idempotent) so a lost server row is healed
export async function resyncPush(): Promise<void> {
  try {
    const sub = await subscription();
    if (!sub) return;
    const { endpoint, keys } = sub.toJSON();
    await axios.post('/api/push/subscribe', { endpoint, keys });
  } catch {
    // best effort
  }
}

export async function unsubscribePush(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;
    const sub = await subscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await axios.delete('/api/push/subscribe', { data: { endpoint } });
  } catch {
    // Logging out or turning push off must not fail on a flaky push service
  }
}
