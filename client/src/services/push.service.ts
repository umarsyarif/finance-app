import axios from '@/lib/axios';

export type PushStatus = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';
export const BLOCKED = 'Notifications are blocked — allow them in Settings → Finance';

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const subscription = async () => {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
};

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
  const { data } = await axios.get('/api/push/key');
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(data.data.publicKey) });
  const { endpoint, keys } = sub.toJSON();
  await axios.post('/api/push/subscribe', { endpoint, keys });
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
