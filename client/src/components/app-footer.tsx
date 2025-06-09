import { cn } from '@/lib/utils';
import { appConfig } from '@/config/app'

interface NavItem {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
  }
  
  interface BottomNavProps {
    items: NavItem[];
    className?: string;
  }
  
export function AppFooter({ items, className }: BottomNavProps) {
    return (
        <nav className={cn(
            "w-full max-w-2xl px-6 py-4 mt-8 flex justify-between items-center bg-background border-t rounded-t-2xl shadow fixed bottom-0 left-1/2 -translate-x-1/2",
            className
        )}>
            {items.map((item, index) => (
            <button 
                key={index}
                onClick={item.onClick}
                className={cn(
                "flex flex-col items-center", 
                item.active ? "text-pastel-blue" : "text-gray-600 hover:text-pastel-blue"
                )}
            >
                {item.icon}
                <span className="text-xs">{item.label}</span>
            </button>
            ))}
        </nav>
    );
}