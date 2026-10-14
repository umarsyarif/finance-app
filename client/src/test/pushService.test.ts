import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from '@/lib/axios';
import { pushStatus, subscribePush, unsubscribePush } from '@/services/push.service';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), defaults: {} } }));

const sub = { endpoint: 'https://push.example/abc', toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: vi.fn().mockResolvedValue(true) };
const pushManager = { getSubscription: vi.fn(), subscribe: vi.fn() };

const setup = ({ ua = 'Mozilla Chrome', standalone = false, permission = 'default', push = true } = {}) => {
  vi.stubGlobal('navigator', { userAgent: ua, serviceWorker: { ready: Promise.resolve({ pushManager }) } });
  vi.stubGlobal('matchMedia', () => ({ matches: standalone }));
  if (push) vi.stubGlobal('PushManager', class {}); else delete (window as unknown as Record<string, unknown>).PushManager;
  vi.stubGlobal('Notification', { permission, requestPermission: vi.fn().mockResolvedValue(permission === 'default' ? 'granted' : permission) });
};

describe('push.service', () => {
  beforeEach(() => { vi.clearAllMocks(); pushManager.getSubscription.mockResolvedValue(null); pushManager.subscribe.mockResolvedValue(sub); });
  afterEach(() => vi.unstubAllGlobals());

  it('is unsupported without PushManager', async () => {
    setup({ push: false });
    expect(await pushStatus()).toBe('unsupported');
  });
  it('needs install on iOS outside standalone', async () => {
    setup({ ua: 'Mozilla iPhone' });
    expect(await pushStatus()).toBe('needs-install');
  });
  it('is denied when permission is denied', async () => {
    setup({ permission: 'denied' });
    expect(await pushStatus()).toBe('denied');
  });
  it('is off or on by subscription', async () => {
    setup();
    expect(await pushStatus()).toBe('off');
    pushManager.getSubscription.mockResolvedValue(sub);
    expect(await pushStatus()).toBe('on');
  });
  it('subscribes and registers with the server', async () => {
    setup();
    vi.mocked(axios.get).mockResolvedValue({ data: { data: { publicKey: 'AQID' } } });
    vi.mocked(axios.post).mockResolvedValue({});
    await subscribePush();
    expect(axios.get).toHaveBeenCalledWith('/api/push/key');
    const arg = pushManager.subscribe.mock.calls[0][0];
    expect(arg.userVisibleOnly).toBe(true);
    expect(arg.applicationServerKey).toBeInstanceOf(Uint8Array);
    expect(axios.post).toHaveBeenCalledWith('/api/push/subscribe', { endpoint: sub.endpoint, keys: { p256dh: 'p', auth: 'a' } });
  });
  it('rejects when permission is denied', async () => {
    setup({ permission: 'denied' });
    await expect(subscribePush()).rejects.toThrow('Notifications are blocked — allow them in Settings → Finance');
  });
  it('unsubscribes locally and on the server', async () => {
    setup();
    pushManager.getSubscription.mockResolvedValue(sub);
    vi.mocked(axios.delete).mockResolvedValue({});
    await unsubscribePush();
    expect(sub.unsubscribe).toHaveBeenCalled();
    expect(axios.delete).toHaveBeenCalledWith('/api/push/subscribe', { data: { endpoint: sub.endpoint } });
  });
  it('does nothing without a subscription', async () => {
    setup();
    await unsubscribePush();
    expect(axios.delete).not.toHaveBeenCalled();
  });
});
