import { BINANCE_BASE } from '../binance.service';
import type { AssetClass } from './asset-classes';

export const GRAMS_PER_TROY_OZ = 31.1035;
const PRICE_TTL = 60_000;
const FX_TTL = 3_600_000;
export class PriceUnavailableError extends Error {}

type Entry<T> = { at: number; value: T };
const priceCache = new Map<string, Entry<number | null>>(); // key: CLASS:SYMBOL
let fxCache: Entry<{ KRW: number; IDR: number }> | null = null;
export const resetPriceCache = () => { priceCache.clear(); fxCache = null; };

const pair = (cls: AssetClass, symbol: string) => (cls === 'GOLD' ? 'PAXGUSDT' : `${symbol}USDT`);

async function tickers(pairs: string[]): Promise<Record<string, number>> {
  const get = async (q: string) => {
    const res = await fetch(`${BINANCE_BASE}/api/v3/ticker/price?${q}`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw Object.assign(new Error('ticker'), { status: res.status });
    return res.json() as Promise<{ symbol: string; price: string } | { symbol: string; price: string }[]>;
  };
  const toMap = (rows: { symbol: string; price: string }[]) => Object.fromEntries(
    rows.map((r) => [r.symbol, Number(r.price)]).filter(([, v]) => Number.isFinite(v)),
  );
  try {
    const rows = await get(`symbols=${encodeURIComponent(JSON.stringify(pairs))}`);
    return toMap(Array.isArray(rows) ? rows : [rows]);
  } catch (err) {
    // One unknown pair fails the whole batch (400): fetch all tickers once and filter locally.
    // Any other failure propagates so the caller serves stale data instead of caching null.
    if ((err as { status?: number }).status !== 400) throw err;
    const all = await get('');
    const wanted = new Set(pairs);
    return toMap((Array.isArray(all) ? all : [all]).filter((r) => wanted.has(r.symbol)));
  }
}

// USD price per unit (gram for GOLD, coin for CRYPTO); null when Binance has no price
export async function usdPrices(cls: AssetClass, symbols: string[]) {
  const now = Date.now();
  const prices: Record<string, number | null> = {};
  const need: string[] = [];
  for (const s of symbols) {
    if (cls === 'CRYPTO' && s === 'USDT') { prices[s] = 1; continue; }
    const hit = priceCache.get(`${cls}:${s}`);
    if (hit && now - hit.at < PRICE_TTL) prices[s] = hit.value;
    else need.push(s);
  }
  if (need.length === 0) return { prices, stale: false };
  try {
    const got = await tickers([...new Set(need.map((s) => pair(cls, s)))]);
    for (const s of need) {
      const raw = got[pair(cls, s)];
      const value = raw === undefined ? null : cls === 'GOLD' ? raw / GRAMS_PER_TROY_OZ : raw;
      priceCache.set(`${cls}:${s}`, { at: now, value });
      prices[s] = value;
    }
    return { prices, stale: false };
  } catch {
    const missing = need.filter((s) => !priceCache.has(`${cls}:${s}`));
    if (missing.length) throw new PriceUnavailableError('Prices are unavailable right now');
    for (const s of need) prices[s] = priceCache.get(`${cls}:${s}`)!.value;
    return { prices, stale: true };
  }
}

export async function usdRates() {
  const now = Date.now();
  if (fxCache && now - fxCache.at < FX_TTL) return { rates: fxCache.value, stale: false };
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error('fx');
    const body = (await res.json()) as { result: string; rates: Record<string, number> };
    if (body.result !== 'success' || !Number.isFinite(body.rates?.KRW) || !Number.isFinite(body.rates?.IDR)) throw new Error('fx');
    fxCache = { at: now, value: { KRW: body.rates.KRW, IDR: body.rates.IDR } };
    return { rates: fxCache.value, stale: false };
  } catch {
    if (!fxCache) throw new PriceUnavailableError('Prices are unavailable right now');
    return { rates: fxCache.value, stale: true };
  }
}
