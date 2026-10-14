import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from '@/lib/axios';
import { pushStatus, resyncPush, subscribePush, unsubscribePush } from '@/services/push.service';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), defaults: {} } }));

const sub = { endpoint: 'https://push.example/abc', toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: vi.fn().mockResolvedValue(true) };
const pushManager = { getSubscription: vi.fn(), subscribe: vi.fn() };

const setup = ({ ua = 'Mozilla Chrome', standalone = false, permission = 'default', push = true } = {}) => {
  vi.stubGlobal('navigator', { userAgent: ua, serviceWorker: { ready: Promise.resolve({ pushManager }), getRegistration: vi.fn().mockResolvedValue({ pushManager }) } });
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

  it('does not hang without a service worker registration', async () => {
    setup();
    (navigator.serviceWorker.getRegistration as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    expect(await pushStatus()).toBe('off');
    await unsubscribePush();
    expect(axios.delete).not.toHaveBeenCalled();
  });
  it('shows the server message when the key is unavailable', async () => {
    setup();
    vi.mocked(axios.get).mockRejectedValue(Object.assign(new Error('x'), { isAxiosError: true, response: { data: { message: "Push isn't set up" } } }));
    await expect(subscribePush()).rejects.toThrow("Push isn't set up");
  });
  it('times out when no service worker becomes ready', async () => {
    setup();
    vi.useFakeTimers();
    Object.assign(navigator.serviceWorker, { ready: new Promise(() => {}) });
    vi.mocked(axios.get).mockResolvedValue({ data: { data: { publicKey: 'AQID' } } });
    const p = expect(subscribePush()).rejects.toThrow("Push isn't available right now");
    await vi.advanceTimersByTimeAsync(3100);
    await p;
    vi.useRealTimers();
  });
  it('drops the browser subscription when registering fails', async () => {
    setup();
    vi.mocked(axios.get).mockResolvedValue({ data: { data: { publicKey: 'AQID' } } });
    vi.mocked(axios.post).mockRejectedValue(new Error('boom'));
    await expect(subscribePush()).rejects.toThrow('boom');
    expect(sub.unsubscribe).toHaveBeenCalled();
  });
  it('resyncs the current subscription', async () => {
    setup();
    pushManager.getSubscription.mockResolvedValue(sub);
    vi.mocked(axios.post).mockResolvedValue({});
    await resyncPush();
    expect(axios.post).toHaveBeenCalledWith('/api/push/subscribe', { endpoint: sub.endpoint, keys: { p256dh: 'p', auth: 'a' } });
  });
});
