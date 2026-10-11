import crypto from 'crypto';

// The only caller of signed Binance endpoints. Read-only: account data, never orders or transfers.
export const BINANCE_BASE = 'https://api.binance.com';
export type BinanceCreds = { apiKey: string; apiSecret: string };
export class BinanceError extends Error {}

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
  const r = await signedRequest<Record<string, unknown>>('GET', '/sapi/v1/account/apiRestrictions', {}, creds);
  // allowlist: reading only; any other enable*/permits* flag (new ones included) means the key can do more
  const extra = Object.entries(r).some(([k, v]) => v === true && /^(enable|permits)/.test(k) && k !== 'enableReading' && k !== 'enableFixReadOnly');
  if (r.enableReading !== true || extra) {
    throw new BinanceError('Use a read-only key: turn off trading, withdrawals and transfers');
  }
}

type Earn = { rows?: { asset: string; totalAmount?: string; amount?: string }[]; total?: number };

// Simple Earn pages are 1-indexed; stop once we have `total` rows or a page comes back empty
async function earnRows(path: string, creds: BinanceCreds) {
  const rows: NonNullable<Earn['rows']> = [];
  for (let current = 1; ; current++) {
    const page = await signedRequest<Earn>('GET', path, { size: 100, current }, creds);
    const got = page.rows ?? [];
    rows.push(...got);
    if (!got.length || rows.length >= (page.total ?? 0)) return rows;
  }
}

// Spot + Funding + Simple Earn (flexible and locked), summed per coin
export async function fetchBalances(creds: BinanceCreds): Promise<Record<string, number>> {
  const acc: Record<string, number> = {};
  const add = (asset: string, amount: number) => {
    if (amount) acc[asset] = (acc[asset] ?? 0) + amount;
  };
  const [spot, funding, flexible, locked] = await Promise.all([
    signedRequest<{ balances?: { asset: string; free?: string; locked?: string }[] }>('GET', '/api/v3/account', { omitZeroBalances: 'true' }, creds),
    signedRequest<{ asset: string; free?: string; locked?: string; freeze?: string }[]>('POST', '/sapi/v1/asset/get-funding-asset', {}, creds),
    earnRows('/sapi/v1/simple-earn/flexible/position', creds),
    earnRows('/sapi/v1/simple-earn/locked/position', creds),
  ]);
  const earned = new Set(flexible.map((r) => r.asset));
  for (const b of spot.balances ?? []) {
    // LD<coin> is the Spot mirror of a flexible Earn position; skip it only when that position exists
    if (b.asset.startsWith('LD') && earned.has(b.asset.slice(2))) continue;
    add(b.asset, Number(b.free ?? 0) + Number(b.locked ?? 0));
  }
  for (const b of Array.isArray(funding) ? funding : []) add(b.asset, Number(b.free ?? 0) + Number(b.locked ?? 0) + Number(b.freeze ?? 0));
  for (const r of flexible) add(r.asset, Number(r.totalAmount ?? 0));
  for (const r of locked) add(r.asset, Number(r.amount ?? 0));
  return acc;
}
