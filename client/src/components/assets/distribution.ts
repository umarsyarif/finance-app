import { ASSET_CLASS_UI, holdingLabel } from './asset-classes';

const PALETTE = ['#F7931A', '#627EEA', '#26A17B', '#8247E5', '#E84142', '#00AAE4', '#D946A8'];
const OTHER = '#9CA3AF';

// Donut slices: each priced holding's share; slices under `threshold`% merge into "Other"
export function toSlices(holdings: { assetClass: string; symbol: string; value: number | null }[], threshold = 3) {
  const priced = holdings.filter((h) => h.value !== null && h.value > 0) as { assetClass: string; symbol: string; value: number }[];
  const total = priced.reduce((s, h) => s + h.value, 0);
  if (total <= 0) return [];
  const sorted = [...priced].sort((a, b) => b.value - a.value);
  const big = sorted.filter((h) => (h.value / total) * 100 >= threshold);
  const small = sorted.filter((h) => (h.value / total) * 100 < threshold);
  let p = 0;
  const slices = big.map((h) => ({
    name: holdingLabel(h),
    value: h.value,
    pct: (h.value / total) * 100,
    color: ASSET_CLASS_UI[h.assetClass]?.color ?? PALETTE[p++ % PALETTE.length],
  }));
  const otherValue = small.reduce((s, h) => s + h.value, 0);
  if (otherValue > 0) slices.push({ name: 'Other', value: otherValue, pct: (otherValue / total) * 100, color: OTHER });
  return slices;
}
