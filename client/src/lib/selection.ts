// Shell selections are stored raw (they may point at a deleted wallet); these resolve them against the current list
export type Currency = 'KRW' | 'IDR';
type WalletLike = { id: string; currency: string; isMain: boolean };

const ORDER = ['KRW', 'IDR'];

const fallback = (wallets: WalletLike[]) => wallets.find((w) => w.isMain) ?? wallets[0];

export function resolveWalletId(wallets: WalletLike[], stored?: string): string | undefined {
  return wallets.find((w) => w.id === stored)?.id ?? fallback(wallets)?.id;
}

export function currenciesOf(wallets: WalletLike[]): string[] {
  const present = [...new Set(wallets.map((w) => w.currency))];
  const rank = (c: string) => (ORDER.includes(c) ? ORDER.indexOf(c) : ORDER.length);
  return present.sort((a, b) => rank(a) - rank(b));
}

export function resolveCurrency(wallets: WalletLike[], stored?: string): string | undefined {
  return stored && currenciesOf(wallets).includes(stored) ? stored : fallback(wallets)?.currency;
}
