import { NavLink } from 'react-router-dom';
import { BarChart3, LayoutGrid, Plus, ReceiptText, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
    { to: '/', label: 'Home', icon: LayoutGrid },
    { to: '/transactions', label: 'Transactions', icon: ReceiptText },
    null, // center slot: Add
    { to: '/stats', label: 'Stats', icon: BarChart3 },
    { to: '/wallets', label: 'Wallets', icon: Wallet },
];

// Bottom bar from DESIGN.md: four tabs around a raised Add button that is never a tab
export function AppFooter({ onAdd }: { onAdd: () => void }) {
    return (
        <nav
            aria-label="Main"
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-20 pb-[env(safe-area-inset-bottom)] bg-card rounded-t-[28px] shadow-floating-bar grid grid-cols-5 items-center z-40"
        >
            {tabs.map((tab) =>
                tab ? (
                    <NavLink
                        key={tab.to}
                        to={tab.to}
                        end={tab.to === '/'}
                        className={({ isActive }) => cn(
                            'relative flex flex-col items-center gap-1 py-2 text-xs transition-colors',
                            isActive ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {({ isActive }) => (
                            <>
                                <tab.icon className="size-6" strokeWidth={isActive ? 2.25 : 1.75} />
                                <span>{tab.label}</span>
                                {isActive && <span aria-hidden className="absolute -bottom-1 size-1 rounded-full bg-lime" />}
                            </>
                        )}
                    </NavLink>
                ) : (
                    <div key="add" className="flex justify-center">
                        <button
                            type="button"
                            onClick={onAdd}
                            aria-label="Add transaction"
                            className="-mt-10 size-[60px] rounded-full bg-primary text-primary-foreground shadow-raised flex items-center justify-center transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                            <Plus className="size-7" />
                        </button>
                    </div>
                )
            )}
        </nav>
    );
}
