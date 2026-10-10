import {
  ArrowLeftRight, Baby, Briefcase, Bus, Car, CircleEllipsis, Clapperboard, Coffee, Dumbbell, Fuel, Gift,
  GraduationCap, HeartPulse, House, Laptop, PawPrint, PiggyBank, Plane, Percent, Receipt, Shirt, ShoppingBag,
  ShoppingCart, Smartphone, Sparkles, TrendingUp, Undo2, Utensils, Wifi, Zap, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Curated category icons, keyed by Lucide's kebab-case name (what the API stores)
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  'shopping-cart': ShoppingCart,
  coffee: Coffee,
  bus: Bus,
  car: Car,
  fuel: Fuel,
  house: House,
  receipt: Receipt,
  zap: Zap,
  smartphone: Smartphone,
  wifi: Wifi,
  'shopping-bag': ShoppingBag,
  shirt: Shirt,
  'heart-pulse': HeartPulse,
  dumbbell: Dumbbell,
  'graduation-cap': GraduationCap,
  clapperboard: Clapperboard,
  plane: Plane,
  gift: Gift,
  'paw-print': PawPrint,
  baby: Baby,
  sparkles: Sparkles,
  'piggy-bank': PiggyBank,
  briefcase: Briefcase,
  laptop: Laptop,
  'trending-up': TrendingUp,
  percent: Percent,
  'undo-2': Undo2,
  'arrow-left-right': ArrowLeftRight,
  'circle-ellipsis': CircleEllipsis,
};

// The category's icon, or its first letter when it has none (or an unknown one)
export function CategoryIcon({ icon, name, className }: { icon?: string | null; name?: string; className?: string }) {
  const Icon = icon ? CATEGORY_ICONS[icon] : undefined;
  if (Icon) return <Icon aria-hidden className={cn('size-5', className)} />;
  return <span aria-hidden>{name?.charAt(0).toUpperCase() ?? '?'}</span>;
}

// Grid of the curated icons; tapping the selected one clears it
export function IconPicker({ value, onChange }: { value: string | null; onChange: (icon: string | null) => void }) {
  return (
    <div role="radiogroup" aria-label="Icon" className="grid grid-cols-6 gap-2">
      {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => {
        const selected = value === name;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={name}
            onClick={() => onChange(selected ? null : name)}
            className={cn(
              'flex aspect-square items-center justify-center rounded-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              selected ? 'bg-lime-soft text-foreground' : 'bg-card text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="size-5" />
          </button>
        );
      })}
    </div>
  );
}
