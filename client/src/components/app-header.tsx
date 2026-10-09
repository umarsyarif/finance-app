import { Link } from 'react-router-dom';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from './mode-toggle';
import { useAuth } from '@/contexts/auth.context';

const getUserInitials = (name: string) => {
    return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
};

const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
};

export function AppHeader() {
    const { user, logout } = useAuth();

    return (
        <header className="w-full max-w-[480px] mx-auto px-6 pt-6 pb-2 flex items-center gap-3">
            <DropdownMenu>
                <DropdownMenuTrigger
                    aria-label="Account menu"
                    className="size-11 shrink-0 rounded-full bg-lime-soft text-foreground font-semibold text-sm flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                    {user ? getUserInitials(user.name) : 'U'}
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 rounded-2xl" align="start">
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium leading-none">{user?.name}</p>
                            <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link to="/settings" className="cursor-pointer">Settings</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout}>Log out</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{greeting()}</p>
                <p className="text-[19px] font-bold leading-tight truncate">{user?.name}</p>
            </div>
            <ModeToggle />
        </header>
    );
}
