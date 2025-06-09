import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { AppHeader } from './app-header'
import { AppFooter } from './app-footer'
import { HomeIcon, ProfileIcon, StatsIcon, WalletIcon } from './icons/menu-icons'

export function AppLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const navigationItems = [
        {
            icon: <HomeIcon />,
            label: 'Home',
            active: location.pathname === '/',
            onClick: () => navigate('/'),
        },
        {
            icon: <StatsIcon />,
            label: 'Transactions',
            active: location.pathname === '/transactions',
            onClick: () => navigate('/transactions'),
        },
        {
            icon: <StatsIcon />,
            label: 'Stats',
            active: location.pathname === '/stats',
            onClick: () => navigate('/stats'),
        },
        {
            icon: <WalletIcon />,
            label: 'Wallets',
            active: location.pathname === '/wallets',
            onClick: () => navigate('/wallets'),
        },
    ];

    return (
        <div className="min-h-screen flex flex-col w-full ~bg-muted/50">
            <AppHeader />
            <div className="w-full max-w-7xl mx-auto px-4 md:px-8 flex flex-grow flex-col">
                <div className='flex flex-grow flex-col'>
                    <Outlet />
                </div>
                <AppFooter items={navigationItems}/>
            </div>
        </div>
    )
}