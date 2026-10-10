import { Banknote, Briefcase, Coins, CreditCard, Gift, House, Landmark, PiggyBank, Plane, Shield, Smartphone, Wallet, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Curated wallet icons, keyed by Lucide's kebab-case name (what the API stores)
export const WALLET_ICONS: Record<string, LucideIcon> = {
  wallet: Wallet,
  landmark: Landmark,
  'credit-card': CreditCard,
  'piggy-bank': PiggyBank,
  banknote: Banknote,
  smartphone: Smartphone,
  coins: Coins,
  briefcase: Briefcase,
  plane: Plane,
  house: House,
  gift: Gift,
  shield: Shield,
};

// Wallet tile: filled with the wallet's colour, white icon (default "wallet")
export function WalletTile({ icon, color, className }: { icon?: string | null; color: string; className?: string }) {
  const Icon = (icon && WALLET_ICONS[icon]) || Wallet;
  return (
    <span aria-hidden className={cn('flex size-12 shrink-0 items-center justify-center rounded-[14px] text-white', className)} style={{ backgroundColor: color }}>
      <Icon className="size-6" />
    </span>
  );
}
