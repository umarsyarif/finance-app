import { Bitcoin, Coins, type LucideIcon } from 'lucide-react';

// One entry per asset class; the Assets page renders a card per entry, in this order.
// Adding a class later (e.g. STOCK) is a new entry here plus a backend price source.
export const ASSET_CLASS_UI: Record<string, { label: string; icon: LucideIcon; color: string | null; manual: boolean; unit: string | null; symbols?: { value: string; label: string }[] }> = {
  GOLD: { label: 'Gold', icon: Coins, color: '#D4A017', manual: true, unit: 'g', symbols: [{ value: 'XAU', label: 'Gold' }] },
  CRYPTO: { label: 'Crypto', icon: Bitcoin, color: null, manual: false, unit: null },
};

// A holding's display name: the class label when the class has one fixed symbol (Gold), else the symbol (BTC)
export const holdingLabel = (h: { assetClass: string; symbol: string }) =>
  ASSET_CLASS_UI[h.assetClass]?.symbols?.length === 1 ? ASSET_CLASS_UI[h.assetClass].label : h.symbol;
