import crypto from 'crypto';

// The only caller of signed Binance endpoints. Read-only: account data, never orders or transfers.
export const BINANCE_BASE = 'https://api.binance.com';
export type BinanceCreds = { apiKey: string; apiSecret: string };
export class BinanceError extends Error {}

const FORBIDDEN = [
  'enableSpotAndMarginTrading', 'enableWithdrawals', 'enableInternalTransfer',
  'enableMargin', 'enableFutures', 'permitsUniversalTransfer', 'enableVanillaOptions',
] as const;

export const sign = (query: string, secret: string) => crypto.createHmac('sha256', secret).update(query).digest('hex');

async function signedRequest<T>(method: 'GET' | 'POST', path: string, params: Record<string, string | number>, creds: BinanceCreds): Promise<T> {
  const query = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), recvWindow: '10000', timestamp: String(Date.now()) }).toString();
  const url = `${BINANCE_BASE}${path}?${query}&signature=${sign(query, creds.apiSecret)}`;
  let res: Response;
  try {
    res = await fetch(url, { method, headers: { 'X-MBX-APIKEY': creds.apiKey }, signal: AbortSignal.timeout(10_000) });
  } catch {
    console.error(`Binance request failed: ${path} network`);
    throw new BinanceError("Couldn't reach Binance");
  }
  const body = (await res.json().catch(() => ({}))) as { msg?: string };
  if (!res.ok) {
    const msg = body.msg ?? `HTTP ${res.status}`;
    console.error(`Binance request failed: ${path} ${res.status} ${msg}`);
    throw new BinanceError(msg);
  }
  return body as T;
}

export async function checkReadOnly(creds: BinanceCreds): Promise<void> {
  const r = await signedRequest<Record<string, boolean>>('GET', '/sapi/v1/account/apiRestrictions', {}, creds);
  if (!r.enableReading || FORBIDDEN.some((p) => r[p])) {
    throw new BinanceError('Use a read-only key: turn off trading, withdrawals and transfers');
  }
}

// Spot + Funding + Simple Earn (flexible and locked), summed per coin
export async function fetchBalances(creds: BinanceCreds): Promise<Record<string, number>> {
  const add = (acc: Record<string, number>, asset: string, amount: number) => {
    if (!amount || asset.startsWith('LD')) return; // LD* = legacy savings tokens, mirrored by Earn
    acc[asset] = (acc[asset] ?? 0) + amount;
  };
  const [spot, funding, flexible, locked] = await Promise.all([
    signedRequest<{ balances: { asset: string; free: string; locked: string }[] }>('GET', '/api/v3/account', { omitZeroBalances: 'true' }, creds),
    signedRequest<{ asset: string; free: string; locked: string; freeze: string }[]>('POST', '/sapi/v1/asset/get-funding-asset', {}, creds),
    signedRequest<{ rows: { asset: string; totalAmount: string }[] }>('GET', '/sapi/v1/simple-earn/flexible/position', { size: 100 }, creds),
    signedRequest<{ rows: { asset: string; amount: string }[] }>('GET', '/sapi/v1/simple-earn/locked/position', { size: 100 }, creds),
  ]);
  const acc: Record<string, number> = {};
  for (const b of spot.balances) add(acc, b.asset, Number(b.free) + Number(b.locked));
  for (const b of funding) add(acc, b.asset, Number(b.free) + Number(b.locked) + Number(b.freeze));
  for (const r of flexible.rows ?? []) add(acc, r.asset, Number(r.totalAmount));
  for (const r of locked.rows ?? []) add(acc, r.asset, Number(r.amount));
  return acc;
}
